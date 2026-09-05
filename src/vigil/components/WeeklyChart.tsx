import { useState } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { formatWeekdayInitial, formatDayNum } from '@/lib/date'
import { formatDate, todayISO } from '@/lib/format'
import { formatDuration, formatTarget, splitAgainstTarget } from '../lib/time'

export interface WeeklyChartDay {
  date: string
  studied: number
}

interface WeeklyChartProps {
  days: WeeklyChartDay[]
  /**
   * The daily target this week was set to. One value for the whole chart, which
   * is correct by construction: a target is chosen per week and cannot move
   * inside one, so every bar here is measured against the same line.
   */
  target: number
}

const PLOT_HEIGHT = 168
/**
 * Two steps of one bronze ramp, validated as an ordinal pair against the cream
 * surface (monotone lightness, ΔL clear, light end 2.57:1). The ramp runs
 * bottom-to-top through the bar: deep bronze for time spent reaching the target,
 * the lighter gold step for everything past it, so "rising into bonus" is legible
 * as a lightness change even where the target line itself is missed.
 */
const COLOR_ON_TARGET = 'var(--vigil-bronze)'
const COLOR_BONUS = 'var(--vigil-gold)'
/** The surface gap that separates the two stacked fills — never a stroke. */
const SEGMENT_GAP = 2

