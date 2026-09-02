import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { formatDateShort } from '@/lib/format'
import { formatSet, formatWeight, setsForExercise } from '../lib/volume'
import type { Exercise, LoggedSet } from '../lib/types'

interface ExerciseLoggerProps {
  exercise: Exercise
  muscleGroupLabel: string | null
  sets: LoggedSet[]
  /** The last time this exercise was lifted — the number to beat. */
  previous: { date: string; sets: LoggedSet[] } | null
  /** Heaviest single set ever recorded for this exercise, for the PR badge. */
  best: number
  onAddSet: (weightKg: number, reps: number) => Promise<void>
  onUpdateSet: (setId: string, patch: { weight_kg?: number; reps?: number }) => Promise<void>
  onDeleteSet: (setId: string) => Promise<void>
}

const INPUT =
  'virtus-neu-pressed w-full rounded-card border-none bg-transparent px-3 py-3 text-center text-base tabular-nums text-inkCharcoal outline-none placeholder:text-inkSoft/60 focus:ring-2 focus:ring-bronze'

/**
 * One exercise, logged live. No pre-planning: a set exists only once it has been
 * done, and it is written the moment it is added.
 *
 * The weight and rep fields carry forward from the set just logged (falling back to
 * the same set number last session), because the overwhelmingly common case mid-
 * workout is repeating the same load — starting from an empty field every set would
 * mean retyping the same two numbers five times with a bar still in your hands.
 */
