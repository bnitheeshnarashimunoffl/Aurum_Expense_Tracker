import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useCategories } from '@/hooks/useCategories'
import { useTransactions } from '@/hooks/useTransactions'
import { supabase } from '@/lib/supabase'
import { exportReportToPdf } from '@/lib/pdf'
import ExportReport, { type ReportTransaction } from '@/reports/ExportReport'
import { formatDate, startOfMonthISO, startOfWeekISO, todayISO } from '@/lib/format'
import type { Scope } from '@/lib/types'

type Range = 'week' | 'month' | 'custom'
type ReportScope = 'income' | 'expense' | 'both'

export default function ExportShare() {
  const [params] = useSearchParams()
  const initialRange = (params.get('range') as Range) || 'month'

  const [range, setRange] = useState<Range>(initialRange)
  const [customFrom, setCustomFrom] = useState(startOfMonthISO())
  const [customTo, setCustomTo] = useState(todayISO())
  const [reportScope, setReportScope] = useState<ReportScope>('both')
  const [scope, setScope] = useState<Scope>('all')
  const [generating, setGenerating] = useState(false)

  const { categories } = useCategories()

  const from = range === 'week' ? startOfWeekISO() : range === 'month' ? startOfMonthISO() : customFrom
  const to = range === 'custom' ? customTo : todayISO()

  const { transactions } = useTransactions({
    from,
    to,
    scope: scope === 'all' ? undefined : scope,
    type: reportScope === 'both' ? undefined : reportScope,
  })

  const rangeLabel =
    range === 'week' ? 'This week' : range === 'month' ? 'This month' : `${formatDate(from)} – ${formatDate(to)}`
  const filterLabel = scope === 'all' ? 'All' : scope === 'personal' ? 'Personal only' : 'Business only'

  async function handleGenerate() {
    setGenerating(true)
    try {
      const withReceipts: ReportTransaction[] = await Promise.all(
        transactions.map(async (t) => {
          if (!t.receipt_url) return t
          const { data } = await supabase.storage.from('receipts').createSignedUrl(t.receipt_url, 60 * 10)
          return { ...t, signedReceiptUrl: data?.signedUrl ?? null }
        })
      )

      // Render into a detached container so html2canvas can snapshot the resolved report.
      const container = document.createElement('div')
      container.style.position = 'fixed'
      container.style.left = '-9999px'
      container.style.top = '0'
      document.body.appendChild(container)

      const { createRoot } = await import('react-dom/client')
      const root = createRoot(container)
      await new Promise<void>((resolve) => {
        root.render(
          <ExportReport
            rangeLabel={rangeLabel}
            scope={reportScope}
            filterLabel={filterLabel}
            transactions={withReceipts}
            categories={categories}
            generatedOn={formatDate(todayISO())}
          />
        )
        requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
      })

      const filename = `${reportScope}-${range}-${todayISO()}.pdf`
      await exportReportToPdf(container.firstElementChild as HTMLElement, filename)

      root.unmount()
      document.body.removeChild(container)
    } finally {
      setGenerating(false)
    }
  }

  return (
    <div className="px-4 pt-4">
      <h1 className="font-display mb-4 text-2xl font-bold text-primary">Export & Share</h1>

      <section className="mb-5">
        <p className="mb-2 text-sm text-muted">Range</p>
        <div className="flex gap-2">
          {(['week', 'month', 'custom'] as Range[]).map((r) => (
            <button
              key={r}
              onClick={() => setRange(r)}
              className={`min-h-[40px] flex-1 rounded-full text-xs font-medium capitalize ${
                range === r ? 'bg-accent' : 'neu-raised text-muted'
              }`}
              style={range === r ? { color: '#0B0D10' } : undefined}
            >
              {r === 'week' ? 'This week' : r === 'month' ? 'This month' : 'Custom'}
            </button>
          ))}
        </div>
        {range === 'custom' && (
          <div className="mt-2 flex gap-2">
            <input
              type="date"
              value={customFrom}
              onChange={(e) => setCustomFrom(e.target.value)}
              className="neu-pressed min-h-[40px] flex-1 rounded-card border-none bg-surface px-3 text-xs text-primary outline-none"
            />
            <input
              type="date"
              value={customTo}
              onChange={(e) => setCustomTo(e.target.value)}
              className="neu-pressed min-h-[40px] flex-1 rounded-card border-none bg-surface px-3 text-xs text-primary outline-none"
            />
          </div>
        )}
      </section>

      <section className="mb-5">
        <p className="mb-2 text-sm text-muted">Report type</p>
        <div className="flex gap-2">
          {(['income', 'expense', 'both'] as ReportScope[]).map((s) => (
            <button
              key={s}
              onClick={() => setReportScope(s)}
              className={`min-h-[40px] flex-1 rounded-full text-xs font-medium capitalize ${
                reportScope === s ? 'bg-accent' : 'neu-raised text-muted'
              }`}
              style={reportScope === s ? { color: '#0B0D10' } : undefined}
            >
              {s === 'both' ? 'Both combined' : `${s} only`}
            </button>
          ))}
        </div>
      </section>

      <section className="mb-6">
        <p className="mb-2 text-sm text-muted">Filter</p>
        <div className="flex gap-2">
          {(['all', 'personal', 'business'] as Scope[]).map((s) => (
            <button
              key={s}
              onClick={() => setScope(s)}
              className={`min-h-[40px] flex-1 rounded-full text-xs font-medium capitalize ${
                scope === s ? 'bg-accent' : 'neu-raised text-muted'
              }`}
              style={scope === s ? { color: '#0B0D10' } : undefined}
            >
              {s}
            </button>
          ))}
        </div>
      </section>

      <p className="mb-4 text-xs text-muted">
        {transactions.length} transaction{transactions.length === 1 ? '' : 's'} in this report.
      </p>

      <button
        onClick={handleGenerate}
        disabled={generating}
        className="neu-raised min-h-[44px] w-full rounded-card bg-accent py-3.5 font-medium disabled:opacity-60"
        style={{ color: '#0B0D10' }}
      >
        {generating ? 'Generating…' : 'Generate & share PDF'}
      </button>
    </div>
  )
}
