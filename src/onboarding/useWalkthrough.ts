import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import type { ModuleKey, WalkthroughStatus } from './types'

/**
 * Completion state is stored in Supabase (so it follows the account across
 * devices — the brief's requirement) and mirrored into localStorage.
 *
 * The mirror is not a cache for speed. It is what stops the walkthrough flashing
 * open for a fraction of a second on every launch while the network round-trip
 * resolves, and it is what makes Loom behave: Loom is offline-first and can be
 * opened with no connection at all, where a Supabase read would hang and the
 * walkthrough would either never appear or appear every single time.
 */
const localKey = (module: ModuleKey) => `meridian.walkthrough.${module}`
const REPLAY_KEY = 'meridian.walkthrough.replay'

function readLocal(module: ModuleKey): boolean {
  try {
    return localStorage.getItem(localKey(module)) !== null
  } catch {
    return false
  }
}

function writeLocal(module: ModuleKey, status: WalkthroughStatus) {
  try {
    localStorage.setItem(localKey(module), status)
  } catch {
    /* private mode — Supabase is still the source of truth */
  }
}

function clearLocal(module: ModuleKey) {
  try {
    localStorage.removeItem(localKey(module))
  } catch {
    /* nothing to clear */
  }
}

/**
 * Queues a walkthrough to run the next time its module mounts. Used by the
 * "show this again" controls in Settings, which navigate into the module rather
 * than trying to replay a tour of a screen that is not on screen.
 *
 * sessionStorage rather than localStorage: a replay that survived a browser
 * restart would ambush someone weeks later.
 */
export function requestReplay(module: ModuleKey) {
  try {
    sessionStorage.setItem(REPLAY_KEY, module)
  } catch {
    /* replay simply will not fire; nothing breaks */
  }
}

function consumeReplay(module: ModuleKey): boolean {
  try {
    if (sessionStorage.getItem(REPLAY_KEY) !== module) return false
    sessionStorage.removeItem(REPLAY_KEY)
    return true
  } catch {
    return false
  }
}

export interface WalkthroughController {
  /** True when the walkthrough should be on screen right now. */
  open: boolean
  /** Records completion and closes. */
  finish: () => void
  /** Records a skip and closes. Both stop it re-triggering; only one means it was seen. */
  skip: () => void
}

/**
 * @param module which walkthrough this is
 * @param ready  hold it back until the screen it points at has actually
 *               rendered — a spotlight anchored to an element that does not
 *               exist yet lands in the top-left corner, which looks broken.
 */
export function useWalkthrough(module: ModuleKey, ready = true): WalkthroughController {
  const [open, setOpen] = useState(false)
  const [resolved, setResolved] = useState(false)

  useEffect(() => {
    let cancelled = false

    async function decide() {
      // A replay wins over everything, including a completed row.
      if (consumeReplay(module)) {
        if (!cancelled) {
          setOpen(true)
          setResolved(true)
        }
        return
      }

      if (readLocal(module)) {
        if (!cancelled) setResolved(true)
        return
      }

      const { data, error } = await supabase
        .from('meridian_walkthroughs')
        .select('status')
        .eq('module_key', module)
        .limit(1)

      if (cancelled) return
      if (!error && data && data.length > 0) {
        // Seen on another device. Mirror it so this one stops asking.
        writeLocal(module, data[0].status as WalkthroughStatus)
        setResolved(true)
        return
      }
      // An error here (offline, table missing) deliberately falls through to
      // showing the walkthrough. A first-time user seeing it is the point; a
      // returning user is already covered by the local mirror above.
      setOpen(true)
      setResolved(true)
    }

    void decide()
    return () => {
      cancelled = true
    }
  }, [module])

  const close = useCallback(
    (status: WalkthroughStatus) => {
      setOpen(false)
      writeLocal(module, status)
      void (async () => {
        const { data: userData } = await supabase.auth.getUser()
        if (!userData.user) return
        await supabase.from('meridian_walkthroughs').upsert(
          { user_id: userData.user.id, module_key: module, status, updated_at: new Date().toISOString() },
          { onConflict: 'user_id,module_key' }
        )
      })()
    },
    [module]
  )

  return {
    open: open && ready && resolved,
    finish: () => close('completed'),
    skip: () => close('skipped'),
  }
}

/**
 * Which walkthroughs this account has already been through — the replay list in
 * Settings needs to say "Seen" or "Skipped" beside each one rather than offering
 * seven identical buttons with no state.
 */
export function useWalkthroughStatuses() {
  const [statuses, setStatuses] = useState<Partial<Record<ModuleKey, WalkthroughStatus>>>({})
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    const { data } = await supabase.from('meridian_walkthroughs').select('module_key, status')
    const next: Partial<Record<ModuleKey, WalkthroughStatus>> = {}
    for (const row of data ?? []) next[row.module_key as ModuleKey] = row.status as WalkthroughStatus
    setStatuses(next)
    setLoading(false)
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  /** Forgets a walkthrough completely, so it triggers again on its own next time. */
  const reset = useCallback(
    async (module: ModuleKey) => {
      clearLocal(module)
      await supabase.from('meridian_walkthroughs').delete().eq('module_key', module)
      await refresh()
    },
    [refresh]
  )

  return { statuses, loading, refresh, reset }
}
