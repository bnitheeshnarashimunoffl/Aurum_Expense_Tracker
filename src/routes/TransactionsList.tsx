import { useMemo, useState } from 'react'
import { useCategories } from '@/hooks/useCategories'
import { useTransactions, type TransactionFilters } from '@/hooks/useTransactions'
import TransactionRow from '@/components/TransactionRow'
import TransactionDetailSheet from '@/components/TransactionDetailSheet'
import Segmented from '@/components/Segmented'
import { SkeletonRows } from '@/components/Skeleton'
import type { Scope, Transaction, TxType } from '@/lib/types'
import { formatDate } from '@/lib/format'

export default function TransactionsList() {
  const { categories } = useCategories()
  const [type, setType] = useState<TxType | 'all'>('all')
  const [scope, setScope] = useState<Scope>('all')
  const [categoryId, setCategoryId] = useState('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [selected, setSelected] = useState<Transaction | null>(null)

  const filters: TransactionFilters = {
    type: type === 'all' ? undefined : type,
    scope: scope === 'all' ? undefined : scope,
    categoryId: categoryId || undefined,
    from: from || undefined,
    to: to || undefined,
  }
  const { transactions, loading, error, refresh } = useTransactions(filters)

  const categoryById = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories])

  const grouped = useMemo(() => {
    const groups = new Map<string, Transaction[]>()
    for (const t of transactions) {
      if (!groups.has(t.date)) groups.set(t.date, [])
      groups.get(t.date)!.push(t)
    }
    return Array.from(groups.entries()).sort((a, b) => (a[0] < b[0] ? 1 : -1))
  }, [transactions])

  return (
    <div className="px-4">
      <h1 className="font-display mb-4 pt-4 text-2xl font-bold text-primary">Activity</h1>

      <div className="mb-4 space-y-2">
        <div className="flex gap-3">
          <Segmented
            ariaLabel="Type"
            className="flex-1"
            value={type}
            onChange={setType}
            options={[
              { value: 'all', label: 'All' },
              { value: 'income', label: 'Income' },
              { value: 'expense', label: 'Expense' },
            ]}
          />
          <Segmented
            ariaLabel="Scope"
            className="flex-1"
            value={scope}
            onChange={setScope}
            options={[
              { value: 'all', label: 'All' },
              { value: 'personal', label: 'Personal' },
              { value: 'business', label: 'Business' },
            ]}
          />
        </div>

        <div className="flex gap-2">
          <select
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
            className="neu-pressed min-h-[40px] flex-1 rounded-card border-none bg-surface px-3 text-xs text-primary outline-none"
          >
            <option value="">All categories</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <input
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            aria-label="From date"
            className="neu-pressed min-h-[40px] w-28 rounded-card border-none bg-surface px-2 text-xs text-primary outline-none"
          />
          <input
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            aria-label="To date"
            className="neu-pressed min-h-[40px] w-28 rounded-card border-none bg-surface px-2 text-xs text-primary outline-none"
          />
        </div>
      </div>

      {loading ? (
        <SkeletonRows count={6} />
      ) : error ? (
        <div className="neu-pressed rounded-card px-4 py-8 text-center">
          <p className="text-sm text-muted">Couldn't load your activity.</p>
          <button onClick={refresh} className="mt-2 text-sm font-medium text-accent">
            Try again
          </button>
        </div>
      ) : grouped.length === 0 ? (
        <div className="neu-pressed rounded-card px-4 py-10 text-center">
          <p className="text-sm text-muted">No transactions match these filters.</p>
        </div>
      ) : (
        <div className="space-y-5">
          {grouped.map(([date, items]) => (
            <div key={date}>
              <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted">{formatDate(date)}</p>
              <div className="space-y-2">
                {items.map((t) => (
                  <TransactionRow
                    key={t.id}
                    transaction={t}
                    category={categoryById.get(t.category_id)}
                    onClick={() => setSelected(t)}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      <TransactionDetailSheet
        transaction={selected}
        category={selected ? categoryById.get(selected.category_id) : undefined}
        onClose={() => setSelected(null)}
      />
    </div>
  )
}
