const currencyFormatter = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 2,
})

export function formatCurrency(amount: number): string {
  return currencyFormatter.format(amount)
}

export function formatDate(dateStr: string): string {
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

export function formatDateShort(dateStr: string): string {
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
  })
}

// All of these must stay in LOCAL time. toISOString() converts to UTC, which for
// IST (+05:30) shifts local midnight back to the previous day — e.g. it made
// "start of month" resolve to the last day of the previous month, every time.
function toLocalISODate(d: Date): string {
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${month}-${day}`
}

export function todayISO(): string {
  return toLocalISODate(new Date())
}

/** Monday of the current week. */
export function startOfWeekISO(): string {
  const d = new Date()
  const day = d.getDay()
  d.setDate(d.getDate() - (day === 0 ? 6 : day - 1))
  return toLocalISODate(d)
}

export function startOfMonthISO(): string {
  const d = new Date()
  return toLocalISODate(new Date(d.getFullYear(), d.getMonth(), 1))
}
