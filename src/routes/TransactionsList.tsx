import { useMemo, useState } from 'react'
import { useCategories } from '@/hooks/useCategories'
import { useTransactions, type TransactionFilters } from '@/hooks/useTransactions'
import TransactionRow from '@/components/TransactionRow'
import TransactionDetailSheet from '@/components/TransactionDetailSheet'
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
  const { transactions, deleteTransaction } = useTransactions(filters)

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
        <div className="flex gap-2">
          {(['all', 'income', 'expense'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setType(t)}
              className={`min-h-[36px] flex-1 rounded-full text-xs font-medium capitalize ${
                type === t ? 'bg-accent' : 'neu-raised text-muted'
              }`}
              style={type === t ? { color: '#0B0D10' } : undefined}
            >
              {t}
            </button>
          ))}
          {(['all', 'personal', 'business'] as const).map((s) => (
            <button
              key={s}
              onClick={() => setScope(s)}
              className={`min-h-[36px] flex-1 rounded-full text-xs font-medium capitalize ${
                scope === s ? 'bg-accent' : 'neu-raised text-muted'
              }`}
              style={scope === s ? { color: '#0B0D10' } : undefined}
            >
              {s}
            </button>
          ))}
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
            className="neu-pressed min-h-[40px] w-28 rounded-card border-none bg-surface px-2 text-xs text-primary outline-none"
          />
          <input
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            className="neu-pressed min-h-[40px] w-28 rounded-card border-none bg-surface px-2 text-xs text-primary outline-none"
          />
        </div>
      </div>

      {grouped.length === 0 ? (
        <p className="py-12 text-center text-sm text-muted">No transactions match these filters.</p>
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
        onDelete={deleteTransaction}
      />
    </div>
  )
}
