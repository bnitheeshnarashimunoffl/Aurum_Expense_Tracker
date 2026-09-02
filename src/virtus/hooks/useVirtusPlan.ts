import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { notify, subscribe } from '@/lib/sync'
import type { Exercise, MuscleGroup, ScheduleEntry, SplitDay, SplitDayExercise } from '../lib/types'

const CHANNEL = 'virtus_plan'

/**
 * Everything the user configures in Settings — the exercise library, the split day
 * templates and the weekly schedule — behind one hook.
 *
 * They load together because nothing here is useful alone: a split day is a list of
 * exercise ids, and the schedule is a list of split day ids, so any screen that
 * shows one has to resolve the others anyway. Five separate hooks would mean five
 * waterfalls and five chances to render a half-resolved reference.
 */
export function useVirtusPlan() {
  const [muscleGroups, setMuscleGroups] = useState<MuscleGroup[]>([])
  const [exercises, setExercises] = useState<Exercise[]>([])
  const [splitDays, setSplitDays] = useState<SplitDay[]>([])
  const [splitDayExercises, setSplitDayExercises] = useState<SplitDayExercise[]>([])
  const [schedule, setSchedule] = useState<ScheduleEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const loadedOnce = useRef(false)

  const refresh = useCallback(async () => {
    if (!loadedOnce.current) setLoading(true)
    const [g, e, s, sde, sch] = await Promise.all([
      supabase.from('virtus_muscle_groups').select('*'),
      supabase.from('virtus_exercises').select('*'),
      supabase.from('virtus_split_days').select('*'),
      supabase.from('virtus_split_day_exercises').select('*'),
      supabase.from('virtus_schedule').select('*'),
    ])
    const failure = g.error ?? e.error ?? s.error ?? sde.error ?? sch.error
    if (failure) setError(failure.message)
    else {
      setMuscleGroups((g.data ?? []) as MuscleGroup[])
      setExercises((e.data ?? []) as Exercise[])
      setSplitDays((s.data ?? []) as SplitDay[])
      setSplitDayExercises((sde.data ?? []) as SplitDayExercise[])
      setSchedule((sch.data ?? []) as ScheduleEntry[])
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

  const nextPosition = (items: { position: number }[]) =>
    items.reduce((max, i) => Math.max(max, i.position), -1) + 1

  // ------------------------------------------------------------ ordering ----
  /** Library order: by muscle group, then alphabetical — the order you'd scan it in. */
  const sortedExercises = useMemo(() => {
    const groupRank = new Map(muscleGroups.map((g) => [g.id, g.position]))
    return exercises
      .filter((e) => !e.archived)
      .sort((a, b) => {
        // Uncategorised sorts last rather than first, so it reads as a leftover bucket.
        const ra = a.muscle_group_id ? groupRank.get(a.muscle_group_id) ?? 9998 : 9999
        const rb = b.muscle_group_id ? groupRank.get(b.muscle_group_id) ?? 9998 : 9999
        return ra - rb || a.name.localeCompare(b.name)
      })
  }, [exercises, muscleGroups])

  const sortedGroups = useMemo(
    () => [...muscleGroups].sort((a, b) => a.position - b.position || a.label.localeCompare(b.label)),
    [muscleGroups]
  )

  const sortedSplitDays = useMemo(
    () => [...splitDays].sort((a, b) => a.position - b.position || a.name.localeCompare(b.name)),
    [splitDays]
  )

  /** Resolves by id including archived ones, so historical sets never lose their name. */
  const exerciseById = useMemo(() => new Map(exercises.map((e) => [e.id, e])), [exercises])

  /** The ordered exercises of a split day, with any archived ones already dropped. */
  const exercisesOf = useCallback(
    (splitDayId: string): Exercise[] =>
      splitDayExercises
        .filter((x) => x.split_day_id === splitDayId)
        .sort((a, b) => a.position - b.position)
        .map((x) => exerciseById.get(x.exercise_id))
        .filter((e): e is Exercise => Boolean(e) && !e!.archived),
    [splitDayExercises, exerciseById]
  )

  // ------------------------------------------------------- muscle groups ----
  async function addMuscleGroup(label: string) {
    const user_id = await currentUserId()
    const { error: e } = await supabase
      .from('virtus_muscle_groups')
      .insert({ user_id, label: label.trim(), position: nextPosition(muscleGroups) })
    if (e) throw e
    await done()
  }

  async function renameMuscleGroup(id: string, label: string) {
    const { error: e } = await supabase.from('virtus_muscle_groups').update({ label: label.trim() }).eq('id', id)
    if (e) throw e
    await done()
  }

  /** Exercises in the group survive as Uncategorised — ON DELETE SET NULL in the schema. */
  async function deleteMuscleGroup(id: string) {
    const { error: e } = await supabase.from('virtus_muscle_groups').delete().eq('id', id)
    if (e) throw e
    await done()
  }

  // ----------------------------------------------------------- exercises ----
  async function addExercise(name: string, muscleGroupId: string | null) {
    const user_id = await currentUserId()
    const { error: e } = await supabase
      .from('virtus_exercises')
      .insert({ user_id, name: name.trim(), muscle_group_id: muscleGroupId, archived: false })
    if (e) throw e
    await done()
  }

  async function updateExercise(id: string, patch: { name?: string; muscle_group_id?: string | null }) {
    const clean = patch.name === undefined ? patch : { ...patch, name: patch.name.trim() }
    const { error: e } = await supabase.from('virtus_exercises').update(clean).eq('id', id)
    if (e) throw e
    await done()
  }

  /**
   * Removing an exercise from the library is a SOFT delete plus an unassign: it
   * leaves the library and every split day, but the row stays so historical sets
   * keep resolving its name. Hard-deleting it would silently strip the exercise out
   * of every workout you ever logged.
   */
  async function deleteExercise(id: string) {
    const { error: e } = await supabase.from('virtus_exercises').update({ archived: true }).eq('id', id)
    if (e) throw e
    const { error: e2 } = await supabase.from('virtus_split_day_exercises').delete().eq('exercise_id', id)
    if (e2) throw e2
    await done()
  }

  // ---------------------------------------------------------- split days ----
  async function addSplitDay(name: string): Promise<string> {
    const user_id = await currentUserId()
    const { data, error: e } = await supabase
      .from('virtus_split_days')
      .insert({ user_id, name: name.trim(), position: nextPosition(splitDays) })
      .select('id')
      .single()
    if (e) throw e
    await done()
    return (data as { id: string }).id
  }

  async function renameSplitDay(id: string, name: string) {
    const { error: e } = await supabase.from('virtus_split_days').update({ name: name.trim() }).eq('id', id)
    if (e) throw e
    await done()
  }

  /**
   * Sessions that used this split day keep their sets — ON DELETE SET NULL on
   * virtus_sessions.split_day_id means the history says "workout" rather than
   * vanishing. The grid falls back to showing it unranked.
   */
  async function deleteSplitDay(id: string) {
    const { error: e } = await supabase.from('virtus_split_days').delete().eq('id', id)
    if (e) throw e
    await done()
  }

  async function addExerciseToSplitDay(splitDayId: string, exerciseId: string) {
    const user_id = await currentUserId()
    const siblings = splitDayExercises.filter((x) => x.split_day_id === splitDayId)
    const { error: e } = await supabase
      .from('virtus_split_day_exercises')
      .insert({ user_id, split_day_id: splitDayId, exercise_id: exerciseId, position: nextPosition(siblings) })
    if (e) throw e
    await done()
  }

  async function removeExerciseFromSplitDay(splitDayId: string, exerciseId: string) {
    const { error: e } = await supabase
      .from('virtus_split_day_exercises')
      .delete()
      .eq('split_day_id', splitDayId)
      .eq('exercise_id', exerciseId)
    if (e) throw e
    await done()
  }

  /**
   * Moves one exercise up or down within its split day. Positions are rewritten for
   * the whole day rather than swapping two rows, so a list that arrived with gaps or
   * duplicate positions comes out contiguous instead of preserving the mess.
   */
  async function moveExerciseInSplitDay(splitDayId: string, exerciseId: string, delta: -1 | 1) {
    const ordered = splitDayExercises
      .filter((x) => x.split_day_id === splitDayId)
      .sort((a, b) => a.position - b.position)
    const index = ordered.findIndex((x) => x.exercise_id === exerciseId)
    const target = index + delta
    if (index === -1 || target < 0 || target >= ordered.length) return

    const reordered = [...ordered]
    ;[reordered[index], reordered[target]] = [reordered[target], reordered[index]]

    for (let i = 0; i < reordered.length; i++) {
      if (reordered[i].position === i) continue
      const { error: e } = await supabase.from('virtus_split_day_exercises').update({ position: i }).eq('id', reordered[i].id)
      if (e) throw e
    }
    await done()
  }

  // ------------------------------------------------------------ schedule ----
  /** splitDayId null = Rest. Upsert so a day can be reassigned freely. */
  async function setScheduleDay(day: number, splitDayId: string | null) {
    const user_id = await currentUserId()
    const { error: e } = await supabase
      .from('virtus_schedule')
      .upsert({ user_id, day_of_week: day, split_day_id: splitDayId }, { onConflict: 'user_id,day_of_week' })
    if (e) throw e
    await done()
  }

  async function clearScheduleDay(day: number) {
    const { error: e } = await supabase.from('virtus_schedule').delete().eq('day_of_week', day)
    if (e) throw e
    await done()
  }

  return {
    loading,
    error,
    refresh,
    muscleGroups: sortedGroups,
    exercises: sortedExercises,
    exerciseById,
    splitDays: sortedSplitDays,
    splitDayExercises,
    exercisesOf,
    schedule,
    addMuscleGroup,
    renameMuscleGroup,
    deleteMuscleGroup,
    addExercise,
    updateExercise,
    deleteExercise,
    addSplitDay,
    renameSplitDay,
    deleteSplitDay,
    addExerciseToSplitDay,
    removeExerciseFromSplitDay,
    moveExerciseInSplitDay,
    setScheduleDay,
    clearScheduleDay,
  }
}
