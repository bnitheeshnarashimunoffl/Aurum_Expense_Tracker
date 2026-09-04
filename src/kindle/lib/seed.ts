import { db as supabase } from '@/lib/dataClient'
import { notify } from '@/lib/sync'
import { DEFAULT_HABITS } from './types'

/**
 * Seeds the 8 default habits for a brand-new Kindle user. Runs client-side (rather
 * than a signup DB trigger, like Aurum uses for categories) because this account
 * already existed before Kindle did — a signup trigger would never fire for it.
 * Called once from the weekly grid route, the natural Kindle entry point, so
 * concurrent mounts elsewhere don't race to insert duplicates.
 */
export async function ensureDefaultHabitsSeeded(): Promise<void> {
  const { count, error: countError } = await supabase
    .from('kindle_habits')
    .select('id', { count: 'exact', head: true })
  if (countError || (count ?? 0) > 0) return

  const { data: userData } = await supabase.auth.getUser()
  if (!userData.user) return

  const rows = DEFAULT_HABITS.map((config, i) => ({
    user_id: userData.user!.id,
    label: config.label,
    position: i,
    active: true,
    type: config.type,
    max_stage: config.max_stage,
    target_value: config.target_value,
    target_unit: config.target_unit,
    palette_key: config.palette_key,
  }))
  const { error: insertError } = await supabase.from('kindle_habits').insert(rows)
  if (!insertError) notify('kindle_habits')
}
