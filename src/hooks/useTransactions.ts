import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import type { Transaction } from '@/lib/types'

export interface TransactionFilters {
  from?: string
  to?: string
  categoryId?: string
  type?: 'income' | 'expense'
  scope?: 'all' | 'personal' | 'business'
}

export function useTransactions(filters: TransactionFilters = {}) {
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    setLoading(true)
    let query = supabase.from('transactions').select('*').order('date', { ascending: false })

    if (filters.from) query = query.gte('date', filters.from)
    if (filters.to) query = query.lte('date', filters.to)
    if (filters.categoryId) query = query.eq('category_id', filters.categoryId)
    if (filters.type) query = query.eq('type', filters.type)
    if (filters.scope === 'personal') query = query.eq('is_business', false)
    if (filters.scope === 'business') query = query.eq('is_business', true)

    const { data, error } = await query
    if (!error && data) setTransactions(data as Transaction[])
    setLoading(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters.from, filters.to, filters.categoryId, filters.type, filters.scope])

  useEffect(() => {
    refresh()
  }, [refresh])

  async function addTransaction(input: Omit<Transaction, 'id' | 'user_id' | 'created_at'>) {
    const { data: userData } = await supabase.auth.getUser()
    if (!userData.user) throw new Error('Not signed in')
    const { data, error } = await supabase
      .from('transactions')
      .insert({ ...input, user_id: userData.user.id })
      .select()
      .single()
    if (error) throw error
    await refresh()
    return data as Transaction
  }

  async function updateTransaction(id: string, patch: Partial<Transaction>) {
    const { error } = await supabase.from('transactions').update(patch).eq('id', id)
    if (error) throw error
    await refresh()
  }

  async function deleteTransaction(id: string) {
    const { error } = await supabase.from('transactions').delete().eq('id', id)
    if (error) throw error
    await refresh()
  }

  return { transactions, loading, refresh, addTransaction, updateTransaction, deleteTransaction }
}
