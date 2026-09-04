import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useCategories } from '@/hooks/useCategories'
import { useTransactions } from '@/hooks/useTransactions'
import { db as supabase } from '@/lib/dataClient'
import { exportReportToPdf } from '@/lib/pdf'
import ExportReport, { type ReportTransaction } from '@/reports/ExportReport'
import Segmented from '@/components/Segmented'
import Toast from '@/components/Toast'
import { useToast } from '@/hooks/useToast'
import { formatDate, startOfMonthISO, startOfWeekISO, todayISO } from '@/lib/format'
import type { Scope } from '@/lib/types'

type Range = 'week' | 'month' | 'custom'
type ReportScope = 'income' | 'expense' | 'both'

/** Wait for every <img> in the container (receipt photos on signed URLs) to finish
 *  loading before html2canvas snapshots it — otherwise receipts render blank. */
async function waitForImages(container: HTMLElement, timeoutMs = 10000) {
  const images = Array.from(container.querySelectorAll('img'))
  const pending = images
    .filter((img) => !img.complete)
    .map(
      (img) =>
        new Promise<void>((resolve) => {
          img.onload = () => resolve()
          img.onerror = () => resolve()
        })
    )
  if (pending.length === 0) return
  await Promise.race([Promise.all(pending), new Promise((resolve) => setTimeout(resolve, timeoutMs))])
}

export default function ExportShare() {
  const [params] = useSearchParams()
  const initialRange = (params.get('range') as Range) || 'month'

  const [range, setRange] = useState<Range>(['week', 'month', 'custom'].includes(initialRange) ? initialRange : 'month')
  const [customFrom, setCustomFrom] = useState(startOfMonthISO())
  const [customTo, setCustomTo] = useState(todayISO())
  const [reportScope, setReportScope] = useState<ReportScope>('both')
  const [scope, setScope] = useState<Scope>('all')
  const [generating, setGenerating] = useState(false)
  const { message, showToast } = useToast()

  const { categories } = useCategories()

  const from = range === 'week' ? startOfWeekISO() : range === 'month' ? startOfMonthISO() : customFrom
  const to = range === 'custom' ? customTo : todayISO()
  const customRangeInvalid = range === 'custom' && Boolean(customFrom && customTo) && customFrom > customTo

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
    if (customRangeInvalid) return
    setGenerating(true)
    let container: HTMLDivElement | null = null
    let root: import('react-dom/client').Root | null = null
    try {
      // Resolve every receipt's signed URL BEFORE rendering the report, so the
      // snapshot never fires against unresolved placeholders.
      const withReceipts: ReportTransaction[] = await Promise.all(
        transactions.map(async (t) => {
          if (!t.receipt_url) return t
          const { data } = await supabase.storage.from('receipts').createSignedUrl(t.receipt_url, 60 * 10)
          return { ...t, signedReceiptUrl: data?.signedUrl ?? null }
        })
      )

      // Render into a detached container so html2canvas can snapshot the resolved report.
      container = document.createElement('div')
      container.style.position = 'fixed'
      container.style.left = '-9999px'
      container.style.top = '0'
      document.body.appendChild(container)

      const { createRoot } = await import('react-dom/client')
      root = createRoot(container)
      await new Promise<void>((resolve) => {
        root!.render(
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

      await waitForImages(container)

      const filename = `${reportScope}-${range}-${todayISO()}.pdf`
      await exportReportToPdf(container.firstElementChild as HTMLElement, filename)
    } catch (err) {
      // User dismissing the share sheet is a normal outcome, not an error.
      if (!(err instanceof DOMException && err.name === 'AbortError')) {
        showToast("Couldn't generate the PDF — try again.", 3000)
      }
    } finally {
      root?.unmount()
      if (container) document.body.removeChild(container)
      setGenerating(false)
    }
  }

  return (
    <div className="px-4 pt-4">
      <h1 className="font-display mb-4 text-2xl font-bold text-primary">Export & Share</h1>

      <section className="mb-5">
        <p className="mb-2 text-sm text-muted">Range</p>
        <Segmented
          ariaLabel="Range"
          value={range}
          onChange={setRange}
          options={[
            { value: 'week', label: 'This week' },
            { value: 'month', label: 'This month' },
            { value: 'custom', label: 'Custom' },
          ]}
        />
        {range === 'custom' && (
          <>
            <div className="mt-2 flex gap-2">
              <input
                type="date"
                value={customFrom}
                onChange={(e) => setCustomFrom(e.target.value)}
                aria-label="From date"
                className="neu-pressed min-h-[40px] flex-1 rounded-card border-none bg-surface px-3 text-xs text-primary outline-none"
              />
              <input
                type="date"
                value={customTo}
                onChange={(e) => setCustomTo(e.target.value)}
                aria-label="To date"
                className="neu-pressed min-h-[40px] flex-1 rounded-card border-none bg-surface px-3 text-xs text-primary outline-none"
              />
            </div>
            {customRangeInvalid && (
              <p role="alert" className="mt-2 text-xs text-expense">
                The start date is after the end date.
              </p>
            )}
          </>
        )}
      </section>

      <section className="mb-5">
        <p className="mb-2 text-sm text-muted">Report type</p>
        <Segmented
          ariaLabel="Report type"
          value={reportScope}
          onChange={setReportScope}
          options={[
            { value: 'income', label: 'Income only' },
            { value: 'expense', label: 'Expense only' },
            { value: 'both', label: 'Both combined' },
          ]}
        />
      </section>

      <section className="mb-6">
        <p className="mb-2 text-sm text-muted">Filter</p>
        <Segmented
          ariaLabel="Scope filter"
          value={scope}
          onChange={setScope}
          options={[
            { value: 'all', label: 'All' },
            { value: 'personal', label: 'Personal' },
            { value: 'business', label: 'Business' },
          ]}
        />
      </section>

      <p className="mb-4 text-xs text-muted">
        {transactions.length} transaction{transactions.length === 1 ? '' : 's'} in this report.
      </p>

      <button
        onClick={handleGenerate}
        disabled={generating || customRangeInvalid}
        className="neu-raised min-h-[44px] w-full rounded-card bg-accent py-3.5 font-medium text-ink disabled:opacity-60"
      >
        {generating ? 'Generating…' : 'Generate & share PDF'}
      </button>

      <Toast message={message} />
    </div>
  )
}
