import { useEffect, useState } from 'react'
import { formatCurrency } from '@/lib/format'

interface BalanceDialProps {
  netBalance: number
  budgetUsedPct: number // 0-100, overall monthly budget consumed
}

const SIZE = 260
const STROKE = 6
const RADIUS = (SIZE - STROKE) / 2
const CIRCUMFERENCE = 2 * Math.PI * RADIUS

/** Dashboard's one bold element: pressed neumorphic disc + animated brass progress ring. */
export default function BalanceDial({ netBalance, budgetUsedPct }: BalanceDialProps) {
  const [animatedPct, setAnimatedPct] = useState(0)
  const clamped = Math.min(100, Math.max(0, budgetUsedPct))

  useEffect(() => {
    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (prefersReduced) {
      setAnimatedPct(clamped)
      return
    }
    const raf = requestAnimationFrame(() => setAnimatedPct(clamped))
    return () => cancelAnimationFrame(raf)
  }, [clamped])

  const offset = CIRCUMFERENCE * (1 - animatedPct / 100)

  return (
    <div className="relative mx-auto flex items-center justify-center" style={{ width: SIZE, height: SIZE }}>
      <svg width={SIZE} height={SIZE} className="absolute -rotate-90">
        <circle
          cx={SIZE / 2}
          cy={SIZE / 2}
          r={RADIUS}
          fill="none"
          stroke="rgba(255,255,255,0.06)"
          strokeWidth={STROKE}
        />
        <circle
          cx={SIZE / 2}
          cy={SIZE / 2}
          r={RADIUS}
          fill="none"
          stroke="var(--accent)"
          strokeWidth={STROKE}
          strokeLinecap="round"
          strokeDasharray={CIRCUMFERENCE}
          strokeDashoffset={offset}
          style={{ transition: 'stroke-dashoffset 1.1s cubic-bezier(0.22, 1, 0.36, 1)' }}
        />
      </svg>
      <div
        className="neu-pressed flex flex-col items-center justify-center rounded-full text-center"
        style={{ width: SIZE - 40, height: SIZE - 40 }}
      >
        <span className="text-xs uppercase tracking-wide text-muted">This month</span>
        <span className="font-display tabular-nums mt-1 text-4xl font-bold text-primary">
          {formatCurrency(netBalance)}
        </span>
        <span className="mt-1 text-xs text-muted">{Math.round(clamped)}% of budget used</span>
      </div>
    </div>
  )
}
