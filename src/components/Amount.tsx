import { formatCurrency } from '@/lib/format'

interface AmountProps {
  value: number
  className?: string
  sign?: boolean
}

/**
 * Shared money display — every rendered amount in the app goes through this so
 * the brief's "Space Grotesk for numbers" rule and tabular figures stay consistent.
 */
export default function Amount({ value, className = '', sign = false }: AmountProps) {
  const prefix = sign ? (value > 0 ? '+' : value < 0 ? '−' : '') : ''
  return (
    <span className={`font-display tabular-nums ${className}`}>
      {prefix}
      {formatCurrency(Math.abs(value))}
    </span>
  )
}
