import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import type { QuickAddPreset, TxType } from '@/lib/types'

export function usePresets() {
  const [presets, setPresets] = useState<QuickAddPreset[]>([])
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('quick_add_presets')
      .select('*')
      .order('use_count', { ascending: false })
    if (!error && data) setPresets(data as QuickAddPreset[])
    setLoading(false)
  }, [])

  useEffect(() => {
    refresh()
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
    const { error } = await supabase.from('quick_add_presets').insert({
      user_id: userData.user.id,
      label: input.label,
      amount: input.amount,
      category_id: input.category_id,
      type: input.type,
      is_business: input.is_business ?? false,
    })
    if (error) throw error
    await refresh()
  }

  async function updatePreset(id: string, patch: Partial<QuickAddPreset>) {
    const { error } = await supabase.from('quick_add_presets').update(patch).eq('id', id)
    if (error) throw error
    await refresh()
  }

  async function deletePreset(id: string) {
    const { error } = await supabase.from('quick_add_presets').delete().eq('id', id)
    if (error) throw error
    await refresh()
  }

  /** Bumps use_count/last_used_at. Only affects this bookkeeping — never the stored default amount. */
  async function recordUse(id: string) {
    const preset = presets.find((p) => p.id === id)
    if (!preset) return
    await supabase
      .from('quick_add_presets')
      .update({ use_count: preset.use_count + 1, last_used_at: new Date().toISOString() })
      .eq('id', id)
    await refresh()
  }

  return { presets, loading, refresh, presetsForType, addPreset, updatePreset, deletePreset, recordUse }
}
