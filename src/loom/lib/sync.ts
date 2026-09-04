import { supabase } from '@/lib/supabase'
import { db, getMeta, setMeta, loomUserId, setLoomUserId } from './db'
import type { ClassPreset, ScheduleBlock, Term, TimeSlot } from './types'

/**
 * Background mirror between IndexedDB (the source of truth) and Supabase.
 *
 * Rules this obeys, all of them deliberate:
 *   * It never blocks the UI and never throws into it. Every entry point
 *     swallows failures — being offline is the normal case, not an error.
 *   * Last-write-wins on `updated_at`, single user. No merge, no CRDT.
 *   * A push clears `dirty` only after the row is accepted, so a failed sync
 *     leaves the row queued rather than silently dropping the change.
 *   * A pull never resurrects a row the user has since edited locally: a remote
 *     row is only applied when it is strictly newer than the local copy.
 */

const LAST_PULLED_KEY = 'lastPulledAt'

export type SyncState = 'idle' | 'syncing' | 'offline' | 'synced' | 'error'

type Listener = (state: SyncState, pendingCount: number) => void
const listeners = new Set<Listener>()
let currentState: SyncState = 'idle'
let pending = 0

export function subscribeSync(fn: Listener): () => void {
  listeners.add(fn)
  fn(currentState, pending)
  return () => listeners.delete(fn)
}

function emit(state: SyncState) {
  currentState = state
  listeners.forEach((fn) => fn(state, pending))
}

async function countDirty(): Promise<number> {
  const [t, p, s, b] = await Promise.all([
    db.terms.where('dirty').equals(1).count(),
    db.presets.where('dirty').equals(1).count(),
    db.slots.where('dirty').equals(1).count(),
    db.blocks.where('dirty').equals(1).count(),
  ])
  return t + p + s + b
}

/**
 * The flag columns that are `boolean` in Postgres but `0 | 1` in IndexedDB.
 *
 * This gap is not cosmetic, and getting it wrong is silent. IndexedDB cannot
 * index a boolean (see the note on `Flag` in types.ts, which is why these are
 * integers locally), and every local read compares strictly — `t.is_active === 1`.
 * A row pulled down carrying Postgres's `true` therefore lands in the database
 * intact and then fails every single query that looks for it, because
 * `true === 1` is false. The symptom is brutal to diagnose from the outside: the
 * sync badge goes gold, the rows are visibly correct in Supabase, and the app
 * insists you have no term at all.
 *
 * It is also the other half of the duplicate-term bug — createTerm() deactivates
 * the previous term by looking for `is_active === 1`, so a pulled-down active
 * term was invisible to it and a second "the" active term got created alongside.
 */
const FLAG_FIELDS = ['deleted', 'is_active', 'archived'] as const

/** Supabase row -> local row. Normalises the booleans back into indexable 0/1. */
function fromRemote(row: LocalRow): LocalRow {
  const out = { ...row } as unknown as Record<string, unknown>
  for (const field of FLAG_FIELDS) {
    if (field in out) out[field] = out[field] ? 1 : 0
  }
  return out as unknown as LocalRow
}

/** Local row -> Supabase row. `dirty` is local bookkeeping and never leaves the device. */
function toRemote<T extends { dirty: unknown }>(row: T, userId: string) {
  const { dirty: _dirty, ...rest } = row as T & Record<string, unknown>
  return { ...rest, user_id: userId }
}

const TABLES = [
  { local: 'terms', remote: 'loom_terms' },
  { local: 'presets', remote: 'loom_class_presets' },
  { local: 'slots', remote: 'loom_time_slots' },
  { local: 'blocks', remote: 'loom_schedule_blocks' },
] as const

type LocalRow = Term | ClassPreset | TimeSlot | ScheduleBlock

function table(name: (typeof TABLES)[number]['local']) {
  return db[name] as unknown as import('dexie').Table<LocalRow, string>
}

let running = false

const FLAG_REPAIR_KEY = 'flagTypesRepaired.v1'

/**
 * One-time local repair for rows an earlier build pulled down with Postgres
 * booleans left in place (see fromRemote above for what that breaks).
 *
 * Re-pulling alone would not fix them: the pull only overwrites a local row when
 * the remote copy is strictly NEWER, and these rows carry the exact same
 * `updated_at` as the server's — they are not stale, just stored in the wrong
 * type. So they have to be rewritten in place, locally, once.
 *
 * Purely local and network-free, which is why it runs before the offline check.
 */
async function repairFlagTypes(): Promise<void> {
  if (await getMeta(FLAG_REPAIR_KEY)) return
  for (const { local } of TABLES) {
    for (const row of await table(local).toArray()) {
      const record = row as unknown as Record<string, unknown>
      const broken = FLAG_FIELDS.some((field) => field in record && typeof record[field] !== 'number')
      if (broken) await table(local).put(fromRemote(row))
    }
  }
  await setMeta(FLAG_REPAIR_KEY, new Date().toISOString())
}

