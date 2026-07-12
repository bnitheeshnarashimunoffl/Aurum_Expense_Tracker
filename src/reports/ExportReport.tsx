import { forwardRef } from 'react'
import type { Category, Transaction } from '@/lib/types'
import { formatCurrency, formatDate } from '@/lib/format'

export interface ReportTransaction extends Transaction {
  signedReceiptUrl?: string | null
}

export interface ExportReportProps {
  rangeLabel: string
  scope: 'income' | 'expense' | 'both'
  filterLabel: string
  transactions: ReportTransaction[]
  categories: Category[]
  generatedOn: string
}

/**
 * Print-friendly statement view — deliberately light/serif, NOT the app's dark neumorphic UI.
 * Rendered offscreen and snapshotted by html2canvas via html2pdf.
 */
const ExportReport = forwardRef<HTMLDivElement, ExportReportProps>(function ExportReport(
  { rangeLabel, scope, filterLabel, transactions, categories, generatedOn },
  ref
) {
  const categoryById = new Map(categories.map((c) => [c.id, c]))

  const income = transactions.filter((t) => t.type === 'income')
  const expense = transactions.filter((t) => t.type === 'expense')
  const totalIncome = income.reduce((s, t) => s + t.amount, 0)
  const totalExpense = expense.reduce((s, t) => s + t.amount, 0)

  const groupByCategory = (list: ReportTransaction[]) => {
    const groups = new Map<string, ReportTransaction[]>()
    for (const t of list) {
      if (!groups.has(t.category_id)) groups.set(t.category_id, [])
      groups.get(t.category_id)!.push(t)
    }
    return Array.from(groups.entries()).map(([categoryId, items]) => ({
      category: categoryById.get(categoryId),
      items,
      subtotal: items.reduce((s, t) => s + t.amount, 0),
    }))
  }

  const sections: { title: string; groups: ReturnType<typeof groupByCategory> }[] = []
  if (scope === 'income' || scope === 'both') sections.push({ title: 'Income', groups: groupByCategory(income) })
  if (scope === 'expense' || scope === 'both') sections.push({ title: 'Expenses', groups: groupByCategory(expense) })

  return (
    <div
      ref={ref}
      style={{
        width: '794px',
        padding: '56px',
        background: '#ffffff',
        color: '#1a1a1a',
        fontFamily: 'Georgia, "Times New Roman", serif',
      }}
    >
      <div style={{ borderBottom: '2px solid #1a1a1a', paddingBottom: 20, marginBottom: 28 }}>
        <h1 style={{ fontSize: 28, margin: 0, letterSpacing: 0.5 }}>Aurum — Statement</h1>
        <p style={{ margin: '6px 0 0', fontSize: 13, color: '#555' }}>
          {rangeLabel} · {filterLabel} · generated {generatedOn}
        </p>
      </div>

      <div style={{ display: 'flex', gap: 32, marginBottom: 32, fontSize: 14 }}>
        {(scope === 'income' || scope === 'both') && (
          <div>
            <p style={{ margin: 0, color: '#666', fontSize: 12, textTransform: 'uppercase' }}>Total income</p>
            <p style={{ margin: '4px 0 0', fontSize: 20, fontWeight: 'bold' }}>{formatCurrency(totalIncome)}</p>
          </div>
        )}
        {(scope === 'expense' || scope === 'both') && (
          <div>
            <p style={{ margin: 0, color: '#666', fontSize: 12, textTransform: 'uppercase' }}>Total expenses</p>
            <p style={{ margin: '4px 0 0', fontSize: 20, fontWeight: 'bold' }}>{formatCurrency(totalExpense)}</p>
          </div>
        )}
        {scope === 'both' && (
          <div>
            <p style={{ margin: 0, color: '#666', fontSize: 12, textTransform: 'uppercase' }}>Net</p>
            <p style={{ margin: '4px 0 0', fontSize: 20, fontWeight: 'bold' }}>
              {formatCurrency(totalIncome - totalExpense)}
            </p>
          </div>
        )}
      </div>

      {sections.map((section) => (
        <div key={section.title} style={{ marginBottom: 28 }}>
          <h2 style={{ fontSize: 16, borderBottom: '1px solid #ccc', paddingBottom: 8, marginBottom: 12 }}>
            {section.title}
          </h2>
          {section.groups.length === 0 ? (
            <p style={{ color: '#888', fontSize: 13 }}>None in this range.</p>
          ) : (
            section.groups.map((group) => (
              <div key={group.category?.id ?? 'unknown'} style={{ marginBottom: 16 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                  <span
                    style={{
                      width: 10,
                      height: 10,
                      borderRadius: '50%',
                      background: group.category?.color ?? '#999',
                      display: 'inline-block',
                    }}
                  />
                  <strong style={{ fontSize: 14 }}>{group.category?.name ?? 'Uncategorized'}</strong>
                  <span style={{ marginLeft: 'auto', fontSize: 14 }}>{formatCurrency(group.subtotal)}</span>
                </div>
                {group.items.map((t) => (
                  <div
                    key={t.id}
                    style={{
                      display: 'flex',
                      gap: 12,
                      alignItems: 'flex-start',
                      padding: '8px 0',
                      borderBottom: '1px solid #eee',
                      fontSize: 13,
                    }}
                  >
                    <span style={{ width: 90, color: '#666' }}>{formatDate(t.date)}</span>
                    <span style={{ flex: 1, color: '#333' }}>{t.notes || '—'}</span>
                    <span style={{ width: 90, textAlign: 'right' }}>{formatCurrency(t.amount)}</span>
                    {t.signedReceiptUrl && (
                      <img
                        src={t.signedReceiptUrl}
                        alt="Receipt"
                        style={{ width: 64, height: 64, objectFit: 'cover', borderRadius: 4 }}
                      />
                    )}
                  </div>
                ))}
              </div>
            ))
          )}
        </div>
      ))}
    </div>
  )
})

export default ExportReport
