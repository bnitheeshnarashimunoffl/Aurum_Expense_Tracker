import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import LoadingRing from '@/components/LoadingRing'
import { useActiveTerm, useBlocks, usePresets, useTerm } from '../hooks/useLoomData'
import { deletePreset, newId, upsertPreset } from '../lib/db'
import { scheduleSync } from '../lib/sync'
import { nextClassColor, onColor } from '../lib/colors'
import { DAYS } from '../lib/types'
import type { ClassPreset } from '../lib/types'
import PresetEditorSheet, { type PresetDraft } from '../components/PresetEditorSheet'

export default function Classes() {
  const [params] = useSearchParams()
  const viewingTermId = params.get('term') ?? undefined
  const activeTerm = useActiveTerm()
  const explicitTerm = useTerm(viewingTermId)
  const term = viewingTermId ? explicitTerm : activeTerm

  const presets = usePresets(term?.id)
  const blocks = useBlocks(term?.id)
  const [editing, setEditing] = useState<ClassPreset | null>(null)
  const [creating, setCreating] = useState(false)

  const readOnly = term?.archived === 1

  /** How many slots across the term reference a preset — the "reusable" part, made visible. */
  function usageCount(presetId: string): number {
    let count = 0
    for (const block of blocks ?? []) {
      for (const day of Object.keys(block.assignments)) {
        for (const slotId of Object.keys(block.assignments[day])) {
          if (block.assignments[day][slotId] === presetId) count++
        }
      }
    }
    return count
  }

  function daysUsed(presetId: string): string[] {
    const days = new Set<string>()
    for (const block of blocks ?? []) {
      for (const day of Object.keys(block.assignments)) {
        if (Object.values(block.assignments[day]).includes(presetId)) days.add(DAYS[Number(day)])
      }
    }
    return [...days]
  }

  async function handleSave(draft: PresetDraft) {
    if (!term) return
    await upsertPreset({
      id: draft.id ?? newId(),
      term_id: term.id,
      title: draft.title,
      location: draft.location,
      faculty_name: draft.faculty_name,
      color: draft.color,
    })
    scheduleSync()
  }

  async function handleDelete(preset: ClassPreset) {
    await deletePreset(preset.id, preset.term_id)
    scheduleSync()
  }

  if (term === undefined || presets === undefined) {
    return <div className="px-4 pt-4"><LoadingRing label="Loading classes" /></div>
  }

  return (
    <div className="px-4 pt-4">
      <header className="mb-5 pr-14">
        <h1 className="font-display text-2xl font-bold text-loomInk">Classes</h1>
        <p className="text-xs text-loomMuted">
          {term ? `${term.name} · ${presets.length} in the library` : 'No term yet'}
        </p>
      </header>

      {readOnly && (
        <div className="mb-4 rounded-card px-4 py-2.5 text-xs" style={{ background: 'var(--loom-burgundy)', color: 'var(--loom-ink)' }}>
          Archived term — viewing only.
        </div>
      )}

      {presets.length === 0 ? (
        <p className="loom-neu-pressed rounded-card px-4 py-8 text-center text-sm text-loomMuted">
          No classes yet. Add one here, or straight from an empty slot on the timetable.
        </p>
      ) : (
        <div className="space-y-2.5">
          {presets.map((preset) => {
            const count = usageCount(preset.id)
            const days = daysUsed(preset.id)
            const row = (
              <>
                <span
                  className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl text-xs font-bold"
                  style={{ background: preset.color, color: onColor(preset.color) }}
                >
                  {preset.title.slice(0, 2).toUpperCase()}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold text-loomInk">{preset.title}</span>
                  {preset.location && <span className="block truncate text-[11px] text-loomMuted">{preset.location}</span>}
                  {preset.faculty_name && <span className="block truncate text-[11px] text-loomMuted">{preset.faculty_name}</span>}
                  <span className="mt-0.5 block text-[10px] text-loomMuted">
                    {count === 0 ? 'Not scheduled yet' : `${count} slot${count === 1 ? '' : 's'} · ${days.join(', ')}`}
                  </span>
                </span>
              </>
            )

            if (readOnly) {
              return (
                <div key={preset.id} className="loom-neu-raised flex items-center gap-3 rounded-card px-3 py-3">
                  {row}
                </div>
              )
            }

            return (
              <button
                key={preset.id}
                onClick={() => setEditing(preset)}
                aria-label={`Edit ${preset.title}`}
                className="loom-neu-raised flex w-full items-center gap-3 rounded-card px-3 py-3 text-left transition-transform active:scale-[0.99]"
              >
                {row}
              </button>
            )
          })}
        </div>
      )}

      {!readOnly && term && (
        <button
          onClick={() => setCreating(true)}
          className="loom-neu-raised mt-4 min-h-[46px] w-full rounded-card text-sm font-medium text-loomGold"
        >
          + New class
        </button>
      )}

      <PresetEditorSheet
        open={creating}
        suggestedColor={nextClassColor(presets.map((p) => p.color))}
        onSave={handleSave}
        onClose={() => setCreating(false)}
      />

      <PresetEditorSheet
        open={editing !== null}
        preset={editing ?? undefined}
        onSave={handleSave}
        onDelete={handleDelete}
        onClose={() => setEditing(null)}
      />
    </div>
  )
}
