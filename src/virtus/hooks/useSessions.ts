import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { db as supabase } from '@/lib/dataClient'
import { notify, subscribe } from '@/lib/sync'
import { setsForExercise } from '../lib/volume'
import type { LoggedSet, Session, SessionWithSets } from '../lib/types'

const CHANNEL = 'virtus_sessions'

/**
 * Every logged session and set, for the whole account.
 *
 * Deliberately unpaginated: the grid needs a rolling baseline over the trailing
 * sessions of one split day, and the logging screen needs the last time you touched
 * a given exercise — neither has a bounded date range, so a windowed query would
 * just be a baseline that silently goes wrong once you scroll far enough back. A
 * year of hard training is a few hundred sessions and a few thousand sets, which is
 * small enough that loading it whole is the simpler and more correct trade.
 */
export function useSessions() {
  const [sessions, setSessions] = useState<Session[]>([])
  const [sets, setSets] = useState<LoggedSet[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const loadedOnce = useRef(false)

  const refresh = useCallback(async () => {
    if (!loadedOnce.current) setLoading(true)
    const [s, st] = await Promise.all([
      supabase.from('virtus_sessions').select('*'),
      supabase.from('virtus_sets').select('*'),
    ])
    const failure = s.error ?? st.error
    if (failure) setError(failure.message)
    else {
      setSessions((s.data ?? []) as Session[])
      setSets((st.data ?? []) as LoggedSet[])
      setError(null)
    }
    loadedOnce.current = true
    setLoading(false)
  }, [])

  useEffect(() => {
    refresh()
    return subscribe(CHANNEL, refresh)
  }, [refresh])

  async function currentUserId(): Promise<string> {
    const { data } = await supabase.auth.getUser()
    if (!data.user) throw new Error('Not signed in')
    return data.user.id
  }

  async function done() {
    await refresh()
    notify(CHANNEL)
  }

  /** Sessions joined to their sets — the shape every screen and the volume math reads. */
  const withSets: SessionWithSets[] = useMemo(() => {
    const bySession = new Map<string, LoggedSet[]>()
    for (const set of sets) {
      const list = bySession.get(set.session_id)
      if (list) list.push(set)
      else bySession.set(set.session_id, [set])
    }
    return sessions
      .map((s) => ({ ...s, sets: bySession.get(s.id) ?? [] }))
      .sort((a, b) => a.date.localeCompare(b.date))
  }, [sessions, sets])

  const byDate = useMemo(() => new Map(withSets.map((s) => [s.date, s])), [withSets])

  const sessionOn = useCallback((date: string): SessionWithSets | undefined => byDate.get(date), [byDate])

  /**
   * Gets the session for a date, creating it if it does not exist yet. Every write
   * path goes through here so a session can never be implied by a stray set — the
   * unique (user_id, date) constraint plus this single entry point is what stops two
   * taps in quick succession creating two sessions for one day.
   */
  async function ensureSession(date: string, splitDayId: string | null, isRest: boolean): Promise<string> {
    const existing = byDate.get(date)
    if (existing) {
      if (existing.split_day_id === splitDayId && existing.is_rest_day === isRest) return existing.id
      const { error: e } = await supabase
        .from('virtus_sessions')
        .update({ split_day_id: splitDayId, is_rest_day: isRest, updated_at: new Date().toISOString() })
        .eq('id', existing.id)
      if (e) throw e
      await done()
      return existing.id
    }

    const user_id = await currentUserId()
    const { data, error: e } = await supabase
      .from('virtus_sessions')
      .insert({ user_id, date, split_day_id: splitDayId, is_rest_day: isRest })
      .select('id')
      .single()
    if (e) throw e
    await done()
    return (data as { id: string }).id
  }

  /**
   * Switches a day to a workout on the given split day. Any sets already logged that
   * day are kept: changing your mind about which split day you were doing does not
   * unlog the work, and the sets still name their own exercises.
   */
  async function startWorkout(date: string, splitDayId: string): Promise<string> {
    return ensureSession(date, splitDayId, false)
  }

  /**
   * Marks a day as rest. The schema forbids a rest day from naming a split day, so
   * any sets logged that day are cleared first — otherwise the session would claim
   * no training happened while still carrying the sets that say it did.
   */
  async function markRest(date: string) {
    const existing = byDate.get(date)
    if (existing && existing.sets.length > 0) {
      const { error: e } = await supabase.from('virtus_sets').delete().eq('session_id', existing.id)
      if (e) throw e
    }
    await ensureSession(date, null, true)
  }

  /** Removes the day's record entirely, back to "nothing logged". Sets cascade. */
  async function clearDay(date: string) {
    const existing = byDate.get(date)
    if (!existing) return
    const { error: e } = await supabase.from('virtus_sessions').delete().eq('id', existing.id)
    if (e) throw e
    await done()
  }

  async function addSet(sessionId: string, exerciseId: string, weightKg: number, reps: number) {
    const user_id = await currentUserId()
    const existing = sets.filter((s) => s.session_id === sessionId && s.exercise_id === exerciseId)
    const setNumber = existing.reduce((max, s) => Math.max(max, s.set_number), 0) + 1
    const { error: e } = await supabase.from('virtus_sets').insert({
      user_id,
      session_id: sessionId,
      exercise_id: exerciseId,
      set_number: setNumber,
      weight_kg: weightKg,
      reps,
    })
    if (e) throw e
    await done()
  }

  async function updateSet(setId: string, patch: { weight_kg?: number; reps?: number }) {
    const { error: e } = await supabase.from('virtus_sets').update(patch).eq('id', setId)
    if (e) throw e
    await done()
  }

  /**
   * Deletes a set and closes the gap it leaves. Set numbers are the visible "Set 1,
   * Set 2, Set 3" labels, so leaving a hole would show the user a Set 1 and a Set 3
   * with nothing between them.
   */
  async function deleteSet(setId: string) {
    const target = sets.find((s) => s.id === setId)
    if (!target) return
    const { error: e } = await supabase.from('virtus_sets').delete().eq('id', setId)
    if (e) throw e

    const remaining = setsForExercise(
      sets.filter((s) => s.session_id === target.session_id && s.id !== setId),
      target.exercise_id
    )
    for (let i = 0; i < remaining.length; i++) {
      if (remaining[i].set_number === i + 1) continue
      const { error: e2 } = await supabase.from('virtus_sets').update({ set_number: i + 1 }).eq('id', remaining[i].id)
      if (e2) throw e2
    }
    await done()
  }

  return {
    loading,
    error,
    refresh,
    sessions: withSets,
    sessionOn,
    startWorkout,
    markRest,
    clearDay,
    addSet,
    updateSet,
    deleteSet,
  }
}
