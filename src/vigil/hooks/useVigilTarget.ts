import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { db as supabase } from '@/lib/dataClient'
import { mondayOf, nextDay, weekDates } from '@/lib/date'
import { todayISO } from '@/lib/format'
import { subscribe, notify } from '@/lib/sync'
import {
  DEFAULT_TARGET_SECONDS,
  MAX_TARGET_SECONDS,
  MIN_TARGET_SECONDS,
  type VigilTarget,
} from '../lib/types'

/**
 * Vigil's daily study target — chosen per week, and frozen for the rest of that
 * week once chosen.
 *
 * WHY IT LOCKS. Five hours a day is not everybody's day, so the number had to
 * become a setting. But a target that can be dragged down at 9pm on a bad
 * Thursday is not a target, it is a mood ring: the week always ends "on target"
 * because the target followed the week. Deciding once, in advance, and then
 * living with the decision for seven days is the only version of this that means
 * anything — and it is the same argument Kindle already makes by putting past
 * days behind a PIN.
 *
 * HOW IT LOCKS. Not by hiding a button. `vigil_targets` is keyed on
 * (user_id, week_start) and has a SELECT policy and an INSERT policy and no
 * update or delete policy at all, so the row is immutable from the moment it
 * lands — the second attempt is refused by the primary key, in Postgres, whatever
 * the client thinks. Everything below is the UI agreeing with a rule it does not
 * enforce.
 *
 * A WEEK WITH NO ROW IS UNSET, NOT FIVE HOURS. That distinction is what lets
 * someone who installs the app on a Wednesday pick their target that afternoon
 * instead of being held at the default until Monday. It also means past weeks
 * keep whatever they were actually judged against, so lowering the target now can
 * never turn last month's misses into hits.
 */

export interface VigilTargetController {
  /** Today's target, in seconds. The default when this week has no row. */
  current: number
  /** The target for the week containing an arbitrary date — for charts and history. */
  targetFor: (date: string) => number
  /** True once this week's target is written, and therefore settled. */
  locked: boolean
  /** ISO date of the Monday this week's lock lifts on. */
  unlocksOn: string
  loading: boolean
  /**
   * Writes this week's target. Rejects anything outside the allowed range, and
   * surfaces the database's refusal as a plain sentence if the row already exists
   * — which can happen legitimately, from a second device, between two renders.
   */
  setTarget: (seconds: number) => Promise<void>
  refresh: () => Promise<void>
}

/** How far back charts and the Settings history list can need a target. */
const LOOKBACK_WEEKS = 8

export function useVigilTarget(): VigilTargetController {
  const [rows, setRows] = useState<VigilTarget[]>([])
  const [loading, setLoading] = useState(true)
  const loadedOnce = useRef(false)

  const today = todayISO()
  const thisMonday = mondayOf(today)
  // One query covering every week any current screen can ask about, rather than a
  // fetch per week: eight rows at the very most, and usually none.
  const from = useMemo(() => {
    const cursor = new Date(`${thisMonday}T00:00:00`)
    cursor.setDate(cursor.getDate() - LOOKBACK_WEEKS * 7)
    const m = String(cursor.getMonth() + 1).padStart(2, '0')
    const d = String(cursor.getDate()).padStart(2, '0')
    return `${cursor.getFullYear()}-${m}-${d}`
  }, [thisMonday])

  const refresh = useCallback(async () => {
    if (!loadedOnce.current) setLoading(true)
    const { data, error } = await supabase
      .from('vigil_targets')
      .select('*')
      .gte('week_start', from)
    // A missing table (a project set up before this feature existed) is not an
    // error worth showing anyone — it reads as "no week has a target", which is
    // exactly the five-hour default Vigil has always had.
    if (!error && data) setRows(data as VigilTarget[])
    loadedOnce.current = true
    setLoading(false)
  }, [from])

  useEffect(() => {
    loadedOnce.current = false
    void refresh()
    return subscribe('vigil_targets', refresh)
  }, [refresh])

  const targetFor = useCallback(
    (date: string) => {
      const monday = mondayOf(date)
      return rows.find((row) => row.week_start === monday)?.target_seconds ?? DEFAULT_TARGET_SECONDS
    },
    [rows]
  )

  const thisWeek = rows.find((row) => row.week_start === thisMonday) ?? null

  const setTarget = useCallback(
    async (seconds: number) => {
      const rounded = Math.round(seconds)
      if (rounded < MIN_TARGET_SECONDS || rounded > MAX_TARGET_SECONDS) {
        throw new Error('Pick a target between 30 minutes and 12 hours.')
      }

      const { data: userData } = await supabase.auth.getUser()
      if (!userData.user) throw new Error('Not signed in')

      // insert, never upsert. An upsert here would be the one line that quietly
      // undoes the whole feature.
      const { error } = await supabase.from('vigil_targets').insert({
        user_id: userData.user.id,
        week_start: thisMonday,
        target_seconds: rounded,
      })

      if (error) {
        await refresh()
        // 23505 is unique_violation: the week already has a target. Reachable
        // honestly — a second device set it a moment ago — so it gets the real
        // explanation rather than a generic failure.
        if (error.code === '23505') {
          throw new Error('This week’s target is already set. It can be changed on Monday.')
        }
        throw error
      }

      await refresh()
      notify('vigil_targets')
    },
    [thisMonday, refresh]
  )

  return {
    current: thisWeek?.target_seconds ?? DEFAULT_TARGET_SECONDS,
    targetFor,
    locked: thisWeek !== null,
    // The Monday after this one: the day the next choice becomes available.
    unlocksOn: nextDay(weekDates(thisMonday)[6]),
    loading,
    setTarget,
    refresh,
  }
}
