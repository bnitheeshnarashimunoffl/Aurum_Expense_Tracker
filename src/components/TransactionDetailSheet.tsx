import { useEffect, useState } from 'react'
import BottomSheet from './BottomSheet'
import { supabase } from '@/lib/supabase'
import { deleteTransaction } from '@/hooks/useTransactions'
import { formatDate } from '@/lib/format'
import type { Category, Transaction } from '@/lib/types'
import Amount from './Amount'
import CategoryColorDot from './CategoryColorDot'

interface TransactionDetailSheetProps {
  transaction: Transaction | null
  category?: Category
  onClose: () => void
}

export default function TransactionDetailSheet({ transaction, category, onClose }: TransactionDetailSheetProps) {
  // Keep the last-shown transaction rendered while the sheet slides out, so
  // closing doesn't snap the content away mid-exit-animation.
  const [view, setView] = useState<{ transaction: Transaction; category?: Category } | null>(null)
  const [signedUrl, setSignedUrl] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (transaction) {
      setView({ transaction, category })
      setConfirmingDelete(false)
      setError(null)
    }
  }, [transaction, category])

  useEffect(() => {
    setSignedUrl(null)
    if (!transaction?.receipt_url) return
    // Signed per-view with a 10-minute TTL; never persisted anywhere.
    supabase.storage
      .from('receipts')
      .createSignedUrl(transaction.receipt_url, 60 * 10)
      .then(({ data }) => {
        if (data?.signedUrl) setSignedUrl(data.signedUrl)
      })
  }, [transaction?.receipt_url])

  const tx = view?.transaction
  const cat = view?.category

  async function handleDelete() {
    if (!tx) return
    if (!confirmingDelete) {
      setConfirmingDelete(true)
      return
    }
    setDeleting(true)
    setError(null)
    try {
      await deleteTransaction(tx.id, tx.receipt_url)
      onClose()
    } catch {
      setError("Couldn't delete — check your connection and try again.")
      setConfirmingDelete(false)
    } finally {
      setDeleting(false)
    }
  }

  return (
    <BottomSheet open={!!transaction} onClose={onClose} title="Transaction">
      {tx && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-2 text-primary">
              <CategoryColorDot color={cat?.color ?? '#8A8F98'} size={12} />
              {cat?.name ?? 'Uncategorized'}
            </span>
            <Amount
              value={tx.type === 'income' ? tx.amount : -tx.amount}
              sign
              className={`text-lg font-semibold ${tx.type === 'income' ? 'text-income' : 'text-expense'}`}
            />
          </div>

          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <p className="text-muted">Date</p>
              <p className="text-primary">{formatDate(tx.date)}</p>
            </div>
            <div>
              <p className="text-muted">Scope</p>
              <p className="text-primary">{tx.is_business ? 'Business' : 'Personal'}</p>
            </div>
            {tx.payment_mode && (
              <div>
                <p className="text-muted">Payment</p>
                <p className="text-primary uppercase">{tx.payment_mode}</p>
              </div>
            )}
          </div>

          {tx.notes && (
            <div>
              <p className="text-sm text-muted">Notes</p>
              <p className="text-sm text-primary">{tx.notes}</p>
            </div>
          )}

          {tx.receipt_url && (
            <div>
              <p className="mb-1.5 text-sm text-muted">Receipt</p>
              {signedUrl ? (
                <img src={signedUrl} alt="Receipt" className="w-full rounded-card object-cover" />
              ) : (
                <div className="skeleton h-40 w-full" role="status" aria-label="Loading receipt" />
              )}
            </div>
          )}

          {error && <p className="text-sm text-expense">{error}</p>}

          <button
            onClick={handleDelete}
            disabled={deleting}
            className="neu-raised min-h-[44px] w-full rounded-card py-3 font-medium text-expense disabled:opacity-60"
          >
            {deleting ? 'Deleting…' : confirmingDelete ? 'Tap again to confirm' : 'Delete transaction'}
          </button>
        </div>
      )}
    </BottomSheet>
  )
}
