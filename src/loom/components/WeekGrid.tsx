import { motion, useReducedMotion } from 'framer-motion'
import { DAYS, type DayIndex } from '../lib/types'
import { formatTime, isTodayColumn } from '../lib/schedule'
import { onColor } from '../lib/colors'
import type { ClassPreset, ScheduleBlock, TimeSlot } from '../lib/types'

interface WeekGridProps {
  slots: TimeSlot[]
  block: ScheduleBlock
  presets: Map<string, ClassPreset>
  readOnly: boolean
  onCellTap: (day: DayIndex, slot: TimeSlot) => void
}

/** Roughly what a cell can hold on one line at this width; longer words are elided. */
const MAX_WORD = 8

/**
 * Six day columns inside a phone width leave each cell about 41px of usable text,
 * which is under a word like "Structures". Left alone the word simply gets sliced
 * by `overflow:hidden` and reads as a rendering fault ("Data Structure"), so any
 * over-long word is elided instead — an obvious, deliberate abbreviation. Short
 * words are always left whole.
 */
export function gridLabel(title: string): string {
  return title
    .split(' ')
    .map((word) => (word.length > MAX_WORD ? `${word.slice(0, MAX_WORD - 1)}…` : word))
    .join(' ')
}

/**
 * The whole week at a glance: six day columns against the term's slot rows, each
 * occupied cell filled with its class colour. Titles are abbreviated here on
 * purpose — this view answers "what shape is my week", and the day view carries
 * location and faculty in full. The colour is what makes a recurring class
 * findable without reading anything.
 *
 * Sized to fit six columns plus the time gutter inside a phone width rather than
 * scrolling sideways, since a timetable you have to pan is useless between classes.
 * Rows share whatever height the screen has left, up to ROW_MAX, so the week reads
 * as the centrepiece of the screen rather than a strip pinned under the header.
 */
const ROW_MIN = 46
const ROW_MAX = 84
export default function WeekGrid({ slots, block, presets, readOnly, onCellTap }: WeekGridProps) {
  const reduceMotion = useReducedMotion()

  if (slots.length === 0) {
    return (
      <p className="loom-neu-pressed rounded-card px-4 py-6 text-center text-sm text-loomMuted">
        No time slots yet — add them under Terms to start building the week.
      </p>
    )
  }

  return (
    // The cap lives on the card, not the grid, so a term with few slots ends the
    // card where its rows end instead of leaving a blank band inside the surface.
    <div
      // Anchor for Loom's walkthrough. Set on the grid's own root rather than on
      // a wrapper: this element is `flex-1` inside the page's flex column, and a
      // wrapper would sever that relationship and collapse the week.
      data-tour="loom-grid"
      className="loom-neu-raised flex min-h-0 flex-1 flex-col rounded-card p-3"
      style={{ maxHeight: 24 + 22 + slots.length * (ROW_MAX + 4) }}
    >
      <div
        className="grid flex-1 gap-1"
        style={{
          gridTemplateColumns: `minmax(38px, 0.62fr) repeat(6, minmax(0, 1fr))`,
          gridTemplateRows: `auto repeat(${slots.length}, minmax(${ROW_MIN}px, 1fr))`,
        }}
      >
        <div />
        {DAYS.map((day, i) => {
          const today = isTodayColumn(i as DayIndex)
          return (
            <div key={day} className="pb-1 text-center">
              <span className={`text-[10px] uppercase tracking-wide ${today ? 'font-semibold text-loomGold' : 'text-loomMuted'}`}>
                {day}
              </span>
            </div>
          )
        })}

        {slots.map((slot, rowIndex) => (
          <Row
            key={slot.id}
            slot={slot}
            rowIndex={rowIndex}
            block={block}
            presets={presets}
            readOnly={readOnly}
            reduceMotion={Boolean(reduceMotion)}
            onCellTap={onCellTap}
          />
        ))}
      </div>
    </div>
  )
}

function Row({
  slot,
  rowIndex,
  block,
  presets,
  readOnly,
  reduceMotion,
  onCellTap,
}: {
  slot: TimeSlot
  rowIndex: number
  block: ScheduleBlock
  presets: Map<string, ClassPreset>
  readOnly: boolean
  reduceMotion: boolean
  onCellTap: (day: DayIndex, slot: TimeSlot) => void
}) {
  return (
    <>
      <div className="flex flex-col justify-center pr-1 text-right">
        <span className="text-[9px] leading-tight tabular-nums text-loomMuted">{formatTime(slot.start_time)}</span>
      </div>

      {DAYS.map((_, dayIndex) => {
        const day = dayIndex as DayIndex
        const presetId = block.assignments[String(day)]?.[slot.id]
        const preset = presetId ? presets.get(presetId) : undefined
        const today = isTodayColumn(day)

        const content = preset ? (
          <span
            className="flex h-full w-full items-center justify-center overflow-hidden rounded-[9px] px-0.5 text-center text-[9px] font-semibold leading-[1.1]"
            style={{ background: preset.color, color: onColor(preset.color) }}
          >
            <span className="line-clamp-3">{gridLabel(preset.title)}</span>
          </span>
        ) : (
          <span className="loom-neu-pressed-sm block h-full w-full rounded-[9px]" />
        )

        // The row track already carries the ROW_MIN floor, so the cell just fills it.
        const cellClass = `relative h-full w-full rounded-[9px] ${today ? 'ring-1 ring-loomGold/45' : ''}`

        if (readOnly) {
          return (
            <div
              key={day}
              className={cellClass}
              role="img"
              aria-label={`${DAYS[day]} ${formatTime(slot.start_time)} — ${preset ? preset.title : 'free'}`}
            >
              {content}
            </div>
          )
        }

        return (
          <motion.button
            key={day}
            type="button"
            onClick={() => onCellTap(day, slot)}
            aria-label={`${DAYS[day]} ${formatTime(slot.start_time)} — ${preset ? preset.title : 'free'}. Tap to ${preset ? 'change' : 'assign'}.`}
            className={cellClass}
            whileTap={reduceMotion ? undefined : { scale: 0.94 }}
            initial={reduceMotion ? false : { opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.18, delay: Math.min(0.3, rowIndex * 0.03) }}
          >
            {content}
          </motion.button>
        )
      })}
    </>
  )
}
