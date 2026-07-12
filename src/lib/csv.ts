import type { Category, Transaction } from './types'

export function transactionsToCSV(transactions: Transaction[], categories: Category[]): string {
  const categoryById = new Map(categories.map((c) => [c.id, c]))
  const header = ['Date', 'Type', 'Category', 'Amount', 'Payment Mode', 'Personal/Business', 'Notes']
  const rows = transactions.map((t) => {
    const category = categoryById.get(t.category_id)
    return [
      t.date,
      t.type,
      category?.name ?? 'Unknown',
      t.amount.toFixed(2),
      t.payment_mode ?? '',
      t.is_business ? 'Business' : 'Personal',
      (t.notes ?? '').replace(/"/g, '""'),
    ]
  })

  const escapeCell = (cell: string) => (/[",\n]/.test(cell) ? `"${cell}"` : cell)
  return [header, ...rows].map((row) => row.map(escapeCell).join(',')).join('\n')
}

export function downloadCSV(csv: string, filename: string) {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
