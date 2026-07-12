import { useMemo, useState } from 'react'
import { usePresets } from '@/hooks/usePresets'
import { useCategories } from '@/hooks/useCategories'
import BottomSheet from '@/components/BottomSheet'
import Amount from '@/components/Amount'
import CategoryColorDot from '@/components/CategoryColorDot'
import Segmented from '@/components/Segmented'
import { SkeletonRows } from '@/components/Skeleton'
import { formatDate } from '@/lib/format'
import type { QuickAddPreset, TxType } from '@/lib/types'

export default function ManagePresets() {
  const { presets, loading, addPreset, updatePreset, deletePreset } = usePresets()
  const { categories } = useCategories()
  const categoryById = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories])

  const [editing, setEditing] = useState<QuickAddPreset | 'new' | null>(null)
  const [label, setLabel] = useState('')
  const [amount, setAmount] = useState('')
  const [type, setType] = useState<TxType>('income')
  const [categoryId, setCategoryId] = useState('')
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [confirmingDelete, setConfirmingDelete] = useState(false)

  function openNew() {
    setLabel('')
    setAmount('')
    setType('income')
    setCategoryId('')
    setFormError(null)
    setConfirmingDelete(false)
    setEditing('new')
  }

  function openEdit(preset: QuickAddPreset) {
    setLabel(preset.label)
    setAmount(preset.amount.toFixed(2))
    setType(preset.type)
    setCategoryId(preset.category_id)
    setFormError(null)
    setConfirmingDelete(false)
    setEditing(preset)
  }

  async function handleSave() {
    const parsedAmount = parseFloat(amount)
    if (!label.trim()) {
      setFormError('Give the preset a label.')
      return
    }
    if (!parsedAmount || parsedAmount <= 0) {
      setFormError('Enter a default amount greater than zero.')
      return
    }
    if (!categoryId) {
      setFormError('Pick a category.')
      return
    }
    setFormError(null)
    setSaving(true)
    try {
      const category = categoryById.get(categoryId)
      if (editing === 'new') {
        await addPreset({
          label: label.trim(),
          amount: parsedAmount,
          category_id: categoryId,
          type,
          is_business: category?.is_business ?? false,
        })
      } else if (editing) {
        await updatePreset(editing.id, {
          label: label.trim(),
          amount: parsedAmount,
          category_id: categoryId,
          type,
          is_business: category?.is_business ?? false,
        })
      }
      setEditing(null)
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Couldn't save — try again.")
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (editing === 'new' || !editing) return
    if (!confirmingDelete) {
      setConfirmingDelete(true)
      return
    }
    setSaving(true)
    try {
      await deletePreset(editing.id)
      setEditing(null)
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Couldn't delete — try again.")
      setConfirmingDelete(false)
    } finally {
      setSaving(false)
    }
  }

  const availableCategories = categories.filter((c) => c.type === type && !c.archived)

  return (
    <div className="px-4 pt-4">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="font-display text-2xl font-bold text-primary">Presets</h1>
        <button onClick={openNew} className="neu-raised min-h-[44px] rounded-full bg-accent px-4 text-sm font-medium text-ink">
          + New
        </button>
      </div>

      {loading ? (
        <SkeletonRows count={3} />
      ) : presets.length === 0 ? (
        <div className="neu-pressed rounded-card px-4 py-10 text-center">
          <p className="text-sm text-muted">
            No presets yet. Create one for recurring income or expenses you enter manually — like your allowance or a
            retainer.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {presets.map((preset) => {
            const category = categoryById.get(preset.category_id)
            return (
              <button
                key={preset.id}
                onClick={() => openEdit(preset)}
                className="neu-raised flex w-full items-center justify-between rounded-card px-4 py-3 text-left"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <CategoryColorDot color={category?.color ?? '#8A8F98'} size={12} />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-primary">{preset.label}</p>
                    <p className="truncate text-xs text-muted">
                      Used {preset.use_count}× · {preset.last_used_at ? formatDate(preset.last_used_at.slice(0, 10)) : 'never'}
                    </p>
                  </div>
                </div>
                <Amount
                  value={preset.amount}
                  className={`text-sm font-medium ${preset.type === 'income' ? 'text-income' : 'text-expense'}`}
                />
              </button>
            )
          })}
        </div>
      )}

      <BottomSheet open={editing !== null} onClose={() => setEditing(null)} title={editing === 'new' ? 'New preset' : 'Edit preset'}>
        <div className="space-y-4">
          <Segmented
            ariaLabel="Preset type"
            size="md"
            value={type}
            onChange={(t) => {
              setType(t)
              setCategoryId('')
            }}
            options={[
              { value: 'income', label: 'Income' },
              { value: 'expense', label: 'Expense' },
            ]}
          />

          <div>
            <label className="mb-1.5 block text-sm text-muted">Label</label>
            <input
              type="text"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="e.g. SKT Group Retainer"
              className="neu-pressed w-full rounded-card border-none bg-surface px-4 py-3 text-primary outline-none focus:ring-1 focus:ring-accent"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-sm text-muted">Default amount</label>
            <input
              type="number"
              inputMode="decimal"
              min="0"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="neu-pressed font-display tabular-nums w-full rounded-card border-none bg-surface px-4 py-3 text-primary outline-none focus:ring-1 focus:ring-accent"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-sm text-muted">Category</label>
            <select
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              className="neu-pressed w-full rounded-card border-none bg-surface px-4 py-3 text-primary outline-none focus:ring-1 focus:ring-accent"
            >
              <option value="">Select a category</option>
              {availableCategories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
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
            {saving ? 'Saving…' : 'Save preset'}
          </button>

          {editing !== 'new' && editing && (
            <button
              onClick={handleDelete}
              disabled={saving}
              className="min-h-[44px] w-full rounded-card py-3 text-sm font-medium text-expense disabled:opacity-60"
            >
              {confirmingDelete ? 'Tap again to confirm' : 'Delete preset'}
            </button>
          )}
        </div>
      </BottomSheet>
    </div>
  )
}