export default function WeeklyChart({ days, target }: WeeklyChartProps) {
  const reduceMotion = useReducedMotion()
  const [hovered, setHovered] = useState<string | null>(null)
  const today = todayISO()

  const maxStudied = days.reduce((max, d) => Math.max(max, d.studied), 0)
  // Headroom so a full 5h day never touches the ceiling and the target line always
  // sits comfortably inside the plot even on a week with no overflow at all.
  // Headroom leaves room both for the target line to sit inside the plot and for
  // today's direct label to clear the tallest bar's cap without being clipped.
  const scaleMax = Math.max(target * 1.25, maxStudied * 1.16)
  const targetPct = (target / scaleMax) * 100

  const weekTotal = days.reduce((sum, d) => sum + d.studied, 0)
  const daysOnTarget = days.filter((d) => d.studied >= target).length

  return (
    <section className="vigil-neu-raised rounded-card px-4 pb-4 pt-4" aria-label="Study time this week">
      <header className="mb-1 flex items-baseline justify-between">
        <h2 className="font-display text-sm font-semibold text-vigilInk">This week</h2>
        <span className="text-xs text-vigilInkSoft">
          {formatDuration(weekTotal)} · {daysOnTarget}/7 on target
        </span>
      </header>

      {/* Two series, so a legend is always present — identity never rests on color alone. */}
      <div className="mb-4 flex items-center gap-4 text-[11px] text-vigilInkSoft">
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-[2px]" style={{ background: COLOR_ON_TARGET }} aria-hidden />
          Toward target
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-[2px]" style={{ background: COLOR_BONUS }} aria-hidden />
          Bonus
        </span>
      </div>

      <div className="relative" style={{ height: PLOT_HEIGHT }}>
        {/* Target rule: a solid hairline, not dashed, with its value named at the end. */}
        <div className="pointer-events-none absolute inset-x-0 z-10" style={{ bottom: `${targetPct}%` }} aria-hidden>
          <div className="h-px w-full" style={{ background: 'var(--vigil-gold)', opacity: 0.55 }} />
          <span
            className="absolute -top-[7px] right-0 pl-1 text-[10px] tabular-nums text-vigilInkSoft"
            style={{ background: 'var(--vigil-bg-surface)' }}
          >
            {formatTarget(target)}
          </span>
        </div>

        <div className="flex h-full items-end gap-1.5">
          {days.map((day, i) => {
            const { onTarget, bonus } = splitAgainstTarget(day.studied, target)
            const onTargetPct = (onTarget / scaleMax) * 100
            const bonusPct = (bonus / scaleMax) * 100
            const isToday = day.date === today
            const isHovered = hovered === day.date
            const empty = day.studied <= 0

            return (
              <div
                key={day.date}
                className="relative flex h-full flex-1 flex-col justify-end"
                onMouseEnter={() => setHovered(day.date)}
                onMouseLeave={() => setHovered(null)}
              >
                {/* Recessed slot: the neumorphic equivalent of an unfilled meter track,
                    so an empty day still reads as a day rather than as missing data. */}
                <div className="vigil-neu-pressed-sm absolute inset-x-0 bottom-0 top-0 mx-auto w-full max-w-[24px] rounded-[7px]" aria-hidden />

                <button
                  type="button"
                  onFocus={() => setHovered(day.date)}
                  onBlur={() => setHovered(null)}
                  aria-label={`${formatDate(day.date)}: ${formatDuration(day.studied)} studied${bonus > 0 ? `, including ${formatDuration(bonus)} bonus` : ''}`}
                  className="relative mx-auto flex w-full max-w-[24px] flex-col justify-end rounded-[7px] focus:outline-none focus-visible:ring-2 focus-visible:ring-vigilGold"
                  style={{ height: '100%' }}
                >
                  {bonus > 0 && (
                    <motion.span
                      className="w-full"
                      style={{
                        background: COLOR_BONUS,
                        // The stack's top cap is rounded; it sits square where it meets
                        // the segment below, with the gap doing the separating.
                        borderRadius: '4px 4px 0 0',
                        marginBottom: SEGMENT_GAP,
                      }}
                      initial={reduceMotion ? false : { height: 0 }}
                      animate={{ height: `${bonusPct}%` }}
                      transition={reduceMotion ? { duration: 0 } : { type: 'spring', stiffness: 180, damping: 22, delay: 0.05 + i * 0.045 }}
                    />
                  )}
                  <motion.span
                    className="w-full"
                    style={{
                      background: COLOR_ON_TARGET,
                      borderRadius: bonus > 0 ? '0 0 2px 2px' : '4px 4px 2px 2px',
                      opacity: empty ? 0 : 1,
                    }}
                    initial={reduceMotion ? false : { height: 0 }}
                    animate={{ height: `${onTargetPct}%` }}
                    transition={reduceMotion ? { duration: 0 } : { type: 'spring', stiffness: 180, damping: 22, delay: i * 0.045 }}
                  />
                </button>

                {/* Label only today's column — a value on every bar goes unread — and
                    sit it on that bar's cap, not at the plot ceiling, so it reads as
                    belonging to this column rather than floating between two. */}
                {isToday && !empty && (
                  <span
                    className="pointer-events-none absolute inset-x-0 text-center text-[10px] font-medium tabular-nums text-vigilInk"
                    style={{ bottom: `calc(${onTargetPct + bonusPct}% + 5px)` }}
                  >
                    {formatDuration(day.studied)}
                  </span>
                )}

                {isHovered && (
                  <motion.div
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="vigil-glass pointer-events-none absolute bottom-full left-1/2 z-20 mb-1 w-max -translate-x-1/2 rounded-lg px-2 py-1 text-[10px] leading-tight text-vigilInk shadow"
                  >
                    <div className="font-medium">{formatDate(day.date)}</div>
                    <div className="tabular-nums text-vigilInkSoft">{formatDuration(day.studied)} studied</div>
                    {bonus > 0 && <div className="tabular-nums" style={{ color: COLOR_BONUS }}>+{formatDuration(bonus)} bonus</div>}
                  </motion.div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      <div className="mt-2 flex gap-1.5">
        {days.map((day) => {
          const isToday = day.date === today
          return (
            <div key={day.date} className="flex-1 text-center">
              <div className={`text-[10px] uppercase ${isToday ? 'font-semibold text-vigilGold' : 'text-vigilInkSoft'}`}>
                {formatWeekdayInitial(day.date)}
              </div>
              <div className={`text-[9px] tabular-nums ${isToday ? 'text-vigilGold' : 'text-vigilInkSoft'}`}>
                {formatDayNum(day.date)}
              </div>
            </div>
          )
        })}
      </div>
    </section>
  )
}
