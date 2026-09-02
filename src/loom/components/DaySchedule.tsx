import { motion, useReducedMotion } from 'framer-motion'
import { formatSlotRange } from '../lib/schedule'
import { tint } from '../lib/colors'
import { DAY_FULL, type DayIndex } from '../lib/types'
import type { ClassPreset, ScheduleBlock, TimeSlot } from '../lib/types'

interface DayScheduleProps {
  day: DayIndex
  slots: TimeSlot[]
  block: ScheduleBlock
  presets: Map<string, ClassPreset>
  readOnly: boolean
  onSlotTap: (day: DayIndex, slot: TimeSlot) => void
}

/**
 * One day in full: every occupied slot shows title, location, faculty and time
 * without a tap, which is the whole point of this view — checking where to go
 * next should never cost an extra interaction. The class colour appears as an
 * edge bar plus a low wash rather than a flat fill, so eight saturated hues can
 * coexist on one screen without shouting.
 */
export default function DaySchedule({ day, slots, block, presets, readOnly, onSlotTap }: DayScheduleProps) {
  const reduceMotion = useReducedMotion()
  const dayAssignments = block.assignments[String(day)] ?? {}
  const occupied = slots.filter((s) => dayAssignments[s.id])

  if (slots.length === 0) {
    return (
      <p className="loom-neu-pressed rounded-card px-4 py-6 text-center text-sm text-loomMuted">
        No time slots yet — add them under Terms to start building the week.
      </p>
    )
  }

  return (
    <div className="space-y-2.5">
      {occupied.length === 0 && (
        <p className="text-center text-xs text-loomMuted">Nothing scheduled on {DAY_FULL[day]}.</p>
      )}

      {slots.map((slot, i) => {
        const preset = presets.get(dayAssignments[slot.id] ?? '')

        const body = (
          <>
            <span
              aria-hidden
              className="absolute inset-y-0 left-0 w-[3px] rounded-l-card"
              style={{ background: preset ? preset.color : 'transparent' }}
            />
            <span className="flex w-[74px] flex-shrink-0 flex-col items-start pl-3.5 pr-1">
              <span className="text-[11px] font-medium tabular-nums text-loomInk">{slot.start_time}</span>
              <span className="text-[10px] tabular-nums text-loomMuted">{slot.end_time}</span>
            </span>

            {preset ? (
              <span className="min-w-0 flex-1 py-0.5 pr-3 text-left">
                <span className="block truncate text-sm font-semibold text-loomInk">{preset.title}</span>
                {preset.location && <span className="block truncate text-[11px] text-loomMuted">{preset.location}</span>}
                {preset.faculty_name && (
                  <span className="block truncate text-[11px] text-loomMuted">{preset.faculty_name}</span>
                )}
              </span>
            ) : (
              <span className="flex-1 py-0.5 pr-3 text-left text-[13px] text-loomMuted">
                {readOnly ? 'Free' : 'Free — tap to assign'}
              </span>
            )}
          </>
        )

        const shell = `relative flex min-h-[58px] w-full items-center overflow-hidden rounded-card ${
          preset ? 'loom-neu-raised' : 'loom-neu-pressed'
        }`
        const style = preset ? { background: `linear-gradient(90deg, ${tint(preset.color, 14)}, transparent 62%), var(--loom-bg-surface)` } : undefined

        if (readOnly) {
          return (
            <div key={slot.id} className={shell} style={style}>
              {body}
            </div>
          )
        }

        return (
          <motion.button
            key={slot.id}
            type="button"
            onClick={() => onSlotTap(day, slot)}
            aria-label={`${formatSlotRange(slot)} — ${preset ? preset.title : 'free'}. Tap to ${preset ? 'change or clear' : 'assign a class'}.`}
            className={`${shell} text-left transition-transform active:scale-[0.985]`}
            style={style}
            initial={reduceMotion ? false : { opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2, delay: Math.min(0.28, i * 0.035) }}
          >
            {body}
          </motion.button>
        )
      })}
    </div>
  )
}
