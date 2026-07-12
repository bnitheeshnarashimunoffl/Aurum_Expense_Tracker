import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { subscribe, notify } from '@/lib/sync'
import type { QuickAddPreset, TxType } from '@/lib/types'

export function usePresets() {
  const [presets, setPresets] = useState<QuickAddPreset[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    const { data, error: queryError } = await supabase
      .from('quick_add_presets')
      .select('*')
      .order('use_count', { ascending: false })
      .order('last_used_at', { ascending: false, nullsFirst: false })
    if (!queryError && data) {
      setPresets(data as QuickAddPreset[])
      setError(null)
    } else if (queryError) {
      setError(queryError.message)
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    refresh()
    return subscribe('quick_add_presets', refresh)
  }, [refresh])

  function presetsForType(type: TxType) {
    return presets.filter((p) => p.type === type)
  }

  async function addPreset(input: {
    label: string
    amount: number
    category_id: string
    type: TxType
    is_business?: boolean
  }) {
    const { data: userData } = await supabase.auth.getUser()
    if (!userData.user) throw new Error('Not signed in')
    const { error: insertError } = await supabase.from('quick_add_presets').insert({
      user_id: userData.user.id,
      label: input.label,
      amount: input.amount,
      category_id: input.category_id,
      type: input.type,
      is_business: input.is_business ?? false,
    })
    if (insertError) throw insertError
    notify('quick_add_presets')
  }

  async function updatePreset(id: string, patch: Partial<QuickAddPreset>) {
    const { error: updateError } = await supabase.from('quick_add_presets').update(patch).eq('id', id)
    if (updateError) throw updateError
    notify('quick_add_presets')
  }

  async function deletePreset(id: string) {
    // Transactions logged from this preset reference it via preset_id; detach them
    // first or the FK constraint blocks the delete once a preset has been used.
    const { error: detachError } = await supabase
      .from('transactions')
      .update({ preset_id: null })
      .eq('preset_id', id)
    if (detachError) throw detachError
    const { error: deleteError } = await supabase.from('quick_add_presets').delete().eq('id', id)
    if (deleteError) throw deleteError
    notify('quick_add_presets')
  }

  /** Bumps use_count/last_used_at. Only affects this bookkeeping — never the stored default amount. */
  async function recordUse(id: string) {
    const preset = presets.find((p) => p.id === id)
    if (!preset) return
    const { error: updateError } = await supabase
      .from('quick_add_presets')
      .update({ use_count: preset.use_count + 1, last_used_at: new Date().toISOString() })
      .eq('id', id)
    if (updateError) throw updateError
    notify('quick_add_presets')
  }

  return { presets, loading, error, refresh, presetsForType, addPreset, updatePreset, deletePreset, recordUse }
}
