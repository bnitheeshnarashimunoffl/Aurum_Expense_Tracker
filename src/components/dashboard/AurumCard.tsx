import { useRef, useState } from 'react'
import { AnimatePresence, motion, useReducedMotion, type PanInfo } from 'framer-motion'
import SummaryCard, { CardCaption, CardSkeleton } from './SummaryCard'
import { useTransactions } from '@/hooks/useTransactions'
import { useAllTimeBalance } from '@/hooks/useAllTimeBalance'
import { formatCurrency, startOfMonthISO, todayISO } from '@/lib/format'

const ACCENT = 'var(--accent)'
const GLOW = 'rgba(201, 164, 106, 0.10)'

const VIEWS = ['month', 'total'] as const
type View = (typeof VIEWS)[number]

/** Past this many px of horizontal travel, a release commits to the other page. */
const SWIPE_THRESHOLD = 52
/**
 * How long after a drag ends the card refuses to treat a click as a tap. A
 * finished swipe fires a click on the same gesture, and without this every swipe
 * would also open Aurum. A timestamp rather than a flag because it clears itself
 * — a flag left set would swallow the next real tap instead.
 */
const TAP_SUPPRESSION_MS = 260

/**
 * Aurum's card, and the only interactive one: swipe it sideways for the all-time
 * balance. That mirrors the swipeable dial on Aurum's own home screen
 * (SwipeableBalanceDial), which is the point — the two numbers are a pair, and
 * having to open the app to see the second one would defeat the card.
 *
 * Two things make the gesture behave rather than fight the page:
 *   `dragDirectionLock` + touch-action pan-y, so a vertical scroll that starts on
 *   the card scrolls the launcher instead of being eaten; and a movement
 *   threshold that cancels the card's own tap-to-open, so finishing a swipe never
 *   drops you inside Aurum.
 */
export default function AurumCard() {
  const reduceMotion = useReducedMotion()
  const [index, setIndex] = useState(0)
  const lastDragEnd = useRef(0)

  const { transactions, loading: monthLoading } = useTransactions({ from: startOfMonthISO(), to: todayISO() })
  const { net: totalNet, income: totalIncome, expense: totalExpense, loading: totalLoading } = useAllTimeBalance('all')

  const monthIncome = transactions.filter((t) => t.type === 'income').reduce((sum, t) => sum + t.amount, 0)
  const monthExpense = transactions.filter((t) => t.type === 'expense').reduce((sum, t) => sum + t.amount, 0)
  const monthNet = monthIncome - monthExpense

  const view: View = VIEWS[index]
  const loading = view === 'month' ? monthLoading : totalLoading
  const net = view === 'month' ? monthNet : totalNet
  const income = view === 'month' ? monthIncome : totalIncome
  const expense = view === 'month' ? monthExpense : totalExpense

  function handleDragEnd(_event: unknown, info: PanInfo) {
    lastDragEnd.current = Date.now()
    if (info.offset.x <= -SWIPE_THRESHOLD && index < VIEWS.length - 1) setIndex(index + 1)
    else if (info.offset.x >= SWIPE_THRESHOLD && index > 0) setIndex(index - 1)
  }

  return (
    <SummaryCard
      to="/aurum"
      label="Aurum"
      accent={ACCENT}
      glow={GLOW}
      shouldBlockNavigation={() => Date.now() - lastDragEnd.current < TAP_SUPPRESSION_MS}
    >
      <motion.div
        drag="x"
        dragDirectionLock
        dragConstraints={{ left: 0, right: 0 }}
        dragElastic={0.5}
        onDragEnd={handleDragEnd}
        // pan-y hands vertical movement back to the page, so the launcher still
        // scrolls when a scroll happens to begin on this card.
        className="touch-pan-y"
      >
        <div className="flex items-end justify-between gap-3">
          <div className="min-w-0 flex-1">
            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={view}
                initial={reduceMotion ? false : { opacity: 0, x: view === 'total' ? 20 : -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={reduceMotion ? undefined : { opacity: 0, x: view === 'total' ? -20 : 20 }}
                transition={reduceMotion ? { duration: 0.1 } : { type: 'spring', stiffness: 420, damping: 34 }}
              >
                {loading ? (
                  <CardSkeleton />
                ) : (
                  <>
                    <p className="text-[11px] text-muted">{view === 'month' ? 'This month' : 'All time'}</p>
                    <p
                      className={`font-display tabular-nums text-[26px] font-bold leading-tight ${
                        net < 0 ? 'text-expense' : 'text-primary'
                      }`}
                    >
                      {formatCurrency(net)}
                    </p>
                    <CardCaption>
                      {income === 0 && expense === 0
                        ? view === 'month'
                          ? 'Nothing logged this month yet'
                          : 'Nothing logged yet'
                        : `${formatCurrency(income)} in · ${formatCurrency(expense)} out`}
                    </CardCaption>
                  </>
                )}
              </motion.div>
            </AnimatePresence>
          </div>

          {/* The affordance that there is a second page. Deliberately an indicator
              rather than a control: the whole card is a link, and a <button>
              inside an <a> is invalid content that browsers and screen readers
              both have to guess at. The swipe is the interaction; the walkthrough
              is what makes sure it is discovered. The page's name is already
              inside the link's text, so this needs no label of its own. */}
          <div className="flex flex-shrink-0 items-center gap-1.5 pb-1.5" aria-hidden>
            {VIEWS.map((candidate, i) => (
              <span
                key={candidate}
                className="block h-1.5 rounded-full transition-all"
                style={{
                  width: index === i ? 14 : 6,
                  background: index === i ? ACCENT : 'rgba(255,255,255,0.16)',
                }}
              />
            ))}
          </div>
        </div>
      </motion.div>
    </SummaryCard>
  )
}
