import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import SwipeableBalanceDial from '@/components/SwipeableBalanceDial'
import DonutChart, { type DonutSlice } from '@/components/DonutChart'
import TransactionRow from '@/components/TransactionRow'
import Segmented from '@/components/Segmented'
import { SkeletonRows } from '@/components/Skeleton'
import { useCategories } from '@/hooks/useCategories'
import { useTransactions } from '@/hooks/useTransactions'
import { useBudgets } from '@/hooks/useBudgets'
import { useAllTimeBalance } from '@/hooks/useAllTimeBalance'
import { startOfMonthISO, startOfWeekISO, todayISO } from '@/lib/format'
import type { Scope, Period, Transaction } from '@/lib/types'
import TransactionDetailSheet from '@/components/TransactionDetailSheet'
import ModuleWalkthrough from '@/onboarding/ModuleWalkthrough'

export default function Dashboard() {
  const [scope, setScope] = useState<Scope>('all')
  const [period, setPeriod] = useState<Period>('month')
  const [selected, setSelected] = useState<Transaction | null>(null)

  const { categories } = useCategories()
  const categoryById = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories])

  const monthStart = startOfMonthISO()
  const periodStart = period === 'week' ? startOfWeekISO() : monthStart

  // Always-monthly data for the dial (net balance + budget ring), independent of the week/month toggle below.
  const { transactions: monthTransactions, loading: monthLoading } = useTransactions({
    from: monthStart,
    to: todayISO(),
    scope: scope === 'all' ? undefined : scope,
  })

  // Scoped-by-toggle data for everything below the dial.
  const {
    transactions: periodTransactions,
    loading: periodLoading,
    error: periodError,
    refresh: refreshPeriod,
  } = useTransactions({
    from: periodStart,
    to: todayISO(),
    scope: scope === 'all' ? undefined : scope,
  })

  const { budgets } = useBudgets()

  // All-time net balance for the "Total remaining" page of the dial — scoped the
  // same way as everything else on this screen, but with no date filter.
  const { income: totalIncome, expense: totalExpense, net: totalNet, loading: totalLoading } = useAllTimeBalance(scope)

  const monthIncome = monthTransactions.filter((t) => t.type === 'income').reduce((s, t) => s + t.amount, 0)
  const monthExpense = monthTransactions.filter((t) => t.type === 'expense').reduce((s, t) => s + t.amount, 0)
  const netBalance = monthIncome - monthExpense

  // The ring measures spend in budgeted categories against the total budget —
  // unbudgeted spending shouldn't make budgets look more consumed than they are.
  const totalBudget = budgets.reduce((s, b) => s + b.monthly_limit, 0)
  const budgetedCategoryIds = useMemo(() => new Set(budgets.map((b) => b.category_id)), [budgets])
  const budgetedSpend = monthTransactions
    .filter((t) => t.type === 'expense' && budgetedCategoryIds.has(t.category_id))
    .reduce((s, t) => s + t.amount, 0)
  const budgetUsedPct = totalBudget > 0 ? (budgetedSpend / totalBudget) * 100 : 0

  const slicesFor = (type: 'income' | 'expense'): DonutSlice[] => {
    const totals = new Map<string, number>()
    for (const t of periodTransactions) {
      if (t.type !== type) continue
      totals.set(t.category_id, (totals.get(t.category_id) ?? 0) + t.amount)
    }
    return Array.from(totals.entries()).map(([id, value]) => ({
      id,
      name: categoryById.get(id)?.name ?? 'Unknown',
      value,
      color: categoryById.get(id)?.color ?? '#8A8F98',
    }))
  }
  const incomeSlices = useMemo(() => slicesFor('income'), [periodTransactions, categoryById]) // eslint-disable-line react-hooks/exhaustive-deps
  const expenseSlices = useMemo(() => slicesFor('expense'), [periodTransactions, categoryById]) // eslint-disable-line react-hooks/exhaustive-deps

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
      {/* Three things want the top of this screen: the share link, the wordmark,
          and the fixed sun-exit button in the right corner. The share link used
          to sit right where the sun lands and the two overlapped, so the link
          takes the left, the sun keeps the right, and the wordmark is centred on
          the PAGE rather than in the gap between them — absolutely positioned so
          its centre never shifts with the length of the link's label. min-h
          matches the sun's 44px so all three sit on one line. */}
      <header className="relative mb-2 flex min-h-[44px] items-center">
        <Link
          to="/aurum/export?range=week"
          className="relative z-10 flex min-h-[44px] items-center text-xs font-medium text-accent"
        >
          Share this week
        </Link>
        <h1 className="font-display pointer-events-none absolute inset-x-0 text-center text-2xl font-bold text-primary">
          Aurum
        </h1>
      </header>

      <div data-tour="aurum-dial">
        <SwipeableBalanceDial
          monthNet={netBalance}
          monthBudgetPct={budgetUsedPct}
          hasBudget={totalBudget > 0}
          monthLoading={monthLoading}
          totalNet={totalNet}
          totalIncome={totalIncome}
          totalExpense={totalExpense}
          totalLoading={totalLoading}
        />
      </div>

      <div className="mt-6 flex gap-3">
        <Segmented
          ariaLabel="Scope"
          className="flex-[3]"
          value={scope}
          onChange={setScope}
          options={[
            { value: 'all', label: 'All' },
            { value: 'personal', label: 'Personal' },
            { value: 'business', label: 'Business' },
          ]}
        />
        <Segmented
          ariaLabel="Period"
          className="flex-[2]"
          value={period}
          onChange={setPeriod}
          options={[
            { value: 'week', label: 'Week' },
            { value: 'month', label: 'Month' },
          ]}
        />
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
        <DonutChart title="Income" slices={incomeSlices} emptyLabel="No income logged yet" loading={periodLoading} />
        <DonutChart title="Expenses" slices={expenseSlices} emptyLabel="No expenses logged yet" loading={periodLoading} />
      </div>

      <div className="mt-6">
        <h2 className="font-display mb-2 text-sm font-medium text-primary">Recent</h2>
        {periodLoading ? (
          <SkeletonRows count={4} />
        ) : periodError ? (
          <div className="neu-pressed rounded-card px-4 py-6 text-center">
            <p className="text-sm text-muted">Couldn't load your activity.</p>
            <button onClick={refreshPeriod} className="mt-2 text-sm font-medium text-accent">
              Try again
            </button>
          </div>
        ) : recent.length === 0 ? (
          <div className="neu-pressed rounded-card px-4 py-8 text-center">
            <p className="text-sm text-muted">Nothing logged {period === 'week' ? 'this week' : 'this month'} yet.</p>
            <p className="mt-1 text-xs text-muted">Tap the brass + below to add your first one.</p>
          </div>
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
      />

      {/* Held back until the dial has real numbers in it — a spotlight around a
          skeleton is a spotlight around nothing. */}
      <ModuleWalkthrough module="aurum" ready={!monthLoading} />
    </div>
  )
}
