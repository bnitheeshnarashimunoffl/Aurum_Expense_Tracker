/**
 * How a timestamp reads in a list row. Relative near the present and absolute
 * beyond it: "4h ago" is what you want on something you touched this morning, and
 * useless on something from March.
 */
export function formatStamp(iso: string, now: Date = new Date()): string {
  const then = new Date(iso)
  const minutes = Math.floor((now.getTime() - then.getTime()) / 60_000)

  if (minutes < 1) return 'Just now'
  if (minutes < 60) return `${minutes}m ago`

  const hours = Math.floor(minutes / 60)
  if (hours < 24 && then.getDate() === now.getDate()) return `${hours}h ago`

  const yesterday = new Date(now)
  yesterday.setDate(now.getDate() - 1)
  if (then.toDateString() === yesterday.toDateString()) return 'Yesterday'

  const sameYear = then.getFullYear() === now.getFullYear()
  return then.toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    ...(sameYear ? {} : { year: 'numeric' }),
  })
}
