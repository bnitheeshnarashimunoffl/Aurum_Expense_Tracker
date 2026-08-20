import { useState } from 'react'
import { AnimatePresence, motion, useReducedMotion, type PanInfo } from 'framer-motion'
import BalanceDial from './BalanceDial'
import { formatCurrency } from '@/lib/format'

interface SwipeableBalanceDialProps {
  monthNet: number
  monthBudgetPct: number
  hasBudget: boolean
  monthLoading: boolean
  totalNet: number
  totalIncome: number
  totalExpense: number
  totalLoading: boolean
}

const VIEWS = ['month', 'total'] as const
type View = (typeof VIEWS)[number]
const VIEW_LABEL: Record<View, string> = { month: 'This month', total: 'Total remaining' }

// Drag distance (px) past which a release commits to the next/previous page
// instead of springing back to where it started.
const SWIPE_THRESHOLD = 60

/**
 * Two-page swipeable Balance Dial:
 *  - "This month" — net for the current month, same as before (goes negative
 *    if no income was logged that month).
 *  - "Total remaining" — all-time net balance, independent of the month, with
 *    a ring showing lifetime spend as a share of lifetime income.
 * Swipe left/right on the dial itself, or tap a dot, to switch pages.
 */
export default function SwipeableBalanceDial({
  monthNet,
  monthBudgetPct,
  hasBudget,
  monthLoading,
  totalNet,
  totalIncome,
  totalExpense,
  totalLoading,
}: SwipeableBalanceDialProps) {
  const [index, setIndex] = useState(0)
  const reduceMotion = useReducedMotion()
  const view: View = VIEWS[index]

  const monthOver = hasBudget && monthBudgetPct > 100
  const monthCaption = !hasBudget
    ? 'No budgets set yet'
    : monthOver
      ? `Over budget · ${Math.round(monthBudgetPct)}%`
      : `${Math.round(monthBudgetPct)}% of budget used`

  const hasIncome = totalIncome > 0
  const burnPct = hasIncome ? (totalExpense / totalIncome) * 100 : 0
  const totalOver = hasIncome && burnPct > 100
  const totalCaption =
    totalIncome === 0 && totalExpense === 0
      ? 'Nothing logged yet'
      : `${formatCurrency(totalIncome)} in · ${formatCurrency(totalExpense)} out`

  function handleDragEnd(_event: unknown, info: PanInfo) {
    if (info.offset.x <= -SWIPE_THRESHOLD && index < VIEWS.length - 1) {
      setIndex(index + 1)
    } else if (info.offset.x >= SWIPE_THRESHOLD && index > 0) {
      setIndex(index - 1)
    }
  }

  return (
    <div>
      <motion.div
        drag="x"
        dragConstraints={{ left: 0, right: 0 }}
        dragElastic={0.65}
        onDragEnd={handleDragEnd}
        className="touch-pan-y cursor-grab active:cursor-grabbing"
      >
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={view}
            initial={reduceMotion ? false : { opacity: 0, x: view === 'total' ? 28 : -28 }}
            animate={{ opacity: 1, x: 0 }}
            exit={reduceMotion ? undefined : { opacity: 0, x: view === 'total' ? -28 : 28 }}
            transition={reduceMotion ? { duration: 0.12 } : { type: 'spring', stiffness: 380, damping: 32 }}
          >
            {view === 'month' ? (
              <BalanceDial
                label={VIEW_LABEL.month}
                netBalance={monthNet}
                ring={hasBudget ? { pct: monthBudgetPct, over: monthOver } : undefined}
                caption={monthCaption}
                captionTone={monthOver ? 'expense' : 'muted'}
                loading={monthLoading}
              />
            ) : (
              <BalanceDial
                label={VIEW_LABEL.total}
                netBalance={totalNet}
                ring={hasIncome ? { pct: burnPct, over: totalOver } : undefined}
                caption={totalCaption}
                captionTone={totalOver ? 'expense' : 'muted'}
                loading={totalLoading}
              />
            )}
          </motion.div>
        </AnimatePresence>
      </motion.div>

      <div role="tablist" aria-label="Balance view" className="mt-3 flex items-center justify-center gap-2">
        {VIEWS.map((v, i) => (
          <button
            key={v}
            role="tab"
            aria-selected={index === i}
            aria-label={VIEW_LABEL[v]}
            onClick={() => setIndex(i)}
            className={`h-1.5 rounded-full transition-all ${index === i ? 'w-5 bg-accent' : 'w-1.5 bg-white/15'}`}
          />
        ))}
      </div>
    </div>
  )
}
