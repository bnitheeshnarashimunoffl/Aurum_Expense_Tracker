import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { formatDate, todayISO } from '@/lib/format'
import LoadingRing from '@/components/LoadingRing'
import { useActiveTerm, useBlocks, usePresets, useSlots, useTerms } from '../hooks/useLoomData'
import { addBlock, addSlot, createTerm, deleteBlock, deleteSlot, deleteTerm, updateSlot, updateTerm } from '../lib/db'
import { scheduleSync } from '../lib/sync'
import { blockInEffect, blockRunsUntil, formatSlotRange } from '../lib/schedule'
import type { ScheduleBlock, Term, TimeSlot } from '../lib/types'
import LoomSheet from '../components/LoomSheet'

export default function Terms() {
  const terms = useTerms()
  const active = useActiveTerm()
  const slots = useSlots(active?.id)
  const blocks = useBlocks(active?.id)

  const [newTermOpen, setNewTermOpen] = useState(false)
  const [slotsOpen, setSlotsOpen] = useState(false)
  const [blockOpen, setBlockOpen] = useState(false)
  const [editingTerm, setEditingTerm] = useState<Term | null>(null)

  if (terms === undefined) {
    return <div className="px-4 pt-4"><LoadingRing label="Loading terms" /></div>
  }

  const archived = terms.filter((t) => t.archived === 1)
  const currentBlock = blockInEffect(blocks ?? [], todayISO())

  return (
    <div className="px-4 pt-4">
      <header className="mb-5 pr-14">
        <h1 className="font-display text-2xl font-bold text-loomInk">Terms</h1>
        <p className="text-xs text-loomMuted">Semesters, time slots and schedule changes</p>
      </header>

      {active ? (
        <section className="loom-neu-raised mb-5 rounded-card px-4 py-4">
          <div className="mb-3 flex items-start justify-between gap-3">
            <div className="min-w-0">
              <span className="block text-[10px] uppercase tracking-wider text-loomGold">Active term</span>
              <h2 className="font-display truncate text-lg font-semibold text-loomInk">{active.name}</h2>
              <p className="text-xs text-loomMuted">
                {formatDate(active.start_date)} – {formatDate(active.end_date)}
              </p>
            </div>
            <button
              onClick={() => setEditingTerm(active)}
              aria-label={`Edit ${active.name}`}
              className="loom-neu-raised-sm flex-shrink-0 rounded-full px-3 py-1.5 text-[11px] text-loomGold"
            >
              Edit
            </button>
          </div>

          <div className="mb-3 grid grid-cols-2 gap-2 text-center">
            <div className="loom-neu-pressed-sm rounded-xl py-2.5">
              <span className="block text-lg font-semibold tabular-nums text-loomInk">{slots?.length ?? 0}</span>
              <span className="text-[10px] text-loomMuted">time slots</span>
            </div>
            <div className="loom-neu-pressed-sm rounded-xl py-2.5">
              <span className="block text-lg font-semibold tabular-nums text-loomInk">{blocks?.length ?? 0}</span>
              <span className="text-[10px] text-loomMuted">schedule blocks</span>
            </div>
          </div>

          <button onClick={() => setSlotsOpen(true)} className="loom-neu-raised-sm mb-2 min-h-[44px] w-full rounded-card text-sm text-loomInk">
            Manage time slots
          </button>
          <button onClick={() => setBlockOpen(true)} className="loom-neu-raised-sm min-h-[44px] w-full rounded-card text-sm text-loomInk">
            Add a mid-term schedule change
          </button>

          {(blocks ?? []).length > 1 && (
            <div className="mt-3 space-y-1.5">
              {(blocks ?? []).map((b) => (
                <div key={b.id} className="flex items-center justify-between text-[11px]">
                  <span className={b.id === currentBlock?.id ? 'text-loomGold' : 'text-loomMuted'}>
                    {formatDate(b.effective_from)} – {formatDate(blockRunsUntil(blocks ?? [], b, active.end_date))}
                    {b.id === currentBlock?.id ? ' · in effect' : ''}
                  </span>
                  {(blocks ?? []).length > 1 && b.id !== (blocks ?? [])[0].id && (
                    <button
                      onClick={async () => {
                        await deleteBlock(b)
                        scheduleSync()
                      }}
                      className="text-loomMuted opacity-50"
                      aria-label={`Delete schedule block from ${b.effective_from}`}
                    >
                      ✕
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>
      ) : (
        <p className="loom-neu-pressed mb-5 rounded-card px-4 py-8 text-center text-sm text-loomMuted">
          No active term yet. Start one to begin building a timetable.
        </p>
      )}

      <button
        onClick={() => setNewTermOpen(true)}
        className="loom-neu-raised mb-6 min-h-[48px] w-full rounded-card text-sm font-semibold text-loomGold"
      >
        Start new term
      </button>

      {archived.length > 0 && (
        <section>
          <h2 className="font-display mb-2 text-sm font-semibold text-loomInk">Past terms</h2>
          <p className="mb-3 text-[11px] text-loomMuted">Kept in full and read-only. Remove one with ✕ if you no longer need it.</p>
          <div className="space-y-2">
            {archived.map((term) => (
              <div key={term.id} className="loom-neu-raised flex items-center rounded-card">
                <Link to={`/loom?term=${term.id}`} className="flex min-w-0 flex-1 items-center justify-between px-4 py-3">
                  <span className="min-w-0">
                    <span className="block truncate text-sm text-loomInk">{term.name}</span>
                    <span className="block text-[11px] text-loomMuted">
                      {formatDate(term.start_date)} – {formatDate(term.end_date)}
                    </span>
                  </span>
                  <span className="ml-3 flex-shrink-0 text-[11px] text-loomGold">View →</span>
                </Link>
                <button
                  onClick={() => setEditingTerm(term)}
                  aria-label={`Delete ${term.name}`}
                  className="flex-shrink-0 px-4 py-3 text-loomMuted opacity-60"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        </section>
      )}

      <TermEditorSheet
        open={editingTerm !== null}
        term={editingTerm}
        onClose={() => setEditingTerm(null)}
      />

      <NewTermSheet
        open={newTermOpen}
        previousTermId={active?.id}
        previousTermName={active?.name}
        onClose={() => setNewTermOpen(false)}
      />

      {active && (
        <>
          <SlotsSheet open={slotsOpen} termId={active.id} slots={slots ?? []} onClose={() => setSlotsOpen(false)} />
          <AddBlockSheet
            open={blockOpen}
            termId={active.id}
            termStart={active.start_date}
            termEnd={active.end_date}
            currentBlock={currentBlock}
            onClose={() => setBlockOpen(false)}
          />
        </>
      )}
    </div>
  )
}

const FIELD =
  'loom-neu-pressed mb-3 w-full rounded-card border-none bg-transparent px-4 py-3 text-sm text-loomInk outline-none placeholder:text-loomMuted focus:ring-1 focus:ring-loomGold'

function NewTermSheet({
  open,
  previousTermId,
  previousTermName,
  onClose,
}: {
  open: boolean
  previousTermId?: string
  previousTermName?: string
  onClose: () => void
}) {
  const [name, setName] = useState('')
  const [start, setStart] = useState('')
  const [end, setEnd] = useState('')
  const [duplicate, setDuplicate] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [saving, setSaving] = useState(false)

  const valid = name.trim() && start && end && start <= end

  async function handleCreate() {
    if (!valid || saving) return
    setSaving(true)
    try {
      await createTerm({
        name: name.trim(),
        start_date: start,
        end_date: end,
        duplicateFrom: duplicate ? previousTermId : undefined,
      })
      scheduleSync()
      setName('')
      setStart('')
      setEnd('')
      setDuplicate(false)
      setConfirming(false)
      onClose()
    } finally {
      setSaving(false)
    }
  }

  return (
    <LoomSheet open={open} onClose={onClose} title="Start a new term">
      <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Term name, e.g. Fall 2026" aria-label="Term name" className={FIELD} />
      <div className="mb-3 flex gap-3">
        <label className="flex-1">
          <span className="mb-1.5 block text-xs text-loomMuted">Starts</span>
          <input type="date" value={start} onChange={(e) => setStart(e.target.value)} className={FIELD.replace('mb-3', '')} />
        </label>
        <label className="flex-1">
          <span className="mb-1.5 block text-xs text-loomMuted">Ends</span>
          <input type="date" value={end} onChange={(e) => setEnd(e.target.value)} className={FIELD.replace('mb-3', '')} />
        </label>
      </div>

      {previousTermId && (
        <label className="loom-neu-pressed mb-4 flex items-start gap-3 rounded-card px-4 py-3">
          <input
            type="checkbox"
            checked={duplicate}
            onChange={(e) => setDuplicate(e.target.checked)}
            className="mt-0.5 h-4 w-4 flex-shrink-0 accent-loomGold"
          />
          <span className="text-xs text-loomMuted">
            Start from {previousTermName}'s classes and time slots.
            <span className="mt-0.5 block text-[10px]">
              Copies the library and slot structure only — the timetable itself starts empty, since last
              semester's arrangement rarely survives contact with a new one.
            </span>
          </span>
        </label>
      )}

      {previousTermId && (
        <p className="mb-3 text-[11px] text-loomMuted">
          {previousTermName} will be archived. It stays fully viewable, and becomes read-only.
        </p>
      )}

      <button
        onClick={() => (confirming ? handleCreate() : setConfirming(true))}
        disabled={!valid || saving}
        className="loom-neu-raised min-h-[46px] w-full rounded-card text-sm font-semibold text-loomGold disabled:opacity-40"
      >
        {saving ? 'Creating…' : confirming ? (previousTermId ? `Archive ${previousTermName} and start ${name.trim()}` : `Create ${name.trim()}`) : 'Create term'}
      </button>
    </LoomSheet>
  )
}

/**
 * Editing a term and removing one live behind the same sheet: a term you want to
 * shorten and a term you want gone are the same object, and two entry points
 * would mean two places to look.
 *
 * An archived term keeps its dates locked — past terms stay read-only — but can
 * still be deleted outright, which is the one thing that rule was never meant to
 * prevent.
 */
function TermEditorSheet({ open, term, onClose }: { open: boolean; term: Term | null; onClose: () => void }) {
  // Held past the point where the parent clears its selection, so the sheet still
  // has something to draw while it animates out.
  const [shown, setShown] = useState<Term | null>(null)
  useEffect(() => {
    if (term) setShown(term)
  }, [term])

  const subject = term ?? shown
  const allTerms = useTerms()
  const presets = usePresets(subject?.id)
  const slots = useSlots(subject?.id)
  const blocks = useBlocks(subject?.id)

  const [name, setName] = useState('')
  const [start, setStart] = useState('')
  const [end, setEnd] = useState('')
  const [saving, setSaving] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  // Confirming grows the button and adds a line above it, which can push the
  // confirmation itself past the bottom of the sheet — so bring it back into view.
  const deleteRef = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    if (confirmDelete) deleteRef.current?.scrollIntoView({ block: 'nearest' })
  }, [confirmDelete])

  useEffect(() => {
    if (!open || !term) return
    setName(term.name)
    setStart(term.start_date)
    setEnd(term.end_date)
    setConfirmDelete(false)
  }, [open, term])

  if (!subject) return null

  const editable = subject.archived !== 1
  const valid = Boolean(name.trim()) && Boolean(start) && Boolean(end) && start <= end
  const changed = name.trim() !== subject.name || start !== subject.start_date || end !== subject.end_date

  // The earliest block is dragged to the new start date by updateTerm, so it is
  // never a stray; the rest are the user's to move or remove.
  const strays = (blocks ?? []).filter((b, i) => i > 0 && (b.effective_from < start || b.effective_from > end))
  const successor = subject.is_active === 1 ? (allTerms ?? []).find((t) => t.id !== subject.id) : undefined

  async function handleSave() {
    if (!valid || saving) return
    setSaving(true)
    try {
      await updateTerm(subject!.id, { name: name.trim(), start_date: start, end_date: end })
      scheduleSync()
      onClose()
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!confirmDelete) {
      setConfirmDelete(true)
      return
    }
    if (saving) return
    setSaving(true)
    try {
      await deleteTerm(subject!.id)
      scheduleSync()
      onClose()
    } finally {
      setSaving(false)
    }
  }

  return (
    <LoomSheet open={open} onClose={onClose} title={editable ? 'Edit term' : subject.name}>
      {editable ? (
        <>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Term name" aria-label="Term name" className={FIELD} />
          <div className="mb-3 flex gap-3">
            <label className="flex-1">
              <span className="mb-1.5 block text-xs text-loomMuted">Starts</span>
              <input type="date" value={start} onChange={(e) => setStart(e.target.value)} aria-label="Term start date" className={FIELD.replace('mb-3', '')} />
            </label>
            <label className="flex-1">
              <span className="mb-1.5 block text-xs text-loomMuted">Ends</span>
              <input type="date" value={end} onChange={(e) => setEnd(e.target.value)} aria-label="Term end date" className={FIELD.replace('mb-3', '')} />
            </label>
          </div>

          {start > end && start && end && (
            <p className="mb-3 text-[11px]" style={{ color: 'var(--loom-burgundy-soft)' }}>
              The term cannot end before it starts.
            </p>
          )}

          {start !== subject.start_date && (
            <p className="mb-3 text-[11px] text-loomMuted">
              The first schedule block moves with the start date, so the timetable still covers day one.
            </p>
          )}

          {strays.length > 0 && (
            <p className="mb-3 text-[11px]" style={{ color: 'var(--loom-burgundy-soft)' }}>
              {strays.length} schedule change{strays.length === 1 ? '' : 's'} would fall outside these dates
              {' ('}
              {strays.map((b) => formatDate(b.effective_from)).join(', ')}
              {'). '}
              They are kept, not deleted — remove them from the schedule-change list on this screen if you no longer want them.
            </p>
          )}

          <button
            onClick={handleSave}
            disabled={!valid || !changed || saving}
            className="loom-neu-raised mt-1 min-h-[46px] w-full rounded-card text-sm font-semibold text-loomGold disabled:opacity-40"
          >
            {saving ? 'Saving…' : 'Save changes'}
          </button>
        </>
      ) : (
        <p className="mb-4 text-xs text-loomMuted">
          {formatDate(subject.start_date)} – {formatDate(subject.end_date)} · archived and read-only. It can still be deleted.
        </p>
      )}

      {confirmDelete && successor && (
        <p className="mt-4 text-center text-[11px] text-loomMuted">
          {successor.name} becomes the active term.
        </p>
      )}
      {confirmDelete && !successor && subject.is_active === 1 && (
        <p className="mt-4 text-center text-[11px] text-loomMuted">
          This is your only term — you will be starting from scratch.
        </p>
      )}

      <button
        ref={deleteRef}
        onClick={handleDelete}
        disabled={saving}
        className={`mt-2 min-h-[42px] w-full rounded-card px-3 text-xs font-medium leading-snug transition-colors disabled:opacity-40 ${
          confirmDelete ? 'bg-loomBurgundy text-loomInk' : 'text-loomMuted'
        }`}
      >
        {confirmDelete
          ? `Delete ${subject.name}, its ${presets?.length ?? 0} class${(presets?.length ?? 0) === 1 ? '' : 'es'}, ${slots?.length ?? 0} time slot${(slots?.length ?? 0) === 1 ? '' : 's'} and ${blocks?.length ?? 0} schedule block${(blocks?.length ?? 0) === 1 ? '' : 's'}?`
          : 'Delete this term'}
      </button>
    </LoomSheet>
  )
}

function SlotsSheet({ open, termId, slots, onClose }: { open: boolean; termId: string; slots: TimeSlot[]; onClose: () => void }) {
  const [start, setStart] = useState('09:00')
  const [end, setEnd] = useState('10:00')

  return (
    <LoomSheet open={open} onClose={onClose} title="Time slots">
      <p className="mb-4 text-xs text-loomMuted">
        Slots are defined per term, so a new semester can use a completely different structure.
      </p>

      <div className="mb-4 space-y-2">
        {slots.map((slot) => (
          <div key={slot.id} className="loom-neu-raised-sm flex items-center gap-2 rounded-card px-3 py-2">
            <input
              type="time"
              value={slot.start_time}
              onChange={async (e) => {
                await updateSlot(slot, { start_time: e.target.value })
                scheduleSync()
              }}
              aria-label={`Start time for ${formatSlotRange(slot)}`}
              className="min-w-0 flex-1 rounded-lg bg-transparent px-1 py-1.5 text-sm tabular-nums text-loomInk outline-none focus:ring-1 focus:ring-loomGold"
            />
            <span className="text-loomMuted">–</span>
            <input
              type="time"
              value={slot.end_time}
              onChange={async (e) => {
                await updateSlot(slot, { end_time: e.target.value })
                scheduleSync()
              }}
              aria-label={`End time for ${formatSlotRange(slot)}`}
              className="min-w-0 flex-1 rounded-lg bg-transparent px-1 py-1.5 text-sm tabular-nums text-loomInk outline-none focus:ring-1 focus:ring-loomGold"
            />
            <button
              onClick={async () => {
                await deleteSlot(slot)
                scheduleSync()
              }}
              aria-label={`Delete the ${formatSlotRange(slot)} slot`}
              className="flex-shrink-0 px-1 text-loomMuted opacity-60"
            >
              ✕
            </button>
          </div>
        ))}
        {slots.length === 0 && <p className="text-center text-xs text-loomMuted">No slots yet.</p>}
      </div>

      <div className="flex items-end gap-2">
        <label className="flex-1">
          <span className="mb-1 block text-[10px] text-loomMuted">From</span>
          <input type="time" value={start} onChange={(e) => setStart(e.target.value)} className="loom-neu-pressed w-full rounded-card bg-transparent px-3 py-2.5 text-sm tabular-nums text-loomInk outline-none" />
        </label>
        <label className="flex-1">
          <span className="mb-1 block text-[10px] text-loomMuted">To</span>
          <input type="time" value={end} onChange={(e) => setEnd(e.target.value)} className="loom-neu-pressed w-full rounded-card bg-transparent px-3 py-2.5 text-sm tabular-nums text-loomInk outline-none" />
        </label>
        <button
          onClick={async () => {
            await addSlot(termId, start, end)
            scheduleSync()
          }}
          className="loom-neu-raised min-h-[44px] flex-shrink-0 rounded-card px-4 text-sm font-medium text-loomGold"
        >
          Add
        </button>
      </div>
    </LoomSheet>
  )
}

function AddBlockSheet({
  open,
  termId,
  termStart,
  termEnd,
  currentBlock,
  onClose,
}: {
  open: boolean
  termId: string
  termStart: string
  termEnd: string
  currentBlock: ScheduleBlock | undefined
  onClose: () => void
}) {
  const [from, setFrom] = useState('')
  const [copy, setCopy] = useState(true)
  const [saving, setSaving] = useState(false)

  const valid = from && from >= termStart && from <= termEnd

  return (
    <LoomSheet open={open} onClose={onClose} title="Mid-term schedule change">
      <p className="mb-4 text-xs leading-relaxed text-loomMuted">
        The new arrangement takes over from the date you pick and runs to the end of the term, or until
        the next change. Everything before that date keeps the old timetable.
      </p>

      <label className="mb-3 block">
        <span className="mb-1.5 block text-xs text-loomMuted">In effect from</span>
        <input type="date" value={from} min={termStart} max={termEnd} onChange={(e) => setFrom(e.target.value)} className={FIELD} />
      </label>

      {currentBlock && (
        <label className="loom-neu-pressed mb-4 flex items-start gap-3 rounded-card px-4 py-3">
          <input type="checkbox" checked={copy} onChange={(e) => setCopy(e.target.checked)} className="mt-0.5 h-4 w-4 flex-shrink-0 accent-loomGold" />
          <span className="text-xs text-loomMuted">
            Start from the current timetable
            <span className="mt-0.5 block text-[10px]">
              Copies today's arrangement so you only have to change what moved. It is a snapshot — later
              edits to the current block will not reach this one.
            </span>
          </span>
        </label>
      )}

      {from && !valid && (
        <p className="mb-3 text-[11px]" style={{ color: 'var(--loom-burgundy-soft)' }}>
          Pick a date inside the term ({formatDate(termStart)} – {formatDate(termEnd)}).
        </p>
      )}

      <button
        onClick={async () => {
          if (!valid || saving) return
          setSaving(true)
          try {
            await addBlock(termId, from, `From ${from}`, copy ? currentBlock : undefined)
            scheduleSync()
            setFrom('')
            onClose()
          } finally {
            setSaving(false)
          }
        }}
        disabled={!valid || saving}
        className="loom-neu-raised min-h-[46px] w-full rounded-card text-sm font-semibold text-loomGold disabled:opacity-40"
      >
        {saving ? 'Adding…' : 'Add schedule change'}
      </button>
    </LoomSheet>
  )
}
