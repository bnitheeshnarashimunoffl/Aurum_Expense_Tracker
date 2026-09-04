import { useCallback, useEffect, useState } from 'react'
import { db as supabase } from '@/lib/dataClient'
import { subscribe, notify } from '@/lib/sync'
import type { Habit, HabitType } from '../lib/types'
import { MAX_STAGE_LIMIT } from '../lib/types'

/**
 * `includeInactive: true` pulls every habit (active or soft-deleted) — used by
 * History/PDF views so a deactivated habit's past data still renders correctly.
 * The live weekly grid uses the default (active-only).
 */
export function useHabits(options?: { includeInactive?: boolean }) {
  const includeInactive = options?.includeInactive ?? false
  const [habits, setHabits] = useState<Habit[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    let query = supabase.from('kindle_habits').select('*').order('position')
    if (!includeInactive) query = query.eq('active', true)
    const { data, error: queryError } = await query
    if (!queryError && data) {
      setHabits(data as Habit[])
      setError(null)
    } else if (queryError) {
      setError(queryError.message)
    }
    setLoading(false)
  }, [includeInactive])

  useEffect(() => {
    refresh()
    return subscribe('kindle_habits', refresh)
  }, [refresh])

  interface NewHabitInput {
    label: string
    type: HabitType
    maxStage: number
    targetValue: number | null
    targetUnit: string | null
  }

  async function addHabit(input: NewHabitInput) {
    const { data: userData } = await supabase.auth.getUser()
    if (!userData.user) throw new Error('Not signed in')
    const nextPosition = habits.reduce((max, h) => Math.max(max, h.position), -1) + 1
    const clampedMaxStage = input.type === 'binary' ? 1 : Math.min(MAX_STAGE_LIMIT, Math.max(1, input.maxStage))
    const { error: insertError } = await supabase.from('kindle_habits').insert({
      user_id: userData.user.id,
      label: input.label,
      position: nextPosition,
      active: true,
      type: input.type,
      max_stage: clampedMaxStage,
      target_value: input.type === 'binary' ? null : input.targetValue,
      target_unit: input.type === 'binary' ? null : input.targetUnit,
      palette_key: null,
    })
    if (insertError) throw insertError
    notify('kindle_habits')
  }

  async function deactivateHabit(id: string) {
    const { error: updateError } = await supabase.from('kindle_habits').update({ active: false }).eq('id', id)
    if (updateError) throw updateError
    notify('kindle_habits')
  }

  /** Persists a full reordering — pass every habit in its new top-to-bottom order. */
  async function reorderHabits(orderedIds: string[]) {
    await Promise.all(orderedIds.map((id, i) => supabase.from('kindle_habits').update({ position: i }).eq('id', id)))
    notify('kindle_habits')
  }

  /**
   * Changes a multi-stage habit's stage count (and, for 1:1 habits like water/sleep/
   * study, its target value alongside it). Clears palette_key so the color always
   * regenerates live from the new max_stage — nothing about the old palette is cached.
   * Historical log rows keep their raw `stage` number as-is; see kindle_migration_stages.sql.
   */
  async function updateHabitStages(id: string, patch: { maxStage: number; targetValue?: number | null; targetUnit?: string | null }) {
    const clampedMaxStage = Math.min(MAX_STAGE_LIMIT, Math.max(1, patch.maxStage))
    const { error: updateError } = await supabase
      .from('kindle_habits')
      .update({
        max_stage: clampedMaxStage,
        ...(patch.targetValue !== undefined ? { target_value: patch.targetValue } : {}),
        ...(patch.targetUnit !== undefined ? { target_unit: patch.targetUnit } : {}),
        palette_key: null,
      })
      .eq('id', id)
    if (updateError) throw updateError
    notify('kindle_habits')
  }

  return { habits, loading, error, refresh, addHabit, deactivateHabit, reorderHabits, updateHabitStages }
}
