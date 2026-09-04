import { useEffect, useMemo, useState } from 'react'
import SummaryCard, { CardCaption, CardSkeleton } from './SummaryCard'
import { useAuth } from '@/context/AuthContext'
import { setLoomUserId } from '@/loom/lib/db'
import { syncNow } from '@/loom/lib/sync'
import { useActiveTerm, useBlocks, useLoomReady, usePresets, useSlots, presetMap } from '@/loom/hooks/useLoomData'
import { blockInEffect, formatTime, sortSlots } from '@/loom/lib/schedule'
import { formatDate, todayISO } from '@/lib/format'

const ACCENT = 'var(--loom-gold)'
const GLOW = 'rgba(125, 42, 65, 0.20)'

/**
 * The next class today.
 *
 * Reads IndexedDB, not the network — Loom is offline-first and its data lives in
 * Dexie, so this card keeps working on a train exactly like the module does. The
 * one thing it borrows from the network is a single opportunistic sync on mount:
 * on a device that has never opened Loom the local database is empty, and without
 * that pull the card would honestly but uselessly report "no timetable" for a
 * user who has one. syncNow() swallows its own failures, so being offline just
 * means the local copy is used as-is.
 *
 * The resolution path is Loom's real semester logic rather than a simplification:
 * the active term, whether today is inside it, and the schedule BLOCK in effect
 * today — so a mid-semester change of timetable is reflected here on the day it
 * takes effect, and Saturday's independently-edited column is read like any other
 * day.
 */
export default function LoomCard() {
  const { session } = useAuth()
  const today = todayISO()

  useEffect(() => {
    if (!session?.user?.id) return
    setLoomUserId(session.user.id)
    void syncNow()
  }, [session?.user?.id])

  // A minute's resolution is all "next class" needs, and it keeps the card from
  // going stale while the launcher sits open.
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 30_000)
    return () => window.clearInterval(id)
  }, [])

  const term = useActiveTerm()
  const slots = useSlots(term?.id)
  const presets = usePresets(term?.id)
  const blocks = useBlocks(term?.id)

  // Dexie's live queries report `undefined` until they have run once.
  const loomReady = useLoomReady()
  const loading = !loomReady || term === undefined || slots === undefined || presets === undefined || blocks === undefined

  const state = useMemo(() => {
    if (loading) return { kind: 'loading' as const }
    if (!term) return { kind: 'no-term' as const }
    if (today < term.start_date) return { kind: 'not-started' as const, on: term.start_date }
    if (today > term.end_date) return { kind: 'ended' as const, name: term.name }

    // Loom has no Sunday column — it is a class timetable, not a calendar.
    const jsDay = now.getDay()
    if (jsDay === 0) return { kind: 'sunday' as const }
    const dayIndex = jsDay - 1

    const block = blockInEffect(blocks ?? [], today)
    if (!block) return { kind: 'no-schedule' as const }

    const assignments = block.assignments[String(dayIndex)] ?? {}
    const byId = presetMap(presets)
    const minutesNow = now.getHours() * 60 + now.getMinutes()

    const scheduled = sortSlots(slots ?? [])
      .map((slot) => {
        const preset = byId.get(assignments[slot.id] ?? '')
        if (!preset) return null
        const [h, m] = slot.start_time.split(':').map(Number)
        if (Number.isNaN(h)) return null
        return { slot, preset, startsAt: h * 60 + (m || 0) }
      })
      .filter((entry): entry is NonNullable<typeof entry> => entry !== null)
      .sort((a, b) => a.startsAt - b.startsAt)

    if (scheduled.length === 0) return { kind: 'none-today' as const }

    const next = scheduled.find((entry) => entry.startsAt > minutesNow)
    if (!next) return { kind: 'done-today' as const, count: scheduled.length }

    return { kind: 'next' as const, entry: next, minutesUntil: next.startsAt - minutesNow }
  }, [loading, term, today, now, blocks, slots, presets])

  return (
    <SummaryCard to="/loom" label="Loom" accent={ACCENT} glow={GLOW}>
      {state.kind === 'loading' ? (
        <CardSkeleton />
      ) : state.kind === 'next' ? (
        <>
          <div className="flex items-baseline justify-between gap-3">
            <p className="text-[11px] text-muted">Next class</p>
            {/* Burgundy is Loom's second accent, and it earns its place here by
                meaning something: it only appears once the class is close. */}
            {state.minutesUntil <= 90 && (
              <span
                className="flex-shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium tabular-nums"
                style={{ background: 'var(--loom-burgundy)', color: 'var(--loom-ink)' }}
              >
                {state.minutesUntil < 1 ? 'starting now' : `in ${formatGap(state.minutesUntil)}`}
              </span>
            )}
          </div>
          <div className="flex items-baseline gap-2.5">
            <span className="font-display tabular-nums flex-shrink-0 text-[19px] font-bold leading-tight" style={{ color: ACCENT }}>
              {formatTime(state.entry.slot.start_time)}
            </span>
            <span className="truncate text-[15px] font-medium leading-tight text-primary">{state.entry.preset.title}</span>
          </div>
          <CardCaption>{state.entry.preset.location?.trim() || 'No room set for this class'}</CardCaption>
        </>
      ) : (
        <EmptyState state={state} />
      )}
    </SummaryCard>
  )
}

function formatGap(minutes: number): string {
  if (minutes < 60) return `${minutes} min`
  const hours = Math.floor(minutes / 60)
  const rest = minutes % 60
  return rest === 0 ? `${hours}h` : `${hours}h ${rest}m`
}

/**
 * Every way the card can have nothing to show, each one written as a statement
 * about the day rather than an absence. "That's the day done" is a result;
 * "No data" is a bug report.
 */
function EmptyState({ state }: { state: { kind: string; on?: string; name?: string; count?: number } }) {
  const copy: Record<string, { headline: string; caption: string }> = {
    'no-term': { headline: 'No timetable yet', caption: 'Set up a semester in Loom and your week appears here.' },
    'not-started': {
      headline: 'Term hasn’t started',
      caption: state.on ? `Classes begin ${formatDate(state.on)}.` : 'Classes begin soon.',
    },
    ended: { headline: 'Semester’s finished', caption: `${state.name ?? 'That term'} has ended — add the next one when you have it.` },
    sunday: { headline: 'Sunday', caption: 'No classes today. The week starts again tomorrow.' },
    'no-schedule': { headline: 'No schedule in effect', caption: 'This term has no timetable block covering today yet.' },
    'none-today': { headline: 'Nothing scheduled today', caption: 'The day is empty in the current timetable.' },
    'done-today': {
      headline: 'That’s the day done',
      caption: state.count ? `All ${state.count} class${state.count === 1 ? '' : 'es'} are behind you.` : 'No classes left today.',
    },
  }
  const { headline, caption } = copy[state.kind] ?? { headline: 'Nothing to show', caption: 'Open Loom to set up your timetable.' }

  return (
    <>
      <p className="text-[17px] font-medium leading-tight text-primary">{headline}</p>
      <CardCaption>{caption}</CardCaption>
    </>
  )
}
