import { useMemo, useState } from 'react'
import { useCategories } from '@/hooks/useCategories'
import { useBudgets } from '@/hooks/useBudgets'
import { useTransactions } from '@/hooks/useTransactions'
import BudgetBar from '@/components/BudgetBar'
import BottomSheet from '@/components/BottomSheet'
import { startOfMonthISO, todayISO } from '@/lib/format'
import type { Category } from '@/lib/types'

export default function Budgets() {
  const { categories } = useCategories()
  const { budgets, setBudget } = useBudgets()
  const { transactions } = useTransactions({ from: startOfMonthISO(), to: todayISO(), type: 'expense' })

  const [editingCategory, setEditingCategory] = useState<Category | null>(null)
  const [limitInput, setLimitInput] = useState('')
  const [saving, setSaving] = useState(false)

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
    setEditingCategory(category)
  }

  async function handleSave() {
    if (!editingCategory) return
    const parsed = parseFloat(limitInput)
    if (!parsed || parsed <= 0) return
    setSaving(true)
    try {
      await setBudget(editingCategory.id, parsed)
      setEditingCategory(null)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="px-4 pt-4">
      <h1 className="font-display mb-4 text-2xl font-bold text-primary">Budgets</h1>

      <div className="space-y-3">
        {expenseCategories.map((category) => {
          const budget = budgetByCategory.get(category.id)
          const spent = spentByCategory.get(category.id) ?? 0
          return (
            <div key={category.id} onClick={() => openEdit(category)} className="cursor-pointer">
              <BudgetBar
                categoryName={category.name}
                color={category.color}
                spent={spent}
                limit={budget?.monthly_limit ?? 0}
              />
            </div>
          )
        })}
      </div>

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
              value={limitInput}
              onChange={(e) => setLimitInput(e.target.value)}
              className="neu-pressed w-full rounded-card border-none bg-surface px-4 py-3 text-primary outline-none focus:ring-1 focus:ring-accent"
            />
          </div>
          <button
            onClick={handleSave}
            disabled={saving}
            className="neu-raised min-h-[44px] w-full rounded-card bg-accent py-3 font-medium disabled:opacity-60"
            style={{ color: '#0B0D10' }}
          >
            {saving ? 'Saving…' : 'Save budget'}
          </button>
        </div>
      </BottomSheet>
    </div>
  )
}
