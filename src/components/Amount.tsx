import { formatCurrency } from '@/lib/format'

interface AmountProps {
  value: number
  className?: string
  sign?: boolean
}

/** Shared money display — every rendered amount in the app goes through this so tabular-nums stays consistent. */
export default function Amount({ value, className = '', sign = false }: AmountProps) {
  const prefix = sign ? (value > 0 ? '+' : value < 0 ? '−' : '') : ''
  return (
    <span className={`tabular-nums ${className}`}>
      {prefix}
      {formatCurrency(Math.abs(value))}
    </span>
  )
}
