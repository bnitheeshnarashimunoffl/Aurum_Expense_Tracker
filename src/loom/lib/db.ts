import Dexie, { type Table } from 'dexie'
import type { Assignments, ClassPreset, ScheduleBlock, Term, TimeSlot } from './types'
import { cloneAssignments, emptyAssignments } from './types'

/**
 * Loom's source of truth. Unlike Aurum/Kindle/Vigil — which read and write
 * Supabase directly — every Loom read and write in the UI goes through this
 * IndexedDB database, so the module is fully usable with no network at all.
 * Supabase is a background mirror only (see sync.ts).
 */
class LoomDatabase extends Dexie {
  terms!: Table<Term, string>
  presets!: Table<ClassPreset, string>
  slots!: Table<TimeSlot, string>
  blocks!: Table<ScheduleBlock, string>
  meta!: Table<{ key: string; value: string }, string>

  constructor() {
    super('meridian-loom')
    // `dirty` is indexed so the sync push can find pending rows without a scan.
    this.version(1).stores({
      terms: 'id, updated_at, dirty, is_active, archived',
      presets: 'id, term_id, updated_at, dirty',
      slots: 'id, term_id, position, updated_at, dirty',
      blocks: 'id, term_id, effective_from, updated_at, dirty',
      meta: 'key',
    })
  }
}

export const db = new LoomDatabase()

export function newId(): string {
  // Generated on the client because a record can be created while fully offline;
  // there is no server round-trip to hand out an id.
  return crypto.randomUUID()
}

export function nowISO(): string {
  return new Date().toISOString()
}

/** Every local write goes through this, so nothing can be saved without being queued for sync. */
function stamp<T extends { updated_at: string; dirty: 0 | 1 }>(record: T): T {
  return { ...record, updated_at: nowISO(), dirty: 1 }
}

let cachedUserId = ''
/** Set once auth resolves; records created before that are backfilled at sync time. */
export function setLoomUserId(id: string) {
  cachedUserId = id
}
export function loomUserId(): string {
  return cachedUserId
}

// ---------------------------------------------------------------- terms ----

export async function listTerms(): Promise<Term[]> {
  const all = await db.terms.filter((t) => !t.deleted).toArray()
  return all.sort((a, b) => b.start_date.localeCompare(a.start_date))
}

export async function activeTerm(): Promise<Term | undefined> {
  return (await db.terms.filter((t) => !t.deleted && t.is_active === 1).toArray())[0]
}

interface NewTermInput {
  name: string
  start_date: string
  end_date: string
  /** Copy the previous term's class library and slot structure as a starting point. */
  duplicateFrom?: string
}

/**
 * Creates a term and makes it the active one, archiving whatever was active
 * before. Archived terms are never deleted and never become editable again.
 */
export async function createTerm(input: NewTermInput): Promise<string> {
  const id = newId()
  await db.transaction('rw', db.terms, db.presets, db.slots, db.blocks, async () => {
    const previouslyActive = await db.terms.filter((t) => t.is_active === 1).toArray()
    for (const term of previouslyActive) {
      await db.terms.put(stamp({ ...term, is_active: 0, archived: 1 }))
    }

    await db.terms.put(
      stamp({
        id,
        user_id: cachedUserId,
        name: input.name,
        start_date: input.start_date,
        end_date: input.end_date,
        is_active: 1,
        archived: 0,
        deleted: 0,
        dirty: 1,
        updated_at: nowISO(),
      })
    )

    // A term always owns at least one schedule block, starting on its first day.
    let assignments: Assignments = emptyAssignments()

    if (input.duplicateFrom) {
      // Copy the library and slot structure, remapping ids. Assignments are NOT
      // carried over: the same classes at the same times is a coincidence, not a
      // default, and a stale timetable is worse than an empty one.
      const sourceSlots = await db.slots.where('term_id').equals(input.duplicateFrom).toArray()
      for (const slot of sourceSlots.filter((s) => !s.deleted)) {
        await db.slots.put(stamp({ ...slot, id: newId(), term_id: id, user_id: cachedUserId }))
      }
      const sourcePresets = await db.presets.where('term_id').equals(input.duplicateFrom).toArray()
      for (const preset of sourcePresets.filter((p) => !p.deleted)) {
        await db.presets.put(stamp({ ...preset, id: newId(), term_id: id, user_id: cachedUserId }))
      }
      assignments = emptyAssignments()
    }

    await db.blocks.put(
      stamp({
        id: newId(),
        user_id: cachedUserId,
        term_id: id,
        label: 'Initial schedule',
        effective_from: input.start_date,
        assignments,
        deleted: 0,
        dirty: 1,
        updated_at: nowISO(),
      })
    )
  })
  return id
}

