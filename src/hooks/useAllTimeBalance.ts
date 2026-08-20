import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { subscribe } from '@/lib/sync'
import type { Scope } from '@/lib/types'

interface AllTimeBalance {
  income: number
  expense: number
  net: number
  loading: boolean
  error: string | null
}

/**
 * All-time net balance — all income minus all expenses, no date filter. Backs
 * the "Total remaining" page of the Balance Dial. Only selects amount/type
 * (not full transaction rows) so this stays cheap as history grows.
 */
export function useAllTimeBalance(scope: Scope): AllTimeBalance {
  const [totals, setTotals] = useState({ income: 0, expense: 0, net: 0 })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    let query = supabase.from('transactions').select('amount, type')
    if (scope === 'personal') query = query.eq('is_business', false)
    if (scope === 'business') query = query.eq('is_business', true)

    const { data, error: queryError } = await query
    if (queryError) {
      setError(queryError.message)
    } else if (data) {
      let income = 0
      let expense = 0
      for (const row of data as { amount: number; type: 'income' | 'expense' }[]) {
        if (row.type === 'income') income += row.amount
        else expense += row.amount
      }
      setTotals({ income, expense, net: income - expense })
      setError(null)
    }
    setLoading(false)
  }, [scope])

  useEffect(() => {
    refresh()
    return subscribe('transactions', refresh)
  }, [refresh])

  return { ...totals, loading, error }
}
