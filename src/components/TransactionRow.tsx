import type { Category, Transaction } from '@/lib/types'
import Amount from './Amount'
import CategoryColorDot from './CategoryColorDot'
import { formatDateShort } from '@/lib/format'

interface TransactionRowProps {
  transaction: Transaction
  category?: Category
  onClick?: () => void
}

export default function TransactionRow({ transaction, category, onClick }: TransactionRowProps) {
  const isIncome = transaction.type === 'income'
  return (
    <button
      onClick={onClick}
      className="neu-raised flex w-full min-h-[56px] items-center justify-between gap-3 rounded-card px-4 py-3 text-left"
    >
      <div className="flex min-w-0 items-center gap-3">
        <CategoryColorDot color={category?.color ?? '#8A8F98'} size={12} />
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-primary">{category?.name ?? 'Uncategorized'}</p>
          <p className="truncate text-xs text-muted">
            {formatDateShort(transaction.date)}
            {transaction.notes ? ` · ${transaction.notes}` : ''}
          </p>
        </div>
      </div>
      <div className="flex flex-shrink-0 items-center gap-2">
        {transaction.receipt_url && (
          <span className="text-muted" title="Has receipt photo" aria-label="Has receipt photo">
            📎
          </span>
        )}
        <Amount
          value={isIncome ? transaction.amount : -transaction.amount}
          sign
          className={`text-sm font-medium ${isIncome ? 'text-income' : 'text-expense'}`}
        />
      </div>
    </button>
  )
}
