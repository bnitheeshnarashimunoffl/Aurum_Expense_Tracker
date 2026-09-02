import { useEffect, useState } from 'react'
import LoomSheet from './LoomSheet'
import ColorPicker from './ColorPicker'
import { DEFAULT_CLASS_COLOR } from '../lib/colors'
import type { ClassPreset } from '../lib/types'

export interface PresetDraft {
  id?: string
  title: string
  location: string
  faculty_name: string
  color: string
}

interface PresetEditorSheetProps {
  open: boolean
  /** Undefined = creating a new class. */
  preset?: ClassPreset
  suggestedColor?: string
  onSave: (draft: PresetDraft) => Promise<void>
  onDelete?: (preset: ClassPreset) => Promise<void>
  onClose: () => void
}

/**
 * Create or edit a class. Because slots reference a preset by id, saving here
 * updates every place that class appears in the timetable — there is no copy of
 * the title or location stored anywhere else to fall out of step.
 */
export default function PresetEditorSheet({ open, preset, suggestedColor, onSave, onDelete, onClose }: PresetEditorSheetProps) {
  const [title, setTitle] = useState('')
  const [location, setLocation] = useState('')
  const [faculty, setFaculty] = useState('')
  const [color, setColor] = useState(DEFAULT_CLASS_COLOR)
  const [saving, setSaving] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  useEffect(() => {
    if (!open) return
    setTitle(preset?.title ?? '')
    setLocation(preset?.location ?? '')
    setFaculty(preset?.faculty_name ?? '')
    setColor(preset?.color ?? suggestedColor ?? DEFAULT_CLASS_COLOR)
    setConfirmDelete(false)
  }, [open, preset, suggestedColor])

  async function handleSave() {
    if (!title.trim() || saving) return
    setSaving(true)
    try {
      await onSave({
        id: preset?.id,
        title: title.trim(),
        location: location.trim(),
        faculty_name: faculty.trim(),
        color,
      })
      onClose()
    } finally {
      setSaving(false)
    }
  }

  const field = 'loom-neu-pressed mb-3 w-full rounded-card border-none bg-transparent px-4 py-3 text-sm text-loomInk outline-none placeholder:text-loomMuted focus:ring-1 focus:ring-loomGold'

  return (
    <LoomSheet open={open} onClose={onClose} title={preset ? 'Edit class' : 'New class'}>
      <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Class title" aria-label="Class title" className={field} />
      <input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Location, e.g. Academic Block One, Room 706" aria-label="Location" className={field} />
      <input value={faculty} onChange={(e) => setFaculty(e.target.value)} placeholder="Faculty name" aria-label="Faculty name" className={field} />

      <p className="mb-2 mt-4 text-xs text-loomMuted">Colour</p>
      <ColorPicker value={color} onChange={setColor} />

      <button
        onClick={handleSave}
        disabled={!title.trim() || saving}
        className="loom-neu-raised mt-5 min-h-[46px] w-full rounded-card text-sm font-semibold text-loomGold disabled:opacity-40"
      >
        {saving ? 'Saving…' : preset ? 'Save changes' : 'Add class'}
      </button>

      {preset && onDelete && (
        <button
          onClick={async () => {
            if (!confirmDelete) {
              setConfirmDelete(true)
              return
            }
            await onDelete(preset)
            onClose()
          }}
          className={`mt-2 min-h-[42px] w-full rounded-card text-xs font-medium transition-colors ${
            confirmDelete ? 'bg-loomBurgundy text-loomInk' : 'text-loomMuted'
          }`}
        >
          {confirmDelete ? 'Delete this class and clear it from every slot?' : 'Delete class'}
        </button>
      )}
    </LoomSheet>
  )
}
