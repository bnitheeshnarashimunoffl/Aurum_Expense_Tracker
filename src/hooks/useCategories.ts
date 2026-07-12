import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { subscribe, notify } from '@/lib/sync'
import type { Category, TxType } from '@/lib/types'

export function useCategories() {
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    const { data, error: queryError } = await supabase.from('categories').select('*').order('name')
    if (!queryError && data) {
      setCategories(data as Category[])
      setError(null)
    } else if (queryError) {
      setError(queryError.message)
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    refresh()
    return subscribe('categories', refresh)
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
    const { error: insertError } = await supabase.from('categories').insert({
      user_id: userData.user.id,
      name: input.name,
      type: input.type,
      color: input.color,
      is_business: input.is_business ?? false,
      parent_id: input.parent_id ?? null,
      icon: input.icon ?? null,
    })
    if (insertError) throw insertError
    notify('categories')
  }

  async function updateCategory(id: string, patch: Partial<Category>) {
    const { error: updateError } = await supabase.from('categories').update(patch).eq('id', id)
    if (updateError) throw updateError
    notify('categories')
  }

  async function archiveCategory(id: string, archived = true) {
    await updateCategory(id, { archived })
  }

  return { categories, loading, error, refresh, addCategory, updateCategory, archiveCategory }
}
