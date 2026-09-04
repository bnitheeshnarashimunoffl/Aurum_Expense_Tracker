import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { formatDate, todayISO } from '@/lib/format'
import LoadingRing from '@/components/LoadingRing'
import { useActiveTerm, useBlocks, useLoomReady, usePresets, useSlots, useTerm, presetMap } from '../hooks/useLoomData'
import { assignSlot, copyDayInto, upsertPreset, newId } from '../lib/db'
import { scheduleSync } from '../lib/sync'
import { blockInEffect, blockRunsUntil, sortBlocks, todayDayIndex } from '../lib/schedule'
import { nextClassColor } from '../lib/colors'
import { DAYS, DAY_FULL, SATURDAY, type DayIndex, type TimeSlot } from '../lib/types'
import WeekGrid from '../components/WeekGrid'
import DaySchedule from '../components/DaySchedule'
import AssignSheet from '../components/AssignSheet'
import PresetEditorSheet, { type PresetDraft } from '../components/PresetEditorSheet'
import CopyToSaturdaySheet from '../components/CopyToSaturdaySheet'
import SyncBadge from '../components/SyncBadge'
import LoomIcon from '../components/LoomIcon'
import ModuleWalkthrough from '@/onboarding/ModuleWalkthrough'

export default function Timetable() {
  const [params, setParams] = useSearchParams()
  const viewingTermId = params.get('term') ?? undefined

  const activeTerm = useActiveTerm()
  const explicitTerm = useTerm(viewingTermId)
  const term = viewingTermId ? explicitTerm : activeTerm

  const slots = useSlots(term?.id)
  const presets = usePresets(term?.id)
  const blocks = useBlocks(term?.id)
  // Waits for the first background pull before concluding "no term" — see the
  // doc comment on useLoomReady. Without this a freshly wiped device shows
  // "head to Terms to create your first semester" for a moment even when a
  // term already exists in Supabase and is about to arrive.
  const loomReady = useLoomReady()

  const [view, setView] = useState<'week' | 'day'>('week')
  const [day, setDay] = useState<DayIndex>(todayDayIndex)
  const [blockId, setBlockId] = useState<string | null>(null)
  const [assignTarget, setAssignTarget] = useState<{ day: DayIndex; slot: TimeSlot } | null>(null)
  const [creatingPreset, setCreatingPreset] = useState(false)
  const [copyOpen, setCopyOpen] = useState(false)

  // Default to whichever block is in effect today; the user can then step through
  // the term's other blocks without that choice being overwritten on re-render.
  const currentBlock = useMemo(() => blockInEffect(blocks ?? [], todayISO()), [blocks])
  useEffect(() => {
    if (!blockId && currentBlock) setBlockId(currentBlock.id)
  }, [blockId, currentBlock])
  useEffect(() => {
    setBlockId(null)
  }, [term?.id])

  const ordered = sortBlocks(blocks ?? [])
  const block = ordered.find((b) => b.id === blockId) ?? currentBlock
  const readOnly = term?.archived === 1
  const byId = presetMap(presets)

  const loading = !loomReady || term === undefined || slots === undefined || presets === undefined || blocks === undefined

  async function handleAssign(presetId: string | null) {
    if (!block || !assignTarget) return
    await assignSlot(block, assignTarget.day, assignTarget.slot.id, presetId)
    scheduleSync()
    setAssignTarget(null)
  }

  async function handleCreatePreset(draft: PresetDraft) {
    if (!term) return
    const id = draft.id ?? newId()
    await upsertPreset({ id, term_id: term.id, title: draft.title, location: draft.location, faculty_name: draft.faculty_name, color: draft.color })
    scheduleSync()
    // Creating a class from inside the assign flow drops it straight into the slot
    // that prompted it, rather than making the user find it in the list again.
    if (block && assignTarget) {
      await assignSlot(block, assignTarget.day, assignTarget.slot.id, id)
      scheduleSync()
      setAssignTarget(null)
    }
  }

  async function handleCopyToSaturday(fromDay: DayIndex) {
    if (!block) return
    await copyDayInto(block, fromDay, SATURDAY)
    scheduleSync()
    setDay(SATURDAY)
    setView('day')
  }

  if (loading) return <div className="px-4 pt-4"><LoadingRing label="Loading timetable" /></div>

  if (!term) {
    return (
      <div className="px-4 pt-4">
        <Header title="Loom" subtitle="No term yet" />
        <div className="loom-neu-raised rounded-card px-5 py-8 text-center">
          <p className="mb-1 text-sm text-loomInk">No term set up yet.</p>
          <p className="text-xs text-loomMuted">Head to Terms to create your first semester.</p>
        </div>
      </div>
    )
  }

  return (
    // A column so the week grid can take the height the screen has spare: the shell
    // reserves 7rem at the bottom for the nav, and everything above the grid is
    // intrinsically sized.
    <div className="flex min-h-[calc(100dvh-7rem)] flex-col px-4 pt-4">
      <Header
        title={term.name}
        subtitle={`${formatDate(term.start_date)} – ${formatDate(term.end_date)}`}
        readOnly={readOnly}
      />

      {readOnly && (
        <div className="mb-4 rounded-card px-4 py-2.5 text-xs" style={{ background: 'var(--loom-burgundy)', color: 'var(--loom-ink)' }}>
          Archived term — viewing only. Nothing here can be changed.
        </div>
      )}

      {ordered.length > 1 && (
        <div className="mb-3 flex gap-2 overflow-x-auto pb-1">
          {ordered.map((b) => {
            const selected = b.id === block?.id
            const inEffect = b.id === currentBlock?.id
            return (
              <button
                key={b.id}
                onClick={() => setBlockId(b.id)}
                className={`flex-shrink-0 rounded-full px-3 py-1.5 text-[11px] ${
                  selected ? 'loom-neu-pressed text-loomGold' : 'loom-neu-raised-sm text-loomMuted'
                }`}
              >
                from {formatDate(b.effective_from)}
                {inEffect && <span className="ml-1 text-loomGold">· now</span>}
              </button>
            )
          })}
        </div>
      )}

      {block && ordered.length > 1 && (
        <p className="mb-3 text-[11px] text-loomMuted">
          In effect {formatDate(block.effective_from)} – {formatDate(blockRunsUntil(ordered, block, term.end_date))}
        </p>
      )}

      <div data-tour="loom-view" className="loom-neu-pressed mb-4 flex rounded-full p-1" role="group" aria-label="Timetable view">
        {(['week', 'day'] as const).map((option) => (
          <button
            key={option}
            onClick={() => setView(option)}
            aria-pressed={view === option}
            className={`min-h-[34px] flex-1 rounded-full text-xs font-medium capitalize transition-colors ${
              view === option ? 'bg-loomGold text-loomBase' : 'text-loomMuted'
            }`}
          >
            {option}
          </button>
        ))}
      </div>

      {block ? (
        view === 'week' ? (
          <WeekGrid
            slots={slots}
            block={block}
            presets={byId}
            readOnly={readOnly}
            onCellTap={(d, slot) => setAssignTarget({ day: d, slot })}
          />
        ) : (
          <>
            <div className="mb-3 flex gap-1.5">
              {DAYS.map((label, i) => (
                <button
                  key={label}
                  onClick={() => setDay(i as DayIndex)}
                  aria-pressed={day === i}
                  className={`min-h-[38px] flex-1 rounded-xl text-[11px] font-medium ${
                    day === i ? 'loom-neu-pressed text-loomGold' : 'loom-neu-raised-sm text-loomMuted'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            <DaySchedule
              day={day}
              slots={slots}
              block={block}
              presets={byId}
              readOnly={readOnly}
              onSlotTap={(d, slot) => setAssignTarget({ day: d, slot })}
            />

            {day === SATURDAY && !readOnly && (
              <button
                onClick={() => setCopyOpen(true)}
                className="loom-neu-raised mt-4 min-h-[46px] w-full rounded-card text-sm font-medium text-loomGold"
              >
                Copy a weekday into Saturday
              </button>
            )}
          </>
        )
      ) : (
        <p className="loom-neu-pressed rounded-card px-4 py-6 text-center text-sm text-loomMuted">
          This term has no schedule block yet.
        </p>
      )}

      {viewingTermId && (
        <button
          onClick={() => setParams({})}
          className="loom-neu-raised-sm mt-5 min-h-[40px] w-full rounded-card text-xs text-loomMuted"
        >
          Back to the active term
        </button>
      )}

      <AssignSheet
        open={assignTarget !== null && !readOnly}
        target={assignTarget}
        presets={presets}
        currentPresetId={assignTarget && block ? block.assignments[String(assignTarget.day)]?.[assignTarget.slot.id] : undefined}
        onAssign={handleAssign}
        onCreateNew={() => setCreatingPreset(true)}
        onClose={() => setAssignTarget(null)}
      />

      <PresetEditorSheet
        open={creatingPreset}
        suggestedColor={nextClassColor(presets.map((p) => p.color))}
        onSave={handleCreatePreset}
        onClose={() => setCreatingPreset(false)}
      />

      {/* Only once a term with a real grid exists — there is nothing to point at
          on the empty-state screen, and the module's own copy handles that case. */}
      <ModuleWalkthrough module="loom" ready={Boolean(block)} />

      {block && (
        <CopyToSaturdaySheet
          open={copyOpen}
          block={block}
          slots={slots}
          presets={byId}
          onCopy={handleCopyToSaturday}
          onClose={() => setCopyOpen(false)}
        />
      )}
    </div>
  )
}

function Header({ title, subtitle, readOnly }: { title: string; subtitle: string; readOnly?: boolean }) {
  return (
    <header className="mb-5 flex items-center gap-2.5 pr-14">
      <LoomIcon size={26} />
      <div className="min-w-0 flex-1">
        <h1 className="font-display truncate text-2xl font-bold text-loomInk">{title}</h1>
        <p className="truncate text-xs text-loomMuted">{subtitle}</p>
      </div>
      {!readOnly && <SyncBadge />}
    </header>
  )
}

export { DAY_FULL }