/**
 * Changes a term's name or its dates. Moving the start date drags the term's
 * earliest schedule block with it, because `createTerm` establishes the
 * invariant that a term always has a block covering its first day — without
 * that, pulling the start date earlier would leave the timetable showing a
 * schedule that has not begun yet.
 *
 * Blocks that end up past a shortened end date are left alone rather than
 * deleted: the caller warns about them and the user decides.
 */
export async function updateTerm(
  termId: string,
  patch: { name?: string; start_date?: string; end_date?: string }
): Promise<void> {
  await db.transaction('rw', db.terms, db.blocks, async () => {
    const term = await db.terms.get(termId)
    if (!term) return
    await db.terms.put(stamp({ ...term, ...patch }))

    const start = patch.start_date
    if (!start || start === term.start_date) return
    const blocks = (await db.blocks.where('term_id').equals(termId).toArray()).filter((b) => !b.deleted)
    if (blocks.length === 0) return
    const earliest = blocks.reduce((a, b) => (a.effective_from <= b.effective_from ? a : b))
    if (earliest.effective_from !== start) {
      await db.blocks.put(stamp({ ...earliest, effective_from: start }))
    }
  })
}

/**
 * Removes a term and everything under it — classes, slots and schedule blocks.
 * Soft deletes throughout, for the same reason every other delete here is soft:
 * a row that simply vanished from IndexedDB would be pulled straight back down
 * on the next sync, since the backup would never learn it was removed.
 *
 * Deleting the active term promotes the most recently started remaining term in
 * its place and lifts its archived flag. Otherwise deleting a term you created
 * by mistake would leave every term you have read-only, with no way back.
 */
export async function deleteTerm(termId: string): Promise<void> {
  await db.transaction('rw', db.terms, db.presets, db.slots, db.blocks, async () => {
    const term = await db.terms.get(termId)
    if (!term) return
    await db.terms.put(stamp({ ...term, deleted: 1, is_active: 0 }))

    for (const preset of await db.presets.where('term_id').equals(termId).toArray()) {
      if (!preset.deleted) await db.presets.put(stamp({ ...preset, deleted: 1 }))
    }
    for (const slot of await db.slots.where('term_id').equals(termId).toArray()) {
      if (!slot.deleted) await db.slots.put(stamp({ ...slot, deleted: 1 }))
    }
    for (const block of await db.blocks.where('term_id').equals(termId).toArray()) {
      if (!block.deleted) await db.blocks.put(stamp({ ...block, deleted: 1 }))
    }

    if (term.is_active !== 1) return
    const successor = (await db.terms.toArray())
      .filter((t) => !t.deleted && t.id !== termId)
      .sort((a, b) => b.start_date.localeCompare(a.start_date))[0]
    if (successor) await db.terms.put(stamp({ ...successor, is_active: 1, archived: 0 }))
  })
}

// -------------------------------------------------------------- presets ----

export async function upsertPreset(preset: Omit<ClassPreset, 'user_id' | 'updated_at' | 'dirty' | 'deleted'> & Partial<ClassPreset>) {
  await db.presets.put(
    stamp({
      deleted: 0,
      ...preset,
      user_id: cachedUserId,
      updated_at: nowISO(),
      dirty: 1,
    } as ClassPreset)
  )
}

/**
 * Soft-deletes a preset AND clears every slot that referenced it, in one
 * transaction — otherwise the grid would be left pointing at a class that no
 * longer exists.
 */
