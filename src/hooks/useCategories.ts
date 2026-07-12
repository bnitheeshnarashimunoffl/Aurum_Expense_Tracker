import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import type { Category, TxType } from '@/lib/types'

export function useCategories() {
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    setLoading(true)
    const { data, error } = await supabase.from('categories').select('*').order('name')
    if (!error && data) setCategories(data as Category[])
    setLoading(false)
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  async function addCategory(input: {
    name: string
    type: TxType
    color: string
    is_business?: boolean
    parent_id?: string | null
    icon?: string | null
  }) {
    const { data: userData } = await supabase.auth.getUser()
    if (!userData.user) throw new Error('Not signed in')
    const { error } = await supabase.from('categories').insert({
      user_id: userData.user.id,
      name: input.name,
      type: input.type,
      color: input.color,
      is_business: input.is_business ?? false,
      parent_id: input.parent_id ?? null,
      icon: input.icon ?? null,
    })
    if (error) throw error
    await refresh()
  }

  async function updateCategory(id: string, patch: Partial<Category>) {
    const { error } = await supabase.from('categories').update(patch).eq('id', id)
    if (error) throw error
    await refresh()
  }

  async function archiveCategory(id: string, archived = true) {
    await updateCategory(id, { archived })
  }

  return { categories, loading, refresh, addCategory, updateCategory, archiveCategory }
}
