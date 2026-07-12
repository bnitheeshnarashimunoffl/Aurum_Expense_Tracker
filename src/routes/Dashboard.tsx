import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import BalanceDial from '@/components/BalanceDial'
import DonutChart, { type DonutSlice } from '@/components/DonutChart'
import TransactionRow from '@/components/TransactionRow'
import { useCategories } from '@/hooks/useCategories'
import { useTransactions } from '@/hooks/useTransactions'
import { useBudgets } from '@/hooks/useBudgets'
import { startOfMonthISO, startOfWeekISO, todayISO } from '@/lib/format'
import type { Scope, Period, Transaction } from '@/lib/types'
import TransactionDetailSheet from '@/components/TransactionDetailSheet'

export default function Dashboard() {
  const [scope, setScope] = useState<Scope>('all')
  const [period, setPeriod] = useState<Period>('month')
  const [selected, setSelected] = useState<Transaction | null>(null)

  const { categories } = useCategories()
  const categoryById = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories])

  const monthStart = startOfMonthISO()
  const periodStart = period === 'week' ? startOfWeekISO() : monthStart

  // Always-monthly data for the dial (net balance + budget ring), independent of the week/month toggle below.
  const { transactions: monthTransactions } = useTransactions({
    from: monthStart,
    to: todayISO(),
    scope: scope === 'all' ? undefined : scope,
  })

  // Scoped-by-toggle data for everything below the dial.
  const { transactions: periodTransactions, deleteTransaction } = useTransactions({
    from: periodStart,
    to: todayISO(),
    scope: scope === 'all' ? undefined : scope,
  })

  const { budgets } = useBudgets()

  const monthIncome = monthTransactions.filter((t) => t.type === 'income').reduce((s, t) => s + t.amount, 0)
  const monthExpense = monthTransactions.filter((t) => t.type === 'expense').reduce((s, t) => s + t.amount, 0)
  const netBalance = monthIncome - monthExpense

  const totalBudget = budgets.reduce((s, b) => s + b.monthly_limit, 0)
  const budgetUsedPct = totalBudget > 0 ? (monthExpense / totalBudget) * 100 : 0

  const expenseSlices: DonutSlice[] = useMemo(() => {
    const totals = new Map<string, number>()
    for (const t of periodTransactions) {
      if (t.type !== 'expense') continue
      totals.set(t.category_id, (totals.get(t.category_id) ?? 0) + t.amount)
    }
    return Array.from(totals.entries()).map(([id, value]) => ({
      id,
      name: categoryById.get(id)?.name ?? 'Unknown',
      value,
      color: categoryById.get(id)?.color ?? '#8A8F98',
    }))
  }, [periodTransactions, categoryById])

  const incomeSlices: DonutSlice[] = useMemo(() => {
    const totals = new Map<string, number>()
    for (const t of periodTransactions) {
      if (t.type !== 'income') continue
      totals.set(t.category_id, (totals.get(t.category_id) ?? 0) + t.amount)
    }
    return Array.from(totals.entries()).map(([id, value]) => ({
      id,
      name: categoryById.get(id)?.name ?? 'Unknown',
      value,
      color: categoryById.get(id)?.color ?? '#8A8F98',
    }))
  }, [periodTransactions, categoryById])

  const budgetWarnings = useMemo(() => {
    return budgets
      .map((b) => {
        const spent = monthTransactions
          .filter((t) => t.type === 'expense' && t.category_id === b.category_id)
          .reduce((s, t) => s + t.amount, 0)
        return { budget: b, spent, category: categoryById.get(b.category_id) }
      })
      .filter((x) => x.spent > x.budget.monthly_limit && x.category)
  }, [budgets, monthTransactions, categoryById])

  const recent = periodTransactions.slice(0, 10)

  return (
    <div className="px-4 pt-4">
      <div className="mb-2 flex items-center justify-between">
        <h1 className="font-display text-2xl font-bold text-primary">Aurum</h1>
        <Link to="/export?range=week" className="text-xs font-medium text-accent">
          Share this week
        </Link>
      </div>

      <BalanceDial netBalance={netBalance} budgetUsedPct={budgetUsedPct} />

      <div className="mt-6 flex gap-2">
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
        {(['week', 'month'] as const).map((p) => (
          <button
            key={p}
            onClick={() => setPeriod(p)}
            className={`min-h-[36px] flex-1 rounded-full text-xs font-medium capitalize ${
              period === p ? 'bg-accent' : 'neu-raised text-muted'
            }`}
            style={period === p ? { color: '#0B0D10' } : undefined}
          >
            {p}
          </button>
        ))}
      </div>

      {budgetWarnings.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-2">
          {budgetWarnings.map(({ budget, category }) => (
            <span
              key={budget.id}
              className="rounded-full border px-3 py-1.5 text-xs font-medium"
              style={{
                borderColor: 'var(--accent)',
                color: category!.color,
                backgroundColor: `${category!.color}22`,
              }}
            >
              {category!.name} over budget
            </span>
          ))}
        </div>
      )}

      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <DonutChart title="Income" slices={incomeSlices} emptyLabel="No income logged yet" />
        <DonutChart title="Expenses" slices={expenseSlices} emptyLabel="No expenses logged yet" />
      </div>

      <div className="mt-6">
        <h2 className="font-display mb-2 text-sm font-medium text-primary">Recent</h2>
        {recent.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted">Nothing logged yet — tap + to add one.</p>
        ) : (
          <div className="space-y-2">
            {recent.map((t) => (
              <TransactionRow key={t.id} transaction={t} category={categoryById.get(t.category_id)} onClick={() => setSelected(t)} />
            ))}
          </div>
        )}
      </div>

      <TransactionDetailSheet
        transaction={selected}
        category={selected ? categoryById.get(selected.category_id) : undefined}
        onClose={() => setSelected(null)}
        onDelete={deleteTransaction}
      />
    </div>
  )
}
