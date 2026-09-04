import { useCallback, useEffect, useState } from 'react'
import { db as supabase } from '@/lib/dataClient'
import { subscribe, notify } from '@/lib/sync'
import type { Budget } from '@/lib/types'

export function useBudgets() {
  const [budgets, setBudgets] = useState<Budget[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    const { data, error: queryError } = await supabase.from('budgets').select('*')
    if (!queryError && data) {
      setBudgets(data as Budget[])
      setError(null)
    } else if (queryError) {
      setError(queryError.message)
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    refresh()
    return subscribe('budgets', refresh)
  }, [refresh])

  async function setBudget(categoryId: string, monthlyLimit: number) {
    const { data: userData } = await supabase.auth.getUser()
    if (!userData.user) throw new Error('Not signed in')
    const existing = budgets.find((b) => b.category_id === categoryId)
    if (existing) {
      const { error: updateError } = await supabase
        .from('budgets')
        .update({ monthly_limit: monthlyLimit })
        .eq('id', existing.id)
      if (updateError) throw updateError
    } else {
      const { error: insertError } = await supabase
        .from('budgets')
        .insert({ user_id: userData.user.id, category_id: categoryId, monthly_limit: monthlyLimit })
      if (insertError) throw insertError
    }
    notify('budgets')
  }

  async function deleteBudget(id: string) {
    const { error: deleteError } = await supabase.from('budgets').delete().eq('id', id)
    if (deleteError) throw deleteError
    notify('budgets')
  }

  return { budgets, loading, error, refresh, setBudget, deleteBudget }
}