export async function deletePreset(presetId: string, termId: string) {
  await db.transaction('rw', db.presets, db.blocks, async () => {
    const preset = await db.presets.get(presetId)
    if (preset) await db.presets.put(stamp({ ...preset, deleted: 1 }))

    const blocks = await db.blocks.where('term_id').equals(termId).toArray()
    for (const block of blocks) {
      let touched = false
      const next = cloneAssignments(block.assignments)
      for (const day of Object.keys(next)) {
        for (const slotId of Object.keys(next[day])) {
          if (next[day][slotId] === presetId) {
            delete next[day][slotId]
            touched = true
          }
        }
      }
      if (touched) await db.blocks.put(stamp({ ...block, assignments: next }))
    }
  })
}

// ---------------------------------------------------------------- slots ----

export async function addSlot(termId: string, start_time: string, end_time: string) {
  const existing = await db.slots.where('term_id').equals(termId).toArray()
  const position = existing.reduce((max, s) => Math.max(max, s.position), -1) + 1
  await db.slots.put(
    stamp({
      id: newId(),
      user_id: cachedUserId,
      term_id: termId,
      position,
      start_time,
      end_time,
      deleted: 0,
      dirty: 1,
      updated_at: nowISO(),
    })
  )
}

export async function updateSlot(slot: TimeSlot, patch: Partial<TimeSlot>) {
  await db.slots.put(stamp({ ...slot, ...patch }))
}

/** Soft-deletes a slot and drops its assignments from every block in the term. */
export async function deleteSlot(slot: TimeSlot) {
  await db.transaction('rw', db.slots, db.blocks, async () => {
    await db.slots.put(stamp({ ...slot, deleted: 1 }))
    const blocks = await db.blocks.where('term_id').equals(slot.term_id).toArray()
    for (const block of blocks) {
      const next = cloneAssignments(block.assignments)
      let touched = false
      for (const day of Object.keys(next)) {
        if (next[day][slot.id]) {
          delete next[day][slot.id]
          touched = true
        }
      }
      if (touched) await db.blocks.put(stamp({ ...block, assignments: next }))
    }
  })
}

// --------------------------------------------------------------- blocks ----

export async function addBlock(termId: string, effective_from: string, label: string, copyFrom?: ScheduleBlock) {
  await db.blocks.put(
    stamp({
      id: newId(),
      user_id: cachedUserId,
      term_id: termId,
      label,
      effective_from,
      // A snapshot, not a link — later edits to the source block do not reach here.
      assignments: copyFrom ? cloneAssignments(copyFrom.assignments) : emptyAssignments(),
      deleted: 0,
      dirty: 1,
      updated_at: nowISO(),
    })
  )
}

export async function deleteBlock(block: ScheduleBlock) {
  await db.blocks.put(stamp({ ...block, deleted: 1 }))
}

/** Assign a class to one day+slot, or pass null to clear it. */
export async function assignSlot(block: ScheduleBlock, day: number, slotId: string, presetId: string | null) {
  const next = cloneAssignments(block.assignments)
  const key = String(day)
  next[key] = next[key] ?? {}
  if (presetId) next[key][slotId] = presetId
  else delete next[key][slotId]
  await db.blocks.put(stamp({ ...block, assignments: next }))
}

/**
 * One-time copy of a weekday's assignments into Saturday. The result is a plain
 * snapshot: Saturday keeps no reference to the source day, so editing either one
 * afterwards leaves the other untouched.
 */
export async function copyDayInto(block: ScheduleBlock, fromDay: number, toDay: number) {
  const next = cloneAssignments(block.assignments)
  next[String(toDay)] = { ...(next[String(fromDay)] ?? {}) }
  await db.blocks.put(stamp({ ...block, assignments: next }))
}

// ----------------------------------------------------------------- meta ----

export async function getMeta(key: string): Promise<string | undefined> {
  return (await db.meta.get(key))?.value
}

export async function setMeta(key: string, value: string) {
  await db.meta.put({ key, value })
}
