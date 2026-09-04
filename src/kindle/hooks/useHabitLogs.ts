import { useCallback, useEffect, useRef, useState } from 'react'
import { db as supabase } from '@/lib/dataClient'
import { subscribe, notify } from '@/lib/sync'
import type { HabitLog } from '../lib/types'

export function useHabitLogs(range: { from: string; to: string }) {
  const [logs, setLogs] = useState<HabitLog[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const loadedOnce = useRef(false)

  const refresh = useCallback(async () => {
    // Only the very first fetch for a range shows the spinner. Every later refetch
    // (a save notifying its siblings) happens under an already-correct optimistic
    // grid — flipping `loading` there would blink the whole week away mid-tap.
    if (!loadedOnce.current) setLoading(true)
    const { data, error: queryError } = await supabase
      .from('kindle_habit_logs')
      .select('*')
      .gte('date', range.from)
      .lte('date', range.to)
    if (!queryError && data) {
      setLogs(data as HabitLog[])
      setError(null)
    } else if (queryError) {
      setError(queryError.message)
    }
    loadedOnce.current = true
    setLoading(false)
  }, [range.from, range.to])

  useEffect(() => {
    loadedOnce.current = false
    refresh()
    return subscribe('kindle_habit_logs', refresh)
  }, [refresh])

  /** Paints the new stage locally before the round-trip, so the grid cell recolors on the same frame as the tap. */
  function applyLocally(habitId: string, date: string, stage: number, editedAfterTheFact: boolean, reason: string | null) {
    setLogs((prev) => {
      const index = prev.findIndex((l) => l.habit_id === habitId && l.date === date)
      if (index === -1) {
        const optimistic: HabitLog = {
          id: `optimistic:${habitId}:${date}`,
          user_id: '',
          habit_id: habitId,
          date,
          stage,
          edited_after_the_fact: editedAfterTheFact,
          edit_reason: reason,
          created_at: '',
          updated_at: '',
        }
        return [...prev, optimistic]
      }
      const next = prev.slice()
      next[index] = { ...next[index], stage, edited_after_the_fact: editedAfterTheFact, edit_reason: reason }
      return next
    })
  }

  async function setStage(
    habitId: string,
    date: string,
    stage: number,
    opts: { editedAfterTheFact: boolean; reason?: string | null }
  ) {
    const reason = opts.editedAfterTheFact ? (opts.reason ?? null) : null
    applyLocally(habitId, date, stage, opts.editedAfterTheFact, reason)

    const { data: userData } = await supabase.auth.getUser()
    if (!userData.user) {
      await refresh()
      throw new Error('Not signed in')
    }
    const { error: upsertError } = await supabase.from('kindle_habit_logs').upsert(
      {
        user_id: userData.user.id,
        habit_id: habitId,
        date,
        stage,
        edited_after_the_fact: opts.editedAfterTheFact,
        edit_reason: reason,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'habit_id,date' }
    )
    if (upsertError) {
      // Roll the optimistic paint back to whatever the server actually holds.
      await refresh()
      throw upsertError
    }
    notify('kindle_habit_logs')
  }

  /**
   * Today's value, set from the pill + modal flow. Always an absolute stage — the
   * modal shows real quantities, so picking "3L" means three litres, not "one more
   * than whatever was there". Never an after-the-fact edit; no PIN, no reason.
   */
  async function setToday(habitId: string, date: string, stage: number) {
    await setStage(habitId, date, stage, { editedAfterTheFact: false })
  }

  /** Long-press-to-reset on a pill. Same path as setToday, just pinned to zero. */
  async function resetToday(habitId: string, date: string) {
    await setStage(habitId, date, 0, { editedAfterTheFact: false })
  }

  /** Past day: only reachable once the PIN gate has passed, and a reason is mandatory. */
  async function editPast(habitId: string, date: string, stage: number, reason: string) {
    await setStage(habitId, date, stage, { editedAfterTheFact: true, reason })
  }

  return { logs, loading, error, refresh, setToday, resetToday, editPast }
}
