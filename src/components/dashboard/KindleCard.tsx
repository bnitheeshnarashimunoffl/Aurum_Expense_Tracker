import SummaryCard from './SummaryCard'
import { useHabits } from '@/kindle/hooks/useHabits'
import { useHabitLogs } from '@/kindle/hooks/useHabitLogs'
import { resolveStageColor } from '@/kindle/lib/gradient'
import { todayISO } from '@/lib/format'

// Kindle's royal purple rather than the shared gold — three of the four cards
// would otherwise carry the same brass label and the "four personalities" the
// brief asks for would collapse into one. See --mer-kindle-accent in index.css
// for why it is a lifted variant rather than --kindle-purple itself.
const ACCENT = 'var(--mer-kindle-accent)'
const GLOW = 'rgba(59, 43, 92, 0.34)'

/**
 * Today's habits as one row of colour, and nothing else.
 *
 * No labels, no names, no legend, no count — deliberately. This is not a table
 * to read, it is a pulse to glance at: five green and three red says everything
 * about the day in less time than it takes to focus on a word. Adding a
 * "5 of 8 done" line would turn a glance into a read, and the whole point of the
 * card would go with it.
 *
 * The colours come from resolveStageColor — Kindle's own function, the same one
 * the 8x7 grid calls — rather than being re-derived here. That is what keeps the
 * card honest about partial stages: a water habit at 2 of 4 litres is the exact
 * mid-gradient orange it is inside the app, not a guess at one.
 */
export default function KindleCard() {
  const today = todayISO()
  const { habits, loading: habitsLoading } = useHabits()
  const { logs, loading: logsLoading } = useHabitLogs({ from: today, to: today })
  const loading = habitsLoading || logsLoading

  const cells = habits.map((habit) => {
    const stage = logs.find((log) => log.habit_id === habit.id && log.date === today)?.stage ?? 0
    return {
      id: habit.id,
      label: habit.label,
      stage,
      max: habit.max_stage,
      color: resolveStageColor(habit, stage),
    }
  })

  return (
    <SummaryCard to="/kindle" label="Kindle" accent={ACCENT} glow={GLOW}>
      {loading ? (
        <div className="flex gap-1.5">
          {Array.from({ length: 8 }).map((_, i) => (
            <span key={i} className="skeleton h-10 flex-1 rounded-[11px]" />
          ))}
        </div>
      ) : cells.length === 0 ? (
        <p className="py-1.5 text-[13px] text-muted">No habits yet — add your first in Kindle.</p>
      ) : (
        <div
          className="flex gap-1.5"
          role="img"
          // The row carries no visible labels, so the whole of its meaning has to
          // live in one accessible name — otherwise this is eight unexplained
          // rectangles to a screen reader.
          aria-label={`Today's habits: ${cells.map((c) => `${c.label} ${c.stage} of ${c.max}`).join(', ')}`}
        >
          {cells.map((cell) => (
            <span
              key={cell.id}
              className={`h-10 flex-1 rounded-[11px] ${cell.color ? '' : 'mer-card-well'}`}
              style={
                cell.color
                  ? {
                      background: cell.color,
                      // A filled cell sits IN the card, the same way a logged cell
                      // sits in Kindle's own grid — colour alone would read as a
                      // sticker laid on top.
                      boxShadow: 'inset 2px 2px 5px rgba(0,0,0,0.30), inset -2px -2px 5px rgba(255,255,255,0.16)',
                    }
                  : undefined
              }
            />
          ))}
        </div>
      )}
    </SummaryCard>
  )
}
