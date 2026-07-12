import { useEffect, useMemo, useState } from 'react'
import BottomSheet from './BottomSheet'
import PresetChip from './PresetChip'
import Toast from './Toast'
import { useAuth } from '@/context/AuthContext'
import { useCategories } from '@/hooks/useCategories'
import { usePresets } from '@/hooks/usePresets'
import { useTransactions } from '@/hooks/useTransactions'
import { useToast } from '@/hooks/useToast'
import { compressImage } from '@/lib/image'
import { supabase } from '@/lib/supabase'
import { todayISO } from '@/lib/format'
import type { PaymentMode, TxType } from '@/lib/types'

interface AddTransactionSheetProps {
  open: boolean
  onClose: () => void
}

const PAYMENT_MODES: PaymentMode[] = ['cash', 'upi', 'card']

export default function AddTransactionSheet({ open, onClose }: AddTransactionSheetProps) {
  const { session } = useAuth()
  const { categories } = useCategories()
  const { presetsForType, addPreset, recordUse } = usePresets()
  const { addTransaction, updateTransaction } = useTransactions()
  const { message, showToast } = useToast()

  const [type, setType] = useState<TxType>('expense')
  const [selectedPresetId, setSelectedPresetId] = useState<string | null>(null)
  const [amount, setAmount] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [date, setDate] = useState(todayISO())
  const [paymentMode, setPaymentMode] = useState<PaymentMode>('upi')
  const [notes, setNotes] = useState('')
  const [photoFile, setPhotoFile] = useState<File | null>(null)
  const [photoPreview, setPhotoPreview] = useState<string | null>(null)
  const [saveAsPreset, setSaveAsPreset] = useState(false)
  const [presetLabel, setPresetLabel] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const presets = presetsForType(type)

  const categoryTree = useMemo(() => {
    const visible = categories.filter((c) => c.type === type && !c.archived)
    const topLevel = visible.filter((c) => !c.parent_id)
    return topLevel.map((parent) => ({
      parent,
      children: visible.filter((c) => c.parent_id === parent.id),
    }))
  }, [categories, type])

  useEffect(() => {
    if (!open) return
    resetForm()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, type])

  function resetForm() {
    setSelectedPresetId(null)
    setAmount('')
    setCategoryId('')
    setDate(todayISO())
    setPaymentMode('upi')
    setNotes('')
    setPhotoFile(null)
    setPhotoPreview(null)
    setSaveAsPreset(false)
    setPresetLabel('')
  }

  function handlePresetTap(preset: (typeof presets)[number]) {
    setSelectedPresetId(preset.id)
    setAmount(preset.amount.toFixed(2))
    setCategoryId(preset.category_id)
  }

  function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setPhotoFile(file)
    setPhotoPreview(URL.createObjectURL(file))
  }

  async function handleSave() {
    const parsedAmount = parseFloat(amount)
    if (!parsedAmount || parsedAmount <= 0 || !categoryId || !session?.user) {
      showToast('Enter an amount and pick a category', 2500)
      return
    }
    setSubmitting(true)
    try {
      const category = categories.find((c) => c.id === categoryId)
      const tx = await addTransaction({
        amount: parsedAmount,
        type,
        category_id: categoryId,
        date,
        notes: notes || null,
        payment_mode: type === 'expense' ? paymentMode : null,
        is_business: category?.is_business ?? false,
        preset_id: selectedPresetId,
        receipt_url: null,
      })

      if (photoFile) {
        const compressed = await compressImage(photoFile)
        const path = `${session.user.id}/${tx.id}.jpg`
        const { error: uploadError } = await supabase.storage
          .from('receipts')
          .upload(path, compressed, { contentType: 'image/jpeg', upsert: true })
        if (!uploadError) {
          await updateTransaction(tx.id, { receipt_url: path })
        }
      }

      if (selectedPresetId) {
        await recordUse(selectedPresetId)
      } else if (saveAsPreset && presetLabel.trim()) {
        await addPreset({
          label: presetLabel.trim(),
          amount: parsedAmount,
          category_id: categoryId,
          type,
          is_business: category?.is_business ?? false,
        })
      }

      showToast('Saved')
      onClose()
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Something went wrong', 3000)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <>
      <BottomSheet open={open} onClose={onClose} title="Add transaction">
        <div className="mb-4 flex rounded-full bg-black/30 p-1">
          {(['expense', 'income'] as TxType[]).map((t) => (
            <button
              key={t}
              onClick={() => {
                setType(t)
              }}
              className={`min-h-[44px] flex-1 rounded-full text-sm font-medium capitalize transition-colors ${
                type === t ? 'bg-accent' : 'text-muted'
              }`}
              style={type === t ? { color: '#0B0D10' } : undefined}
            >
              {t}
            </button>
          ))}
        </div>

        {presets.length > 0 && (
          <div className="mb-4 -mx-5 flex gap-2 overflow-x-auto px-5 pb-1">
            {presets.map((preset) => (
              <PresetChip
                key={preset.id}
                preset={preset}
                active={selectedPresetId === preset.id}
                onClick={() => handlePresetTap(preset)}
              />
            ))}
          </div>
        )}

        <div className="space-y-4">
          <div>
            <label className="mb-1.5 block text-sm text-muted">Amount</label>
            <input
              type="number"
              inputMode="decimal"
              placeholder="0.00"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="neu-pressed font-display tabular-nums w-full rounded-card border-none bg-surface px-4 py-3 text-2xl text-primary outline-none focus:ring-1 focus:ring-accent"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-sm text-muted">Category</label>
            <div className="flex flex-wrap gap-2">
              {categoryTree.map(({ parent, children }) =>
                children.length > 0 ? (
                  <div key={parent.id} className="w-full">
                    <p className="mb-1.5 text-xs text-muted">{parent.name}</p>
                    <div className="flex flex-wrap gap-2">
                      {children.map((child) => (
                        <button
                          key={child.id}
                          onClick={() => setCategoryId(child.id)}
                          className={`min-h-[44px] rounded-full px-3 py-2 text-sm ${
                            categoryId === child.id ? 'bg-accent' : 'neu-raised text-primary'
                          }`}
                          style={categoryId === child.id ? { color: '#0B0D10' } : undefined}
                        >
                          {child.name}
                        </button>
                      ))}
                    </div>
                  </div>
                ) : (
                  <button
                    key={parent.id}
                    onClick={() => setCategoryId(parent.id)}
                    className={`min-h-[44px] rounded-full px-3 py-2 text-sm ${
                      categoryId === parent.id ? 'bg-accent' : 'neu-raised text-primary'
                    }`}
                    style={categoryId === parent.id ? { color: '#0B0D10' } : undefined}
                  >
                    {parent.name}
                  </button>
                )
              )}
            </div>
          </div>

          <div className="flex gap-3">
            <div className="flex-1">
              <label className="mb-1.5 block text-sm text-muted">Date</label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="neu-pressed w-full rounded-card border-none bg-surface px-3 py-3 text-sm text-primary outline-none focus:ring-1 focus:ring-accent"
              />
            </div>
            {type === 'expense' && (
              <div className="flex-1">
                <label className="mb-1.5 block text-sm text-muted">Payment</label>
                <select
                  value={paymentMode}
                  onChange={(e) => setPaymentMode(e.target.value as PaymentMode)}
                  className="neu-pressed w-full rounded-card border-none bg-surface px-3 py-3 text-sm text-primary outline-none focus:ring-1 focus:ring-accent"
                >
                  {PAYMENT_MODES.map((mode) => (
                    <option key={mode} value={mode} className="capitalize">
                      {mode.toUpperCase()}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          <div>
            <label className="mb-1.5 block text-sm text-muted">Notes (optional)</label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="neu-pressed w-full rounded-card border-none bg-surface px-4 py-3 text-sm text-primary outline-none focus:ring-1 focus:ring-accent"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-sm text-muted">Bill photo (optional)</label>
            <div className="flex items-center gap-3">
              {photoPreview && (
                <img src={photoPreview} alt="Receipt preview" className="h-14 w-14 rounded-card object-cover" />
              )}
              <label className="neu-raised flex min-h-[44px] cursor-pointer items-center rounded-card px-4 py-2 text-sm text-primary">
                {photoPreview ? 'Change photo' : 'Attach photo'}
                <input type="file" accept="image/*" capture="environment" onChange={handlePhotoChange} className="hidden" />
              </label>
            </div>
          </div>

          {!selectedPresetId && (
            <label className="flex min-h-[44px] items-center gap-2 text-sm text-primary">
              <input
                type="checkbox"
                checked={saveAsPreset}
                onChange={(e) => setSaveAsPreset(e.target.checked)}
                className="h-5 w-5 accent-[color:var(--accent)]"
              />
              Save as preset
            </label>
          )}
          {saveAsPreset && !selectedPresetId && (
            <input
              type="text"
              placeholder="Preset label (e.g. SKT Group Retainer)"
              value={presetLabel}
              onChange={(e) => setPresetLabel(e.target.value)}
              className="neu-pressed w-full rounded-card border-none bg-surface px-4 py-3 text-sm text-primary outline-none focus:ring-1 focus:ring-accent"
            />
          )}

          <button
            onClick={handleSave}
            disabled={submitting}
            className="neu-raised min-h-[44px] w-full rounded-card bg-accent py-3.5 font-medium disabled:opacity-60"
            style={{ color: '#0B0D10' }}
          >
            {submitting ? 'Saving…' : 'Save transaction'}
          </button>
        </div>
      </BottomSheet>
      <Toast message={message} />
    </>
  )
}
