import { useState } from 'react'
import { useHabits } from '../hooks/useHabits'
import { usePinGate } from '../hooks/usePinGate'
import AddHabitFlow from '../components/AddHabitFlow'
import EditStagesSheet from '../components/EditStagesSheet'
import type { Habit } from '../lib/types'

export default function Settings() {
  const { habits, addHabit, deactivateHabit, reorderHabits, updateHabitStages } = useHabits()
  const { requestGate, gate } = usePinGate()

  const [unlocked, setUnlocked] = useState(false)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const [addOpen, setAddOpen] = useState(false)
  const [editingHabit, setEditingHabit] = useState<Habit | null>(null)

  function unlock() {
    requestGate(() => setUnlocked(true))
  }

  async function move(habit: Habit, direction: -1 | 1) {
    const index = habits.findIndex((h) => h.id === habit.id)
    const swapWith = index + direction
    if (swapWith < 0 || swapWith >= habits.length) return
    const reordered = [...habits]
    ;[reordered[index], reordered[swapWith]] = [reordered[swapWith], reordered[index]]
    await reorderHabits(reordered.map((h) => h.id))
  }

  return (
    <div className="px-4 pt-4">
      <h1 className="font-display mb-4 text-2xl font-bold text-primary">Kindle Settings</h1>

      <section className="mb-6">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="font-display text-sm font-medium text-primary">Habits</h2>
          {unlocked ? (
            <button onClick={() => setUnlocked(false)} className="text-xs text-muted">
              Lock
            </button>
          ) : (
            <button onClick={unlock} className="kindle-neu-raised min-h-[36px] rounded-full px-3 text-xs font-medium text-accent">
              Unlock editing
            </button>
          )}
        </div>

        <div className="space-y-2">
          {habits.map((habit, i) => (
            <div key={habit.id} className="kindle-neu-raised flex items-center justify-between rounded-card px-4 py-3">
              <div>
                <span className="block text-sm text-primary">{habit.label}</span>
                <span className="block text-xs text-muted">
                  {habit.type === 'binary' ? 'Binary' : `${habit.max_stage} stages${habit.target_value != null ? ` · target ${habit.target_value} ${habit.target_unit ?? ''}` : ''}`}
                </span>
              </div>
              {unlocked && (
                <div className="flex flex-shrink-0 items-center gap-1">
                  {habit.type === 'multi_stage' && (
                    <button
                      onClick={() => setEditingHabit(habit)}
                      aria-label={`Edit stages for ${habit.label}`}
                      className="flex h-8 w-8 items-center justify-center text-accent"
                    >
                      ✎
                    </button>
                  )}
                  <button
                    onClick={() => move(habit, -1)}
                    disabled={i === 0}
                    aria-label={`Move ${habit.label} up`}
                    className="flex h-8 w-8 items-center justify-center text-muted disabled:opacity-30"
                  >
                    ↑
                  </button>
                  <button
                    onClick={() => move(habit, 1)}
                    disabled={i === habits.length - 1}
                    aria-label={`Move ${habit.label} down`}
                    className="flex h-8 w-8 items-center justify-center text-muted disabled:opacity-30"
                  >
                    ↓
                  </button>
                  {confirmDeleteId === habit.id ? (
                    <button
                      onClick={async () => {
                        await deactivateHabit(habit.id)
                        setConfirmDeleteId(null)
                      }}
                      className="ml-1 min-h-[32px] rounded-full bg-expense px-2 text-xs font-medium text-ink"
                    >
                      Confirm?
                    </button>
                  ) : (
                    <button
                      onClick={() => setConfirmDeleteId(habit.id)}
                      aria-label={`Delete ${habit.label}`}
                      className="ml-1 flex h-8 w-8 items-center justify-center text-expense"
                    >
                      ✕
                    </button>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>

        {unlocked && (
          <button
            onClick={() => setAddOpen(true)}
            className="kindle-neu-raised mt-4 min-h-[44px] w-full rounded-card px-4 text-sm font-medium text-accent"
          >
            + Add habit
          </button>
        )}
      </section>

      <AddHabitFlow
        open={addOpen}
        onCancel={() => setAddOpen(false)}
        onCreate={async (input) => {
          await addHabit(input)
          setAddOpen(false)
        }}
      />

      <EditStagesSheet
        open={editingHabit !== null}
        habit={editingHabit}
        onCancel={() => setEditingHabit(null)}
        onSave={async (patch) => {
          if (editingHabit) await updateHabitStages(editingHabit.id, patch)
          setEditingHabit(null)
        }}
      />

      {gate}
    </div>
  )
}
