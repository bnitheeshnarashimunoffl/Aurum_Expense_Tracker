import { resolveStageColor } from '../lib/gradient'
import { stageQuantityLabel } from '../lib/quantity'
import type { Habit } from '../lib/types'

interface StageSelectorProps {
  habit: Habit
  /** The stage currently stored for the day being edited. */
  value: number
  /** Always the absolute stage the user picked — never a delta from `value`. */
  onSelect: (stage: number) => void
}

/**
 * Shared quick-select used by both the today-logging modal and the PIN-gated
 * past-day edit sheet, so "how you pick a value" is identical wherever you pick one.
 * Every option is labeled with its real-world quantity ("3L", "50g", "2 baths") and
 * previews its own stage color, and selecting one SETS that exact stage.
 */
export default function StageSelector({ habit, value, onSelect }: StageSelectorProps) {
  if (habit.type === 'binary') {
    const doneColor = resolveStageColor(habit, habit.max_stage) ?? 'var(--kindle-complete)'
    const options = [
      { stage: 0, label: 'Not done', color: null as string | null },
      { stage: habit.max_stage, label: 'Done', color: doneColor },
    ]
    return (
      <div className="grid grid-cols-2 gap-3">
        {options.map((option) => {
          const selected = value === option.stage
          return (
            <button
              key={option.stage}
              type="button"
              onClick={() => onSelect(option.stage)}
              aria-pressed={selected}
              className={`flex min-h-[112px] flex-col items-center justify-center gap-3 rounded-card text-sm font-medium transition-transform active:scale-95 ${
                selected ? 'kindle-neu-pressed' : 'kindle-neu-raised'
              }`}
              style={
                selected && option.color
                  ? { background: option.color, color: 'var(--kindle-bg-base)' }
                  : { color: selected ? 'var(--accent)' : 'var(--text-primary)' }
              }
            >
              <span
                className="flex h-10 w-10 items-center justify-center rounded-full"
                style={{
                  background: option.color ?? 'var(--kindle-bg-base)',
                  // The unchecked swatch is the neutral surface tone by spec, which is
                  // near-invisible against the tile — a hairline ring gives it an edge.
                  boxShadow: selected
                    ? 'inset 0 0 0 2px rgba(255,255,255,0.35)'
                    : 'inset 0 0 0 1px rgba(140,150,220,0.28)',
                }}
              >
                {option.stage > 0 && (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--kindle-bg-base)" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                    <path d="M4 12.5 L9.5 18 L20 6.5" />
                  </svg>
                )}
              </span>
              {option.label}
            </button>
          )
        })}
      </div>
    )
  }

  // Up to 5 stages sit on one row; beyond that they wrap into two balanced rows
  // (8 -> 4x2, 10 -> 5x2) rather than a ragged 4 + 1.
  const columns = habit.max_stage <= 5 ? habit.max_stage : Math.ceil(habit.max_stage / 2)

  return (
    <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}>
      {Array.from({ length: habit.max_stage }, (_, i) => i + 1).map((stage) => {
        const color = resolveStageColor(habit, stage) ?? 'var(--kindle-bg-surface)'
        const selected = value === stage
        return (
          <button
            key={stage}
            type="button"
            onClick={() => onSelect(stage)}
            aria-pressed={selected}
            aria-label={`Set to ${stageQuantityLabel(habit, stage)}`}
            className={`flex min-h-[72px] flex-col items-center justify-center gap-2 rounded-card px-1 transition-transform active:scale-95 ${
              selected ? 'kindle-neu-pressed' : 'kindle-neu-raised'
            }`}
            style={selected ? { background: color } : undefined}
          >
            <span
              className="h-2 w-7 rounded-full"
              style={{ background: selected ? 'rgba(11,13,16,0.45)' : color }}
            />
            <span
              className="text-xs font-medium tabular-nums"
              style={{ color: selected ? 'var(--kindle-bg-base)' : 'var(--text-primary)' }}
            >
              {stageQuantityLabel(habit, stage)}
            </span>
          </button>
        )
      })}
    </div>
  )
}
