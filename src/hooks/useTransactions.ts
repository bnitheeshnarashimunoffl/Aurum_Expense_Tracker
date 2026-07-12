import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { subscribe, notify } from '@/lib/sync'
import type { Transaction } from '@/lib/types'

export interface TransactionFilters {
  from?: string
  to?: string
  categoryId?: string
  type?: 'income' | 'expense'
  scope?: 'all' | 'personal' | 'business'
}

// Mutations live at module level (not inside the hook) so components that only
// write — like the always-mounted Add Transaction sheet — don't pay for a full
// table fetch they never render. Each one notifies the sync bus so every
// mounted useTransactions instance refetches.
export async function addTransaction(input: Omit<Transaction, 'id' | 'user_id' | 'created_at'>): Promise<Transaction> {
  const { data: userData } = await supabase.auth.getUser()
  if (!userData.user) throw new Error('Not signed in')
  const { data, error } = await supabase
    .from('transactions')
    .insert({ ...input, user_id: userData.user.id })
    .select()
    .single()
  if (error) throw error
  notify('transactions')
  return data as Transaction
}

export async function updateTransaction(id: string, patch: Partial<Transaction>) {
  const { error } = await supabase.from('transactions').update(patch).eq('id', id)
  if (error) throw error
  notify('transactions')
}

export async function deleteTransaction(id: string, receiptPath?: string | null) {
  // Remove the receipt object first so deleted transactions don't leave orphaned
  // files accumulating in the private storage bucket.
  if (receiptPath) await supabase.storage.from('receipts').remove([receiptPath])
  const { error } = await supabase.from('transactions').delete().eq('id', id)
  if (error) throw error
  notify('transactions')
}

export function useTransactions(filters: TransactionFilters = {}) {
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    let query = supabase.from('transactions').select('*').order('date', { ascending: false })

    if (filters.from) query = query.gte('date', filters.from)
    if (filters.to) query = query.lte('date', filters.to)
    if (filters.categoryId) query = query.eq('category_id', filters.categoryId)
    if (filters.type) query = query.eq('type', filters.type)
    if (filters.scope === 'personal') query = query.eq('is_business', false)
    if (filters.scope === 'business') query = query.eq('is_business', true)

    const { data, error: queryError } = await query
    if (!queryError && data) {
      setTransactions(data as Transaction[])
      setError(null)
    } else if (queryError) {
      setError(queryError.message)
    }
    // Only the initial fetch shows a loading state — background refreshes after a
    // mutation shouldn't flash skeletons over data that's already on screen.
    setLoading(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters.from, filters.to, filters.categoryId, filters.type, filters.scope])

  useEffect(() => {
    refresh()
    return subscribe('transactions', refresh)
  }, [refresh])

  return { transactions, loading, error, refresh, addTransaction, updateTransaction, deleteTransaction }
}
