import { useMemo, useState } from 'react'
import { usePresets } from '@/hooks/usePresets'
import { useCategories } from '@/hooks/useCategories'
import BottomSheet from '@/components/BottomSheet'
import Amount from '@/components/Amount'
import CategoryColorDot from '@/components/CategoryColorDot'
import { formatDate } from '@/lib/format'
import type { QuickAddPreset, TxType } from '@/lib/types'

export default function ManagePresets() {
  const { presets, addPreset, updatePreset, deletePreset } = usePresets()
  const { categories } = useCategories()
  const categoryById = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories])

  const [editing, setEditing] = useState<QuickAddPreset | 'new' | null>(null)
  const [label, setLabel] = useState('')
  const [amount, setAmount] = useState('')
  const [type, setType] = useState<TxType>('income')
  const [categoryId, setCategoryId] = useState('')
  const [saving, setSaving] = useState(false)

  function openNew() {
    setLabel('')
    setAmount('')
    setType('income')
    setCategoryId('')
    setEditing('new')
  }

  function openEdit(preset: QuickAddPreset) {
    setLabel(preset.label)
    setAmount(preset.amount.toFixed(2))
    setType(preset.type)
    setCategoryId(preset.category_id)
    setEditing(preset)
  }

  async function handleSave() {
    const parsedAmount = parseFloat(amount)
    if (!label.trim() || !parsedAmount || !categoryId) return
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
    } finally {
      setSaving(false)
    }
  }

  const availableCategories = categories.filter((c) => c.type === type && !c.archived)

  return (
    <div className="px-4 pt-4">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="font-display text-2xl font-bold text-primary">Presets</h1>
        <button
          onClick={openNew}
          className="neu-raised min-h-[44px] rounded-full bg-accent px-4 text-sm font-medium"
          style={{ color: '#0B0D10' }}
        >
          + New
        </button>
      </div>

      {presets.length === 0 ? (
        <p className="py-12 text-center text-sm text-muted">
          No presets yet. Create one for recurring income or expenses you enter manually — like your allowance or a
          retainer.
        </p>
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
          <div className="flex rounded-full bg-black/30 p-1">
            {(['income', 'expense'] as TxType[]).map((t) => (
              <button
                key={t}
                onClick={() => {
                  setType(t)
                  setCategoryId('')
                }}
                className={`min-h-[44px] flex-1 rounded-full text-sm font-medium capitalize ${
                  type === t ? 'bg-accent' : 'text-muted'
                }`}
                style={type === t ? { color: '#0B0D10' } : undefined}
              >
                {t}
              </button>
            ))}
          </div>

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
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="neu-pressed w-full rounded-card border-none bg-surface px-4 py-3 text-primary outline-none focus:ring-1 focus:ring-accent"
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

          <button
            onClick={handleSave}
            disabled={saving}
            className="neu-raised min-h-[44px] w-full rounded-card bg-accent py-3 font-medium disabled:opacity-60"
            style={{ color: '#0B0D10' }}
          >
            {saving ? 'Saving…' : 'Save preset'}
          </button>

          {editing !== 'new' && editing && (
            <button
              onClick={async () => {
                await deletePreset(editing.id)
                setEditing(null)
              }}
              className="min-h-[44px] w-full rounded-card py-3 text-sm font-medium text-expense"
            >
              Delete preset
            </button>
          )}
        </div>
      </BottomSheet>
    </div>
  )
}
