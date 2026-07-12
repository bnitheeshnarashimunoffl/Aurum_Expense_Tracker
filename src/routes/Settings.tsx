import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useCategories } from '@/hooks/useCategories'
import { useTransactions } from '@/hooks/useTransactions'
import { supabase } from '@/lib/supabase'
import { transactionsToCSV, downloadCSV } from '@/lib/csv'
import { todayISO } from '@/lib/format'
import BottomSheet from '@/components/BottomSheet'
import CategoryColorDot from '@/components/CategoryColorDot'
import type { Category, TxType } from '@/lib/types'

const DEFAULT_COLOR = '#C9A46A'

export default function Settings() {
  const navigate = useNavigate()
  const { categories, addCategory, updateCategory, archiveCategory } = useCategories()
  const { transactions } = useTransactions()

  const [editing, setEditing] = useState<Category | 'new' | null>(null)
  const [name, setName] = useState('')
  const [type, setType] = useState<TxType>('expense')
  const [color, setColor] = useState(DEFAULT_COLOR)
  const [isBusiness, setIsBusiness] = useState(false)
  const [saving, setSaving] = useState(false)

  function openNew() {
    setName('')
    setType('expense')
    setColor(DEFAULT_COLOR)
    setIsBusiness(false)
    setEditing('new')
  }

  function openEdit(category: Category) {
    setName(category.name)
    setType(category.type)
    setColor(category.color)
    setIsBusiness(category.is_business)
    setEditing(category)
  }

  async function handleSave() {
    if (!name.trim()) return
    setSaving(true)
    try {
      if (editing === 'new') {
        await addCategory({ name: name.trim(), type, color, is_business: isBusiness })
      } else if (editing) {
        await updateCategory(editing.id, { name: name.trim(), color, is_business: isBusiness })
      }
      setEditing(null)
    } finally {
      setSaving(false)
    }
  }

  async function handleExportCSV() {
    const csv = transactionsToCSV(transactions, categories)
    downloadCSV(csv, `aurum-transactions-${todayISO()}.csv`)
  }

  async function handleLogout() {
    await supabase.auth.signOut()
    navigate('/login', { replace: true })
  }

  const activeCategories = categories.filter((c) => !c.archived)
  const archivedCategories = categories.filter((c) => c.archived)

  return (
    <div className="px-4 pt-4">
      <h1 className="font-display mb-4 text-2xl font-bold text-primary">Settings</h1>

      <section className="mb-6">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="font-display text-sm font-medium text-primary">Categories</h2>
          <button
            onClick={openNew}
            className="neu-raised min-h-[36px] rounded-full bg-accent px-3 text-xs font-medium"
            style={{ color: '#0B0D10' }}
          >
            + Add
          </button>
        </div>
        <div className="space-y-2">
          {activeCategories.map((c) => (
            <button
              key={c.id}
              onClick={() => openEdit(c)}
              className="neu-raised flex w-full items-center justify-between rounded-card px-4 py-3 text-left"
            >
              <span className="flex items-center gap-2 text-sm text-primary">
                <CategoryColorDot color={c.color} />
                {c.parent_id ? `↳ ${c.name}` : c.name}
              </span>
              <span className="text-xs capitalize text-muted">
                {c.type} {c.is_business && '· business'}
              </span>
            </button>
          ))}
        </div>

        {archivedCategories.length > 0 && (
          <details className="mt-3">
            <summary className="cursor-pointer text-xs text-muted">{archivedCategories.length} archived</summary>
            <div className="mt-2 space-y-2">
              {archivedCategories.map((c) => (
                <div key={c.id} className="flex items-center justify-between rounded-card px-4 py-2 text-sm text-muted">
                  <span className="flex items-center gap-2">
                    <CategoryColorDot color={c.color} />
                    {c.name}
                  </span>
                  <button onClick={() => archiveCategory(c.id, false)} className="text-xs text-accent">
                    Restore
                  </button>
                </div>
              ))}
            </div>
          </details>
        )}
      </section>

      <section className="mb-6">
        <Link
          to="/presets"
          className="neu-raised block min-h-[44px] w-full rounded-card px-4 py-3 text-sm text-primary"
        >
          Manage quick-add presets
        </Link>
      </section>

      <section className="mb-6 space-y-2">
        <h2 className="font-display mb-2 text-sm font-medium text-primary">Export</h2>
        <button
          onClick={handleExportCSV}
          className="neu-raised min-h-[44px] w-full rounded-card px-4 py-3 text-left text-sm text-primary"
        >
          Export all transactions to CSV
        </button>
        <Link
          to="/export"
          className="neu-raised block min-h-[44px] w-full rounded-card px-4 py-3 text-sm text-primary"
        >
          Export & Share PDF report
        </Link>
      </section>

      <button
        onClick={handleLogout}
        className="neu-raised min-h-[44px] w-full rounded-card px-4 py-3 text-sm font-medium text-expense"
      >
        Log out
      </button>

      <BottomSheet
        open={editing !== null}
        onClose={() => setEditing(null)}
        title={editing === 'new' ? 'New category' : 'Edit category'}
      >
        <div className="space-y-4">
          <div>
            <label className="mb-1.5 block text-sm text-muted">Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="neu-pressed w-full rounded-card border-none bg-surface px-4 py-3 text-primary outline-none focus:ring-1 focus:ring-accent"
            />
          </div>

          {editing === 'new' && (
            <div className="flex rounded-full bg-black/30 p-1">
              {(['expense', 'income'] as TxType[]).map((t) => (
                <button
                  key={t}
                  onClick={() => setType(t)}
                  className={`min-h-[44px] flex-1 rounded-full text-sm font-medium capitalize ${
                    type === t ? 'bg-accent' : 'text-muted'
                  }`}
                  style={type === t ? { color: '#0B0D10' } : undefined}
                >
                  {t}
                </button>
              ))}
            </div>
          )}

          <div>
            <label className="mb-1.5 block text-sm text-muted">Color</label>
            <div className="flex items-center gap-3">
              <input
                type="color"
                value={color}
                onChange={(e) => setColor(e.target.value)}
                className="h-11 w-14 cursor-pointer rounded-card border-none bg-transparent"
              />
              <span className="text-sm text-muted">{color}</span>
            </div>
          </div>

          <label className="flex min-h-[44px] items-center gap-2 text-sm text-primary">
            <input
              type="checkbox"
              checked={isBusiness}
              onChange={(e) => setIsBusiness(e.target.checked)}
              className="h-5 w-5 accent-[color:var(--accent)]"
            />
            Business category
          </label>

          <button
            onClick={handleSave}
            disabled={saving}
            className="neu-raised min-h-[44px] w-full rounded-card bg-accent py-3 font-medium disabled:opacity-60"
            style={{ color: '#0B0D10' }}
          >
            {saving ? 'Saving…' : 'Save category'}
          </button>

          {editing !== 'new' && editing && (
            <button
              onClick={async () => {
                await archiveCategory(editing.id, true)
                setEditing(null)
              }}
              className="min-h-[44px] w-full rounded-card py-3 text-sm font-medium text-muted"
            >
              Archive category
            </button>
          )}
        </div>
      </BottomSheet>
    </div>
  )
}
