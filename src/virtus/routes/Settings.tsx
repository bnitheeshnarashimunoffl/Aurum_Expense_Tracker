import { useState } from 'react'
import LoadingRing from '@/components/LoadingRing'
import { useVirtusPlan } from '../hooks/useVirtusPlan'
import { useVirtusPin } from '../hooks/useVirtusPin'
import { WEEKDAY_FULL } from '../lib/types'
import VirtusSheet from '../components/VirtusSheet'
import PinSetupSheet from '../components/PinSetupSheet'
import type { Exercise, SplitDay } from '../lib/types'

const FIELD =
  'virtus-neu-pressed w-full rounded-card border-none bg-transparent px-4 py-3 text-sm text-inkCharcoal outline-none placeholder:text-inkSoft/70 focus:ring-2 focus:ring-bronze'

type Section = 'library' | 'splits' | 'schedule'

export default function Settings() {
  const plan = useVirtusPlan()
  const [section, setSection] = useState<Section>('library')

  if (plan.loading) {
    return (
      <div className="px-4 pt-4">
        <LoadingRing label="Loading settings" />
      </div>
    )
  }

  return (
    <div className="px-4 pt-4">
      <header className="mb-5 pr-14">
        <h1 className="font-inscribe text-2xl font-semibold text-inkCharcoal">Settings</h1>
        <p className="text-xs text-inkSoft">Your exercises, your split days, and what falls on which weekday.</p>
      </header>

      <div className="virtus-neu-pressed mb-5 flex rounded-full p-1" role="group" aria-label="Settings section">
        {(
          [
            ['library', 'Library'],
            ['splits', 'Split days'],
            ['schedule', 'Schedule'],
          ] as const
        ).map(([value, label]) => (
          <button
            key={value}
            onClick={() => setSection(value)}
            aria-pressed={section === value}
            className={`min-h-[36px] flex-1 rounded-full text-xs font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-bronzeDeep ${
              section === value ? 'text-marbleBase' : 'text-inkSoft'
            }`}
            style={section === value ? { background: 'var(--bronze-primary)' } : undefined}
          >
            {label}
          </button>
        ))}
      </div>

      {section === 'library' && <LibrarySection plan={plan} />}
      {section === 'splits' && <SplitsSection plan={plan} />}
      {section === 'schedule' && <ScheduleSection plan={plan} />}

      <PinSection />
    </div>
  )
}

type Plan = ReturnType<typeof useVirtusPlan>

// ------------------------------------------------------------------ library ----

function LibrarySection({ plan }: { plan: Plan }) {
  const [groupOpen, setGroupOpen] = useState(false)
  const [exerciseOpen, setExerciseOpen] = useState(false)
  const [editing, setEditing] = useState<Exercise | null>(null)
  const [filter, setFilter] = useState<string | null>(null)

  const visible = filter === null ? plan.exercises : plan.exercises.filter((e) => e.muscle_group_id === filter)

  return (
    <section className="mb-6">
      {plan.muscleGroups.length > 0 && (
        <div className="mb-3 flex gap-1.5 overflow-x-auto pb-1">
          <FilterChip active={filter === null} onClick={() => setFilter(null)} label="All" />
          {plan.muscleGroups.map((group) => (
            <FilterChip
              key={group.id}
              active={filter === group.id}
              onClick={() => setFilter(group.id)}
              label={group.label}
            />
          ))}
        </div>
      )}

      {visible.length === 0 ? (
        <p className="virtus-neu-pressed mb-3 rounded-card px-4 py-8 text-center text-sm text-inkSoft">
          {plan.exercises.length === 0
            ? 'Nothing in the library yet. Add the lifts you actually do — they are what split days are built from.'
            : 'No exercises in this group.'}
        </p>
      ) : (
        <div className="mb-3 space-y-2">
          {visible.map((exercise) => (
            <button
              key={exercise.id}
              onClick={() => setEditing(exercise)}
              aria-label={`Edit ${exercise.name}`}
              className="virtus-neu-raised-sm flex w-full items-center justify-between gap-3 rounded-card px-3.5 py-3 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-bronze"
            >
              <span className="min-w-0">
                <span className="block truncate text-sm font-medium text-inkCharcoal">{exercise.name}</span>
                <span className="block truncate text-[11px] text-inkSoft">
                  {plan.muscleGroups.find((g) => g.id === exercise.muscle_group_id)?.label ?? 'Uncategorised'}
                </span>
              </span>
              <span className="flex-shrink-0 text-[11px] text-bronzeDeep">Edit</span>
            </button>
          ))}
        </div>
      )}

      <div className="flex gap-2">
        <button
          onClick={() => setExerciseOpen(true)}
          className="virtus-neu-raised min-h-[46px] flex-[1.4] rounded-card text-sm font-semibold text-bronzeDeep focus:outline-none focus-visible:ring-2 focus-visible:ring-bronze"
        >
          + Exercise
        </button>
        <button
          onClick={() => setGroupOpen(true)}
          className="virtus-neu-raised-sm min-h-[46px] flex-1 rounded-card text-xs text-inkSoft focus:outline-none focus-visible:ring-2 focus-visible:ring-bronze"
        >
          Muscle groups
        </button>
      </div>

      <ExerciseSheet
        open={exerciseOpen || editing !== null}
        exercise={editing}
        plan={plan}
        onClose={() => {
          setExerciseOpen(false)
          setEditing(null)
        }}
      />
      <MuscleGroupSheet open={groupOpen} plan={plan} onClose={() => setGroupOpen(false)} />
    </section>
  )
}

