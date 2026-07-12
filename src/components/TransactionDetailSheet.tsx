import { useEffect, useState } from 'react'
import BottomSheet from './BottomSheet'
import { supabase } from '@/lib/supabase'
import { formatDate } from '@/lib/format'
import type { Category, Transaction } from '@/lib/types'
import Amount from './Amount'
import CategoryColorDot from './CategoryColorDot'

interface TransactionDetailSheetProps {
  transaction: Transaction | null
  category?: Category
  onClose: () => void
  onDelete: (id: string) => Promise<void>
}

export default function TransactionDetailSheet({
  transaction,
  category,
  onClose,
  onDelete,
}: TransactionDetailSheetProps) {
  const [signedUrl, setSignedUrl] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    setSignedUrl(null)
    if (!transaction?.receipt_url) return
    supabase.storage
      .from('receipts')
      .createSignedUrl(transaction.receipt_url, 60 * 10)
      .then(({ data }) => {
        if (data?.signedUrl) setSignedUrl(data.signedUrl)
      })
  }, [transaction?.receipt_url])

  if (!transaction) return null

  async function handleDelete() {
    if (!transaction) return
    setDeleting(true)
    await onDelete(transaction.id)
    setDeleting(false)
    onClose()
  }

  return (
    <BottomSheet open={!!transaction} onClose={onClose} title="Transaction">
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-2 text-primary">
            <CategoryColorDot color={category?.color ?? '#8A8F98'} size={12} />
            {category?.name ?? 'Uncategorized'}
          </span>
          <Amount
            value={transaction.type === 'income' ? transaction.amount : -transaction.amount}
            sign
            className={`font-display text-lg font-semibold ${
              transaction.type === 'income' ? 'text-income' : 'text-expense'
            }`}
          />
        </div>

        <div className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <p className="text-muted">Date</p>
            <p className="text-primary">{formatDate(transaction.date)}</p>
          </div>
          <div>
            <p className="text-muted">Scope</p>
            <p className="text-primary">{transaction.is_business ? 'Business' : 'Personal'}</p>
          </div>
          {transaction.payment_mode && (
            <div>
              <p className="text-muted">Payment</p>
              <p className="text-primary uppercase">{transaction.payment_mode}</p>
            </div>
          )}
        </div>

        {transaction.notes && (
          <div>
            <p className="text-sm text-muted">Notes</p>
            <p className="text-sm text-primary">{transaction.notes}</p>
          </div>
        )}

        {signedUrl && (
          <div>
            <p className="mb-1.5 text-sm text-muted">Receipt</p>
            <img src={signedUrl} alt="Receipt" className="w-full rounded-card object-cover" />
          </div>
        )}

        <button
          onClick={handleDelete}
          disabled={deleting}
          className="neu-raised min-h-[44px] w-full rounded-card py-3 font-medium text-expense disabled:opacity-60"
        >
          {deleting ? 'Deleting…' : 'Delete transaction'}
        </button>
      </div>
    </BottomSheet>
  )
}
