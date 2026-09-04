import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import BottomSheet from './BottomSheet'
import PresetChip from './PresetChip'
import Toast from './Toast'
import Segmented from './Segmented'
import { useAuth } from '@/context/AuthContext'
import { useCategories } from '@/hooks/useCategories'
import { usePresets } from '@/hooks/usePresets'
import { addTransaction, updateTransaction } from '@/hooks/useTransactions'
import { useToast } from '@/hooks/useToast'
import { compressImage } from '@/lib/image'
import { db as supabase } from '@/lib/dataClient'
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
  const [formError, setFormError] = useState<string | null>(null)
  const wasOpen = useRef(false)

  const presets = presetsForType(type)

  const categoryTree = useMemo(() => {
    const visible = categories.filter((c) => c.type === type && !c.archived)
    const topLevel = visible.filter((c) => !c.parent_id)
    return topLevel.map((parent) => ({
      parent,
      children: visible.filter((c) => c.parent_id === parent.id),
    }))
  }, [categories, type])

  // Fresh form on every open — but NOT on type change, so switching
  // expense↔income mid-entry keeps the amount/date/notes already typed.
  useEffect(() => {
    if (open && !wasOpen.current) resetForm()
    wasOpen.current = open
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  function clearPhoto() {
    setPhotoFile(null)
    setPhotoPreview((prev) => {
      if (prev) URL.revokeObjectURL(prev)
      return null
    })
  }

  function resetForm() {
    setSelectedPresetId(null)
    setAmount('')
    setCategoryId('')
    setDate(todayISO())
    setPaymentMode('upi')
    setNotes('')
    clearPhoto()
    setSaveAsPreset(false)
    setPresetLabel('')
    setFormError(null)
  }

  function handleTypeChange(next: TxType) {
    setType(next)
    // Categories and presets are type-specific; everything else survives the switch.
    setCategoryId('')
    setSelectedPresetId(null)
    setFormError(null)
  }

  function handlePresetTap(preset: (typeof presets)[number]) {
    setSelectedPresetId(preset.id)
    setAmount(preset.amount.toFixed(2))
    setCategoryId(preset.category_id)
    setFormError(null)
  }

  function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setPhotoFile(file)
    setPhotoPreview((prev) => {
      if (prev) URL.revokeObjectURL(prev)
      return URL.createObjectURL(file)
    })
  }

  async function handleSave() {
    const parsedAmount = parseFloat(amount)
    if (!parsedAmount || parsedAmount <= 0) {
      setFormError('Enter an amount greater than zero.')
      return
    }
    if (!categoryId) {
      setFormError('Pick a category.')
      return
    }
    if (!date) {
      setFormError('Pick a date.')
      return
    }
    if (!session?.user) {
      setFormError('You are signed out — sign in again.')
      return
    }
    setFormError(null)
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

      let photoFailed = false
      if (photoFile) {
        try {
          const compressed = await compressImage(photoFile)
          const path = `${session.user.id}/${tx.id}.jpg`
          const { error: uploadError } = await supabase.storage
            .from('receipts')
            .upload(path, compressed, { contentType: 'image/jpeg', upsert: true })
          if (uploadError) throw uploadError
          await updateTransaction(tx.id, { receipt_url: path })
        } catch {
          photoFailed = true
        }
      }

      // Preset bookkeeping is best-effort — a failure here must never read as
      // "the transaction didn't save".
      try {
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
      } catch {
        // ignore — transaction itself saved fine
      }

      showToast(photoFailed ? 'Saved — but the photo upload failed' : 'Saved', photoFailed ? 3000 : 2200)
      onClose()
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Something went wrong — try again.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <>
      <BottomSheet open={open} onClose={onClose} title="Add transaction">
        <Segmented
          ariaLabel="Transaction type"
          size="md"
          className="mb-4"
          value={type}
          onChange={handleTypeChange}
          options={[
            { value: 'expense', label: 'Expense' },
            { value: 'income', label: 'Income' },
          ]}
        />

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
              min="0"
              step="0.01"
              placeholder="0.00"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="neu-pressed font-display tabular-nums w-full rounded-card border-none bg-surface px-4 py-3 text-2xl text-primary outline-none focus:ring-1 focus:ring-accent"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-sm text-muted">Category</label>
            {/* Aurum ships with no categories — a stock list of somebody else's
                spending is worse than none — so this is the real first-run state
                of this sheet, not a defensive branch. It has to name the way out,
                because there is no other control here that leads anywhere. */}
            {categoryTree.length === 0 ? (
              <div className="neu-pressed rounded-card px-4 py-4">
                <p className="text-[13px] leading-relaxed text-muted">
                  You have no {type === 'income' ? 'income' : 'expense'} categories yet. Aurum starts empty on
                  purpose — the first one takes about ten seconds.
                </p>
                <Link
                  to="/aurum/settings"
                  onClick={onClose}
                  className="mt-3 flex min-h-[44px] w-full items-center justify-center rounded-card text-[13.5px] font-semibold text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                  style={{ background: 'var(--accent)' }}
                >
                  Make a category
                </Link>
              </div>
            ) : (
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
                            categoryId === child.id ? 'bg-accent text-ink' : 'neu-raised text-primary'
                          }`}
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
                      categoryId === parent.id ? 'bg-accent text-ink' : 'neu-raised text-primary'
                    }`}
                  >
                    {parent.name}
                  </button>
                )
              )}
            </div>
            )}
          </div>

          <div className="flex gap-3">
            <div className="flex-1">
              <label className="mb-1.5 block text-sm text-muted">Date</label>
              <input
                type="date"
                value={date}
                max={todayISO()}
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
              {photoPreview && (
                <button onClick={clearPhoto} className="min-h-[44px] text-sm text-muted">
                  Remove
                </button>
              )}
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

          {formError && (
            <p role="alert" className="text-sm text-expense">
              {formError}
            </p>
          )}

          <button
            onClick={handleSave}
            disabled={submitting}
            className="neu-raised min-h-[44px] w-full rounded-card bg-accent py-3.5 font-medium text-ink disabled:opacity-60"
          >
            {submitting ? 'Saving…' : 'Save transaction'}
          </button>
        </div>
      </BottomSheet>
      <Toast message={message} />
    </>
  )
}
