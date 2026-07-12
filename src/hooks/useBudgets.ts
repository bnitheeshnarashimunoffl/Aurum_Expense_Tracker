import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import type { Budget } from '@/lib/types'

export function useBudgets() {
  const [budgets, setBudgets] = useState<Budget[]>([])
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    setLoading(true)
    const { data, error } = await supabase.from('budgets').select('*')
    if (!error && data) setBudgets(data as Budget[])
    setLoading(false)
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  async function setBudget(categoryId: string, monthlyLimit: number) {
    const { data: userData } = await supabase.auth.getUser()
    if (!userData.user) throw new Error('Not signed in')
    const existing = budgets.find((b) => b.category_id === categoryId)
    if (existing) {
      const { error } = await supabase
        .from('budgets')
        .update({ monthly_limit: monthlyLimit })
        .eq('id', existing.id)
      if (error) throw error
    } else {
      const { error } = await supabase
        .from('budgets')
        .insert({ user_id: userData.user.id, category_id: categoryId, monthly_limit: monthlyLimit })
      if (error) throw error
    }
    await refresh()
  }

  async function deleteBudget(id: string) {
    const { error } = await supabase.from('budgets').delete().eq('id', id)
    if (error) throw error
    await refresh()
  }

  return { budgets, loading, refresh, setBudget, deleteBudget }
}
