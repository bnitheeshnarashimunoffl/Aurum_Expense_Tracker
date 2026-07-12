import { useMemo, useState } from 'react'
import { useCategories } from '@/hooks/useCategories'
import { useBudgets } from '@/hooks/useBudgets'
import { useTransactions } from '@/hooks/useTransactions'
import BudgetBar from '@/components/BudgetBar'
import BottomSheet from '@/components/BottomSheet'
import { SkeletonRows } from '@/components/Skeleton'
import { startOfMonthISO, todayISO } from '@/lib/format'
import type { Category } from '@/lib/types'

export default function Budgets() {
  const { categories, loading: categoriesLoading } = useCategories()
  const { budgets, setBudget, deleteBudget } = useBudgets()
  const { transactions } = useTransactions({ from: startOfMonthISO(), to: todayISO(), type: 'expense' })

  const [editingCategory, setEditingCategory] = useState<Category | null>(null)
  const [limitInput, setLimitInput] = useState('')
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  const expenseCategories = categories.filter((c) => c.type === 'expense' && !c.archived)
  const budgetByCategory = useMemo(() => new Map(budgets.map((b) => [b.category_id, b])), [budgets])

  const spentByCategory = useMemo(() => {
    const totals = new Map<string, number>()
    for (const t of transactions) {
      totals.set(t.category_id, (totals.get(t.category_id) ?? 0) + t.amount)
    }
    return totals
  }, [transactions])

  function openEdit(category: Category) {
    const existing = budgetByCategory.get(category.id)
    setLimitInput(existing ? existing.monthly_limit.toFixed(2) : '')
    setFormError(null)
    setEditingCategory(category)
  }

  const editingBudget = editingCategory ? budgetByCategory.get(editingCategory.id) : undefined

  async function handleSave() {
    if (!editingCategory) return
    const parsed = parseFloat(limitInput)
    if (!parsed || parsed <= 0) {
      setFormError('Enter a monthly limit greater than zero.')
      return
    }
    setFormError(null)
    setSaving(true)
    try {
      await setBudget(editingCategory.id, parsed)
      setEditingCategory(null)
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Couldn't save — try again.")
    } finally {
      setSaving(false)
    }
  }

  async function handleRemove() {
    if (!editingBudget) return
    setSaving(true)
    try {
      await deleteBudget(editingBudget.id)
      setEditingCategory(null)
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Couldn't remove — try again.")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="px-4 pt-4">
      <h1 className="font-display mb-4 text-2xl font-bold text-primary">Budgets</h1>

      {categoriesLoading ? (
        <SkeletonRows count={5} />
      ) : expenseCategories.length === 0 ? (
        <div className="neu-pressed rounded-card px-4 py-10 text-center">
          <p className="text-sm text-muted">No expense categories yet — add some in Settings first.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {expenseCategories.map((category) => {
            const budget = budgetByCategory.get(category.id)
            const spent = spentByCategory.get(category.id) ?? 0
            return (
              <button key={category.id} onClick={() => openEdit(category)} className="block w-full text-left">
                <BudgetBar
                  categoryName={category.name}
                  color={category.color}
                  spent={spent}
                  limit={budget?.monthly_limit ?? 0}
                />
              </button>
            )
          })}
        </div>
      )}

      <BottomSheet
        open={editingCategory !== null}
        onClose={() => setEditingCategory(null)}
        title={editingCategory ? `Set budget · ${editingCategory.name}` : 'Set budget'}
      >
        <div className="space-y-4">
          <div>
            <label className="mb-1.5 block text-sm text-muted">Monthly limit</label>
            <input
              type="number"
              inputMode="decimal"
              min="0"
              step="0.01"
              value={limitInput}
              onChange={(e) => setLimitInput(e.target.value)}
              className="neu-pressed font-display tabular-nums w-full rounded-card border-none bg-surface px-4 py-3 text-primary outline-none focus:ring-1 focus:ring-accent"
            />
          </div>

          {formError && (
            <p role="alert" className="text-sm text-expense">
              {formError}
            </p>
          )}

          <button
            onClick={handleSave}
            disabled={saving}
            className="neu-raised min-h-[44px] w-full rounded-card bg-accent py-3 font-medium text-ink disabled:opacity-60"
          >
            {saving ? 'Saving…' : 'Save budget'}
          </button>

          {editingBudget && (
            <button
              onClick={handleRemove}
              disabled={saving}
              className="min-h-[44px] w-full rounded-card py-3 text-sm font-medium text-muted disabled:opacity-60"
            >
              Remove budget
            </button>
          )}
        </div>
      </BottomSheet>
    </div>
  )
}