export default function ExerciseLogger({
  exercise,
  muscleGroupLabel,
  sets,
  previous,
  best,
  onAddSet,
  onUpdateSet,
  onDeleteSet,
}: ExerciseLoggerProps) {
  const reduceMotion = useReducedMotion()
  const mine = setsForExercise(sets, exercise.id)

  const [weight, setWeight] = useState('')
  const [reps, setReps] = useState('')
  const [saving, setSaving] = useState(false)
  const [flashId, setFlashId] = useState<string | null>(null)
  const [editing, setEditing] = useState<string | null>(null)
  const previousCount = useRef(mine.length)

  // Seed the inputs whenever the focused exercise changes: last set done today,
  // else what was done for that set number last time, else empty.
  useEffect(() => {
    const lastToday = mine[mine.length - 1]
    const suggestion = lastToday ?? previous?.sets[mine.length] ?? previous?.sets[previous.sets.length - 1]
    setWeight(suggestion ? formatWeight(suggestion.weight_kg) : '')
    setReps(suggestion ? String(suggestion.reps) : '')
    setEditing(null)
    // Only on a change of exercise — retyping the user's in-progress input on every
    // set would fight them.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [exercise.id])

  // The one confirming animation in the module: the row that just landed.
  useEffect(() => {
    if (mine.length > previousCount.current) {
      const added = mine[mine.length - 1]
      setFlashId(added?.id ?? null)
      const timer = setTimeout(() => setFlashId(null), 900)
      previousCount.current = mine.length
      return () => clearTimeout(timer)
    }
    previousCount.current = mine.length
  }, [mine])

  const weightValue = Number(weight)
  const repsValue = Number(reps)
  const valid = weight !== '' && reps !== '' && Number.isFinite(weightValue) && weightValue >= 0 && Number.isInteger(repsValue) && repsValue > 0
  const isPr = valid && weightValue > best && best > 0

  async function handleAdd() {
    if (!valid || saving) return
    setSaving(true)
    try {
      await onAddSet(weightValue, repsValue)
      // Weight and reps stay put for the next set — see the note above.
    } finally {
      setSaving(false)
    }
  }

  return (
    <section>
      <header className="mb-3">
        <h2 className="font-inscribe text-xl font-semibold text-inkCharcoal">{exercise.name}</h2>
        {muscleGroupLabel && <p className="text-xs text-inkSoft">{muscleGroupLabel}</p>}
      </header>

      {/* Progressive overload reference — the target, kept visible while logging. */}
      <div className="virtus-neu-pressed mb-4 rounded-card px-3.5 py-3">
        {previous ? (
          <>
            <p className="mb-1.5 text-[11px] text-inkSoft">Last session · {formatDateShort(previous.date)}</p>
            <div className="flex flex-wrap gap-1.5">
              {previous.sets.map((set) => (
                <span
                  key={set.id}
                  className="rounded-lg px-2 py-1 text-[11px] tabular-nums"
                  style={{ background: 'var(--marble-shadow)', color: 'var(--ink-charcoal)' }}
                >
                  {formatSet(set)}
                </span>
              ))}
            </div>
          </>
        ) : (
          <p className="text-[11px] text-inkSoft">No previous session — this is your first log of this lift.</p>
        )}
      </div>

      <div className="mb-3 space-y-2">
        <AnimatePresence initial={false}>
          {mine.map((set) => (
            <motion.div
              key={set.id}
              layout={!reduceMotion}
              initial={reduceMotion ? false : { opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={reduceMotion ? { opacity: 0 } : { opacity: 0, x: -12 }}
              transition={{ duration: 0.18 }}
              className="relative overflow-hidden rounded-card"
            >
              {/* The confirming flash: a bronze wash that fades off the row it landed on. */}
              {flashId === set.id && !reduceMotion && (
                <motion.span
                  className="pointer-events-none absolute inset-0 rounded-card"
                  style={{ background: 'var(--bronze-primary)' }}
                  initial={{ opacity: 0.5 }}
                  animate={{ opacity: 0 }}
                  transition={{ duration: 0.85, ease: 'easeOut' }}
                  aria-hidden
                />
              )}

              {editing === set.id ? (
                <SetEditor
                  set={set}
                  onCancel={() => setEditing(null)}
                  onSave={async (patch) => {
                    await onUpdateSet(set.id, patch)
                    setEditing(null)
                  }}
                  onDelete={async () => {
                    await onDeleteSet(set.id)
                    setEditing(null)
                  }}
                />
              ) : (
                <button
                  onClick={() => setEditing(set.id)}
                  aria-label={`Set ${set.set_number}, ${formatSet(set)}. Tap to edit.`}
                  className="virtus-neu-raised-sm flex w-full items-center gap-3 rounded-card px-3.5 py-3 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-bronze"
                >
                  <span className="w-12 flex-shrink-0 text-[11px] text-inkSoft">Set {set.set_number}</span>
                  <span className="flex-1 text-sm font-semibold tabular-nums text-inkCharcoal">
                    {formatWeight(set.weight_kg)}
                    <span className="ml-0.5 text-xs font-normal text-inkSoft">kg</span>
                  </span>
                  <span className="text-sm font-semibold tabular-nums text-inkCharcoal">
                    {set.reps}
                    <span className="ml-0.5 text-xs font-normal text-inkSoft">reps</span>
                  </span>
                  {best > 0 && set.weight_kg >= best && (
                    <span
                      className="flex-shrink-0 rounded-md px-1.5 py-0.5 text-[9px] font-semibold"
                      style={{ background: 'var(--ember-red)', color: 'var(--marble-base)' }}
                    >
                      PR
                    </span>
                  )}
                </button>
              )}
            </motion.div>
          ))}
        </AnimatePresence>

        {mine.length === 0 && (
          <p className="virtus-neu-pressed rounded-card px-4 py-4 text-center text-xs text-inkSoft">
            No sets logged yet. Add the first one below.
          </p>
        )}
      </div>

      {/* The add row stays at the bottom, in thumb reach, and never moves. */}
      <div className="flex items-end gap-2">
        <label className="flex-1">
          <span className="mb-1 block text-[10px] text-inkSoft">Weight (kg)</span>
          <input
            value={weight}
            onChange={(e) => setWeight(e.target.value)}
            inputMode="decimal"
            enterKeyHint="next"
            placeholder="0"
            aria-label="Weight in kilograms"
            className={INPUT}
          />
        </label>
        <label className="flex-1">
          <span className="mb-1 block text-[10px] text-inkSoft">Reps</span>
          <input
            value={reps}
            onChange={(e) => setReps(e.target.value)}
            inputMode="numeric"
            enterKeyHint="done"
            placeholder="0"
            aria-label="Repetitions"
            onKeyDown={(e) => {
              if (e.key === 'Enter') void handleAdd()
            }}
            className={INPUT}
          />
        </label>
        <button
          onClick={handleAdd}
          disabled={!valid || saving}
          aria-label="Add set"
          className="min-h-[50px] flex-shrink-0 rounded-card px-5 text-sm font-semibold transition-transform focus:outline-none focus-visible:ring-2 focus-visible:ring-bronzeDeep disabled:opacity-35 active:scale-95"
          style={{ background: 'var(--bronze-primary)', color: 'var(--marble-base)' }}
        >
          Add
        </button>
      </div>

      {isPr && (
        <p className="mt-2 text-center text-[11px] font-medium" style={{ color: 'var(--ember-red)' }}>
          That would be a personal best — your heaviest so far is {formatWeight(best)}kg.
        </p>
      )}
    </section>
  )
}

function SetEditor({
  set,
  onSave,
  onDelete,
  onCancel,
}: {
  set: LoggedSet
  onSave: (patch: { weight_kg: number; reps: number }) => Promise<void>
  onDelete: () => Promise<void>
  onCancel: () => void
}) {
  const [weight, setWeight] = useState(formatWeight(set.weight_kg))
  const [reps, setReps] = useState(String(set.reps))
  const [busy, setBusy] = useState(false)

  const weightValue = Number(weight)
  const repsValue = Number(reps)
  const valid = Number.isFinite(weightValue) && weightValue >= 0 && Number.isInteger(repsValue) && repsValue > 0

  return (
    <div className="virtus-neu-pressed rounded-card px-3 py-3">
      <div className="mb-2 flex items-end gap-2">
        <span className="w-12 flex-shrink-0 pb-3 text-[11px] text-inkSoft">Set {set.set_number}</span>
        <input
          value={weight}
          onChange={(e) => setWeight(e.target.value)}
          inputMode="decimal"
          aria-label={`Weight for set ${set.set_number}`}
          className="virtus-neu-raised-sm w-full flex-1 rounded-card border-none bg-transparent px-2 py-2.5 text-center text-sm tabular-nums text-inkCharcoal outline-none focus:ring-2 focus:ring-bronze"
        />
        <input
          value={reps}
          onChange={(e) => setReps(e.target.value)}
          inputMode="numeric"
          aria-label={`Reps for set ${set.set_number}`}
          className="virtus-neu-raised-sm w-full flex-1 rounded-card border-none bg-transparent px-2 py-2.5 text-center text-sm tabular-nums text-inkCharcoal outline-none focus:ring-2 focus:ring-bronze"
        />
      </div>
      <div className="flex gap-2">
        <button
          onClick={async () => {
            if (!valid || busy) return
            setBusy(true)
            try {
              await onSave({ weight_kg: weightValue, reps: repsValue })
            } finally {
              setBusy(false)
            }
          }}
          disabled={!valid || busy}
          className="min-h-[38px] flex-1 rounded-card text-xs font-semibold disabled:opacity-40 focus:outline-none focus-visible:ring-2 focus-visible:ring-bronzeDeep"
          style={{ background: 'var(--bronze-primary)', color: 'var(--marble-base)' }}
        >
          Save
        </button>
        <button
          onClick={onCancel}
          className="virtus-neu-raised-sm min-h-[38px] flex-1 rounded-card text-xs text-inkSoft focus:outline-none focus-visible:ring-2 focus-visible:ring-bronze"
        >
          Cancel
        </button>
        <button
          onClick={async () => {
            setBusy(true)
            try {
              await onDelete()
            } finally {
              setBusy(false)
            }
          }}
          disabled={busy}
          aria-label={`Delete set ${set.set_number}`}
          className="min-h-[38px] rounded-card px-3 text-xs font-medium focus:outline-none focus-visible:ring-2 focus-visible:ring-ember"
          style={{ color: 'var(--ember-red)' }}
        >
          Delete
        </button>
      </div>
    </div>
  )
}