/**
 * One full push-then-pull cycle. Safe to call at any time, including offline and
 * before the user is known — it just reports back what it could do.
 */
export async function syncNow(): Promise<SyncState> {
  if (running) return currentState
  await repairFlagTypes()
  pending = await countDirty()

  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    emit('offline')
    return 'offline'
  }

  running = true
  emit('syncing')
  try {
    const { data: userData } = await supabase.auth.getUser()
    const userId = userData.user?.id
    if (!userId) {
      // Signed out, or the auth call failed because we are actually offline.
      emit('offline')
      return 'offline'
    }
    setLoomUserId(userId)

    // ---- push -------------------------------------------------------------
    for (const { local, remote } of TABLES) {
      const dirtyRows = await table(local).where('dirty').equals(1).toArray()
      if (dirtyRows.length === 0) continue

      // Rows created before auth resolved carry an empty user_id; fill it in now.
      const payload = dirtyRows.map((row) => toRemote({ ...row, user_id: userId }, userId))
      const { error } = await supabase.from(remote).upsert(payload, { onConflict: 'id' })
      if (error) {
        emit('error')
        return 'error'
      }
      await db.transaction('rw', table(local), async () => {
        for (const row of dirtyRows) {
          const fresh = await table(local).get(row.id)
          // Only clear the flag if nothing changed the row while we were pushing.
          if (fresh && fresh.updated_at === row.updated_at) {
            await table(local).put({ ...fresh, user_id: userId, dirty: 0 })
          }
        }
      })
    }

    // ---- pull -------------------------------------------------------------
    const since = (await getMeta(LAST_PULLED_KEY)) ?? '1970-01-01T00:00:00.000Z'
    let newest = since
    for (const { local, remote } of TABLES) {
      const { data, error } = await supabase.from(remote).select('*').gt('updated_at', since)
      if (error) {
        emit('error')
        return 'error'
      }
      for (const remoteRow of (data ?? []) as LocalRow[]) {
        if (remoteRow.updated_at > newest) newest = remoteRow.updated_at
        const localRow = await table(local).get(remoteRow.id)
        // Last-write-wins, and a local edit made since the remote write survives.
        if (!localRow || localRow.updated_at < remoteRow.updated_at) {
          await table(local).put({ ...fromRemote(remoteRow), dirty: 0 } as LocalRow)
        }
      }
    }
    await setMeta(LAST_PULLED_KEY, newest)

    pending = await countDirty()
    emit(pending > 0 ? 'idle' : 'synced')
    return 'synced'
  } catch {
    // Almost always "fetch failed" because the network dropped mid-cycle. The
    // dirty flags are still set, so the next attempt picks up exactly where this
    // one stopped.
    emit('offline')
    return 'offline'
  } finally {
    running = false
  }
}

let debounce: number | undefined

/** Called after local writes. Coalesces bursts of edits into one sync. */
export function scheduleSync(delayMs = 1500) {
  if (typeof window === 'undefined') return
  window.clearTimeout(debounce)
  debounce = window.setTimeout(() => void syncNow(), delayMs)
}

/**
 * Memoizes the FIRST sync attempt of this session, so every screen that needs to
 * know "has Loom had a chance to pull existing data down yet" awaits the exact
 * same attempt instead of each triggering (and racing) its own.
 *
 * This exists because of a real bug: a freshly wiped device's IndexedDB is
 * empty, but Dexie's live queries resolve that emptiness INSTANTLY — well
 * before the network pull below has had a chance to run. A screen that reads
 * "no term exists" at that instant and offers to create one (Terms.tsx's
 * "Start new term") can create a brand-new term while the account's real one is
 * still only in Supabase, and since the device didn't know that term existed
 * yet, it has no way to deactivate it — leaving two rows both marked
 * `is_active = true`, which loom_schema.sql's own comment says should be
 * impossible. useLoomReady() in useLoomData.ts is what screens actually consume
 * to close this window.
 */
let firstSyncPromise: Promise<SyncState> | null = null
export function ensureFirstSync(): Promise<SyncState> {
  if (!firstSyncPromise) firstSyncPromise = syncNow()
  return firstSyncPromise
}

/** Wires up sync-on-reconnect and a slow heartbeat. Returns a teardown function. */
export function startSyncLoop(): () => void {
  const onOnline = () => void syncNow()
  window.addEventListener('online', onOnline)
  window.addEventListener('offline', () => emit('offline'))
  const heartbeat = window.setInterval(() => void syncNow(), 5 * 60 * 1000)
  void ensureFirstSync()
  return () => {
    window.removeEventListener('online', onOnline)
    window.clearInterval(heartbeat)
  }
}

/** Used by the UI to show what is still only on this device. */
export async function pendingCount(): Promise<number> {
  return countDirty()
}

export { loomUserId }
