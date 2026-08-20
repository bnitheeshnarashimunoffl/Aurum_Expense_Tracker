import { useEffect, useState } from 'react'
import { formatCurrency } from '@/lib/format'

interface DialRing {
  /** 0+, portion of "capacity" consumed for this view (budget %, or lifetime burn %). */
  pct: number
  over: boolean
}

interface BalanceDialProps {
  label: string
  netBalance: number
  /** Omit to show the track only, no progress arc — used when there's nothing to measure against. */
  ring?: DialRing
  caption: string
  captionTone?: 'muted' | 'expense'
  loading?: boolean
}

const SIZE = 260
const STROKE = 6
const RADIUS = (SIZE - STROKE) / 2
const CIRCUMFERENCE = 2 * Math.PI * RADIUS

/**
 * Dashboard's one bold element: pressed neumorphic disc + animated brass progress
 * ring. Purely presentational — the label/ring/caption are supplied by the caller
 * so the same disc can render either the "This month" or "Total remaining" page
 * of the swipeable dial.
 */
export default function BalanceDial({ label, netBalance, ring, caption, captionTone = 'muted', loading = false }: BalanceDialProps) {
  const [animatedPct, setAnimatedPct] = useState(0)
  const clamped = ring ? Math.min(100, Math.max(0, ring.pct)) : 0

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
        {ring && (
          <circle
            cx={SIZE / 2}
            cy={SIZE / 2}
            r={RADIUS}
            fill="none"
            stroke={ring.over ? 'var(--expense)' : 'var(--accent)'}
            strokeWidth={STROKE}
            strokeLinecap="round"
            strokeDasharray={CIRCUMFERENCE}
            strokeDashoffset={offset}
            style={{ transition: 'stroke-dashoffset 1.1s cubic-bezier(0.22, 1, 0.36, 1), stroke 0.4s ease' }}
          />
        )}
      </svg>
      <div
        className="neu-pressed flex flex-col items-center justify-center rounded-full text-center"
        style={{ width: SIZE - 40, height: SIZE - 40 }}
      >
        {loading ? (
          <>
            <span className="text-xs uppercase tracking-wide text-muted">{label}</span>
            <span className="skeleton mt-2 h-9 w-32 rounded-full" aria-label="Loading balance" />
            <span className="skeleton mt-2 h-3 w-24 rounded-full" />
          </>
        ) : (
          <>
            <span className="text-xs uppercase tracking-wide text-muted">{label}</span>
            <span
              className={`font-display tabular-nums mt-1 text-4xl font-bold ${
                netBalance < 0 ? 'text-expense' : 'text-primary'
              }`}
            >
              {formatCurrency(netBalance)}
            </span>
            <span className={`mt-1 px-6 text-xs ${captionTone === 'expense' ? 'text-expense' : 'text-muted'}`}>
              {caption}
            </span>
          </>
        )}
      </div>
    </div>
  )
}