function FilterChip({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return (
    <button
      onClick={onClick}
      aria-pressed={active}
      className={`flex-shrink-0 rounded-full px-3 py-1.5 text-[11px] focus:outline-none focus-visible:ring-2 focus-visible:ring-bronze ${
        active ? 'text-marbleBase' : 'virtus-neu-raised-sm text-inkSoft'
      }`}
      style={active ? { background: 'var(--bronze-primary)' } : undefined}
    >
      {label}
    </button>
  )
}

function ExerciseSheet({
  open,
  exercise,
  plan,
  onClose,
}: {
  open: boolean
  exercise: Exercise | null
  plan: Plan
  onClose: () => void
}) {
  const [name, setName] = useState('')
  const [groupId, setGroupId] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [saving, setSaving] = useState(false)
  const [seeded, setSeeded] = useState<string | null>(null)

  // Seeded on open rather than in an effect, so the fields are right on first paint.
  const key = exercise?.id ?? 'new'
  if (open && seeded !== key) {
    setSeeded(key)
    setName(exercise?.name ?? '')
    setGroupId(exercise?.muscle_group_id ?? null)
    setConfirmDelete(false)
  }
  if (!open && seeded !== null) setSeeded(null)

  async function handleSave() {
    if (!name.trim() || saving) return
    setSaving(true)
    try {
      if (exercise) await plan.updateExercise(exercise.id, { name, muscle_group_id: groupId })
      else await plan.addExercise(name, groupId)
      onClose()
    } finally {
      setSaving(false)
    }
  }

  return (
    <VirtusSheet open={open} onClose={onClose} title={exercise ? 'Edit exercise' : 'New exercise'}>
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Exercise name, e.g. Incline Dumbbell Press"
        aria-label="Exercise name"
        className={`${FIELD} mb-3`}
      />

      <p className="mb-2 text-xs text-inkSoft">Muscle group</p>
      <div className="mb-4 flex flex-wrap gap-1.5">
        <FilterChip active={groupId === null} onClick={() => setGroupId(null)} label="Uncategorised" />
        {plan.muscleGroups.map((group) => (
          <FilterChip
            key={group.id}
            active={groupId === group.id}
            onClick={() => setGroupId(group.id)}
            label={group.label}
          />
        ))}
      </div>

      <button
        onClick={handleSave}
        disabled={!name.trim() || saving}
        className="min-h-[46px] w-full rounded-card text-sm font-semibold disabled:opacity-40 focus:outline-none focus-visible:ring-2 focus-visible:ring-bronzeDeep"
        style={{ background: 'var(--bronze-primary)', color: 'var(--marble-base)' }}
      >
        {saving ? 'Saving…' : exercise ? 'Save changes' : 'Add to library'}
      </button>

      {exercise && (
        <>
          <button
            onClick={async () => {
              if (!confirmDelete) {
                setConfirmDelete(true)
                return
              }
              await plan.deleteExercise(exercise.id)
              onClose()
            }}
            className="mt-2 min-h-[42px] w-full rounded-card px-3 text-xs font-medium leading-snug focus:outline-none focus-visible:ring-2 focus-visible:ring-ember"
            style={
              confirmDelete
                ? { background: 'var(--ember-red)', color: 'var(--marble-base)' }
                : { color: 'var(--ink-soft)' }
            }
          >
            {confirmDelete ? `Remove ${exercise.name} from the library?` : 'Remove from library'}
          </button>
          {confirmDelete && (
            <p className="mt-2 text-center text-[11px] text-inkSoft">
              It leaves the library and every split day. Sets you already logged against it are kept, and keep its
              name.
            </p>
          )}
        </>
      )}
    </VirtusSheet>
  )
}

function MuscleGroupSheet({ open, plan, onClose }: { open: boolean; plan: Plan; onClose: () => void }) {
  const [label, setLabel] = useState('')

  return (
    <VirtusSheet open={open} onClose={onClose} title="Muscle groups">
      <p className="mb-4 text-xs text-inkSoft">
        Your own categories — add whatever you actually split by. Deleting one leaves its exercises Uncategorised
        rather than removing them.
      </p>

      <div className="mb-4 space-y-2">
        {plan.muscleGroups.map((group) => {
          const count = plan.exercises.filter((e) => e.muscle_group_id === group.id).length
          return (
            <div key={group.id} className="virtus-neu-raised-sm flex items-center gap-2 rounded-card px-3.5 py-2.5">
              <input
                defaultValue={group.label}
                onBlur={(e) => {
                  if (e.target.value.trim() && e.target.value !== group.label) {
                    void plan.renameMuscleGroup(group.id, e.target.value)
                  }
                }}
                aria-label={`Rename ${group.label}`}
                className="min-w-0 flex-1 rounded-lg bg-transparent px-1 py-1 text-sm text-inkCharcoal outline-none focus:ring-2 focus:ring-bronze"
              />
              <span className="flex-shrink-0 text-[11px] tabular-nums text-inkSoft">{count}</span>
              <button
                onClick={() => void plan.deleteMuscleGroup(group.id)}
                aria-label={`Delete ${group.label}`}
                className="flex-shrink-0 px-1 text-inkSoft opacity-60 focus:outline-none focus-visible:ring-2 focus-visible:ring-ember"
              >
                ✕
              </button>
            </div>
          )
        })}
        {plan.muscleGroups.length === 0 && (
          <p className="text-center text-xs text-inkSoft">None yet.</p>
        )}
      </div>

      <div className="flex gap-2">
        <input
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="e.g. Back"
          aria-label="New muscle group"
          className={FIELD}
        />
        <button
          onClick={async () => {
            if (!label.trim()) return
            await plan.addMuscleGroup(label)
            setLabel('')
          }}
          disabled={!label.trim()}
          className="min-h-[46px] flex-shrink-0 rounded-card px-4 text-sm font-semibold disabled:opacity-40 focus:outline-none focus-visible:ring-2 focus-visible:ring-bronzeDeep"
          style={{ background: 'var(--bronze-primary)', color: 'var(--marble-base)' }}
        >
          Add
        </button>
      </div>
    </VirtusSheet>
  )
}

// ------------------------------------------------------------------- splits ----

function SplitsSection({ plan }: { plan: Plan }) {
  const [name, setName] = useState('')
  const [editing, setEditing] = useState<SplitDay | null>(null)

  return (
    <section className="mb-6">
      {plan.splitDays.length === 0 ? (
        <p className="virtus-neu-pressed mb-3 rounded-card px-4 py-8 text-center text-sm text-inkSoft">
          No split days yet. A split day is just a named, ordered list of exercises — "Back Width", "Legs",
          whatever you call yours.
        </p>
      ) : (
        <div className="mb-3 space-y-2">
          {plan.splitDays.map((splitDay) => {
            const exercises = plan.exercisesOf(splitDay.id)
            return (
              <button
                key={splitDay.id}
                onClick={() => setEditing(splitDay)}
                aria-label={`Edit ${splitDay.name}`}
                className="virtus-neu-raised-sm flex w-full items-center justify-between gap-3 rounded-card px-3.5 py-3 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-bronze"
              >
                <span className="min-w-0">
                  <span className="block truncate text-sm font-semibold text-inkCharcoal">{splitDay.name}</span>
                  <span className="block truncate text-[11px] text-inkSoft">
                    {exercises.length === 0
                      ? 'No exercises yet'
                      : `${exercises.length} · ${exercises.map((e) => e.name).join(', ')}`}
                  </span>
                </span>
                <span className="flex-shrink-0 text-[11px] text-bronzeDeep">Edit</span>
              </button>
            )
          })}
        </div>
      )}

      <div className="flex gap-2">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="New split day, e.g. Chest + Triceps"
          aria-label="New split day name"
          className={FIELD}
        />
        <button
          onClick={async () => {
            if (!name.trim()) return
            await plan.addSplitDay(name)
            setName('')
          }}
          disabled={!name.trim()}
          className="min-h-[46px] flex-shrink-0 rounded-card px-4 text-sm font-semibold disabled:opacity-40 focus:outline-none focus-visible:ring-2 focus-visible:ring-bronzeDeep"
          style={{ background: 'var(--bronze-primary)', color: 'var(--marble-base)' }}
        >
          Add
        </button>
      </div>

      <SplitDayEditor
        open={editing !== null}
        splitDay={editing}
        plan={plan}
        onClose={() => setEditing(null)}
      />
    </section>
  )
}

function SplitDayEditor({
  open,
  splitDay,
  plan,
  onClose,
}: {
  open: boolean
  splitDay: SplitDay | null
  plan: Plan
  onClose: () => void
}) {
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [adding, setAdding] = useState(false)

  if (!splitDay) return null
  const assigned = plan.exercisesOf(splitDay.id)
  const assignedIds = new Set(assigned.map((e) => e.id))
  const available = plan.exercises.filter((e) => !assignedIds.has(e.id))

  return (
    <VirtusSheet open={open} onClose={onClose} title={splitDay.name}>
      <input
        defaultValue={splitDay.name}
        onBlur={(e) => {
          if (e.target.value.trim() && e.target.value !== splitDay.name) {
            void plan.renameSplitDay(splitDay.id, e.target.value)
          }
        }}
        aria-label="Split day name"
        className={`${FIELD} mb-4`}
      />

      <p className="mb-2 text-xs text-inkSoft">
        Exercises, in the order you train them. This is the order the logging screen steps through.
      </p>

      <div className="mb-3 space-y-2">
        {assigned.map((exercise, i) => (
          <div key={exercise.id} className="virtus-neu-raised-sm flex items-center gap-1.5 rounded-card px-3 py-2.5">
            <span className="w-5 flex-shrink-0 text-[11px] tabular-nums text-inkSoft">{i + 1}</span>
            <span className="min-w-0 flex-1 truncate text-sm text-inkCharcoal">{exercise.name}</span>
            <button
              onClick={() => void plan.moveExerciseInSplitDay(splitDay.id, exercise.id, -1)}
              disabled={i === 0}
              aria-label={`Move ${exercise.name} up`}
              className="flex-shrink-0 px-1.5 text-inkSoft disabled:opacity-25 focus:outline-none focus-visible:ring-2 focus-visible:ring-bronze"
            >
              ↑
            </button>
            <button
              onClick={() => void plan.moveExerciseInSplitDay(splitDay.id, exercise.id, 1)}
              disabled={i === assigned.length - 1}
              aria-label={`Move ${exercise.name} down`}
              className="flex-shrink-0 px-1.5 text-inkSoft disabled:opacity-25 focus:outline-none focus-visible:ring-2 focus-visible:ring-bronze"
            >
              ↓
            </button>
            <button
              onClick={() => void plan.removeExerciseFromSplitDay(splitDay.id, exercise.id)}
              aria-label={`Remove ${exercise.name} from ${splitDay.name}`}
              className="flex-shrink-0 px-1.5 text-inkSoft opacity-60 focus:outline-none focus-visible:ring-2 focus-visible:ring-ember"
            >
              ✕
            </button>
          </div>
        ))}
        {assigned.length === 0 && (
          <p className="virtus-neu-pressed rounded-card px-4 py-5 text-center text-xs text-inkSoft">
            Nothing assigned yet.
          </p>
        )}
      </div>

      {adding ? (
        <div className="virtus-neu-pressed mb-3 max-h-64 overflow-y-auto rounded-card p-2">
          {available.length === 0 ? (
            <p className="px-2 py-4 text-center text-xs text-inkSoft">
              Every exercise in your library is already in this day.
            </p>
          ) : (
            available.map((exercise) => (
              <button
                key={exercise.id}
                onClick={async () => {
                  await plan.addExerciseToSplitDay(splitDay.id, exercise.id)
                }}
                className="flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-left text-sm text-inkCharcoal focus:outline-none focus-visible:ring-2 focus-visible:ring-bronze"
              >
                <span className="truncate">{exercise.name}</span>
                <span className="ml-2 flex-shrink-0 text-[11px] text-bronzeDeep">Add</span>
              </button>
            ))
          )}
        </div>
      ) : (
        <button
          onClick={() => setAdding(true)}
          className="virtus-neu-raised mb-3 min-h-[44px] w-full rounded-card text-sm font-medium text-bronzeDeep focus:outline-none focus-visible:ring-2 focus-visible:ring-bronze"
        >
          + Add an exercise
        </button>
      )}

      <button
        onClick={async () => {
          if (!confirmDelete) {
            setConfirmDelete(true)
            return
          }
          await plan.deleteSplitDay(splitDay.id)
          onClose()
        }}
        className="min-h-[42px] w-full rounded-card px-3 text-xs font-medium leading-snug focus:outline-none focus-visible:ring-2 focus-visible:ring-ember"
        style={
          confirmDelete ? { background: 'var(--ember-red)', color: 'var(--marble-base)' } : { color: 'var(--ink-soft)' }
        }
      >
        {confirmDelete ? `Delete ${splitDay.name}?` : 'Delete this split day'}
      </button>
      {confirmDelete && (
        <p className="mt-2 text-center text-[11px] text-inkSoft">
          Workouts you logged on it keep all their sets — they just stop naming this split day.
        </p>
      )}
    </VirtusSheet>
  )
}

// ----------------------------------------------------------------- schedule ----

function ScheduleSection({ plan }: { plan: Plan }) {
  return (
    <section className="mb-6">
      <p className="mb-3 text-xs text-inkSoft">
        What Virtus suggests on each weekday. Changing it only affects days from here on — nothing already logged
        is rewritten.
      </p>

      <div className="space-y-2">
        {WEEKDAY_FULL.map((label, day) => {
          const entry = plan.schedule.find((e) => e.day_of_week === day)
          const value = entry ? (entry.split_day_id ?? 'REST') : 'UNSET'
          return (
            <div key={label} className="virtus-neu-raised-sm flex items-center gap-3 rounded-card px-3.5 py-2.5">
              <span className="w-20 flex-shrink-0 text-sm text-inkCharcoal">{label}</span>
              <select
                value={value}
                onChange={(e) => {
                  const next = e.target.value
                  if (next === 'UNSET') void plan.clearScheduleDay(day)
                  else if (next === 'REST') void plan.setScheduleDay(day, null)
                  else void plan.setScheduleDay(day, next)
                }}
                aria-label={`What to train on ${label}`}
                className="virtus-neu-pressed-sm min-h-[38px] min-w-0 flex-1 rounded-card border-none bg-transparent px-2.5 text-sm text-inkCharcoal outline-none focus:ring-2 focus:ring-bronze"
              >
                <option value="UNSET">Not set</option>
                <option value="REST">Rest</option>
                {plan.splitDays.map((splitDay) => (
                  <option key={splitDay.id} value={splitDay.id}>
                    {splitDay.name}
                  </option>
                ))}
              </select>
            </div>
          )
        })}
      </div>

      {plan.splitDays.length === 0 && (
        <p className="mt-3 text-center text-[11px] text-inkSoft">
          Create a split day first and it will show up in every one of these.
        </p>
      )}
    </section>
  )
}

// ---------------------------------------------------------------------- pin ----

function PinSection() {
  const { loading, hasPin, setPin } = useVirtusPin()
  const [open, setOpen] = useState(false)

  return (
    <section className="mb-4">
      <h2 className="font-inscribe mb-2 text-sm font-semibold text-inkCharcoal">PIN</h2>
      <p className="mb-3 text-xs text-inkSoft">
        {loading
          ? 'Checking…'
          : hasPin
            ? 'Set. Editing any workout before today asks for it first.'
            : 'Not set yet. You will be asked to choose one the first time you edit a past workout.'}
      </p>
      <button
        onClick={() => setOpen(true)}
        className="virtus-neu-raised-sm min-h-[44px] w-full rounded-card text-sm text-inkCharcoal focus:outline-none focus-visible:ring-2 focus-visible:ring-bronze"
      >
        {hasPin ? 'Change PIN' : 'Set a PIN'}
      </button>

      <PinSetupSheet
        open={open}
        onComplete={async (pin) => {
          await setPin(pin)
          setOpen(false)
        }}
        onCancel={() => setOpen(false)}
      />
    </section>
  )
}
