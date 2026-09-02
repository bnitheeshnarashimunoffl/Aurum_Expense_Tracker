import { useState } from 'react'
import { FIELD_CLASS, TagChip } from './Primitives'
import type { Tag } from '../lib/types'

interface TagPickerProps {
  all: Tag[]
  selected: Tag[]
  onToggle: (tagId: string) => void
  onCreate: (label: string) => Promise<void>
}

/**
 * Attaches tags to an item. One control used by to-dos, notes and voice entries
 * alike — the vocabulary is shared, so the way you reach it should be too.
 *
 * Typing a name that does not exist yet offers to create it inline, because
 * sending someone to a separate tag manager mid-capture is how a tag vocabulary
 * ends up unused.
 */
export default function TagPicker({ all, selected, onToggle, onCreate }: TagPickerProps) {
  const [draft, setDraft] = useState('')
  const [busy, setBusy] = useState(false)

  const selectedIds = new Set(selected.map((t) => t.id))
  const query = draft.trim().toLowerCase()
  const matches = query ? all.filter((tag) => tag.label.toLowerCase().includes(query)) : all
  const exact = all.some((tag) => tag.label.toLowerCase() === query)

  async function create() {
    if (!query || exact || busy) return
    setBusy(true)
    try {
      await onCreate(draft.trim())
      setDraft('')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div>
      <input
        type="text"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault()
            void create()
          }
        }}
        placeholder="Find or create a tag"
        aria-label="Find or create a tag"
        className={FIELD_CLASS}
      />

      {query && !exact && (
        <button
          type="button"
          onClick={create}
          disabled={busy}
          className="mt-2.5 min-h-[40px] w-full rounded-card px-3 text-left text-[13.5px] text-gold disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-gold"
        >
          {busy ? 'Creating…' : `Create “${draft.trim()}”`}
        </button>
      )}

      <div className="mt-3 flex flex-wrap gap-2">
        {matches.length === 0 && !query && (
          <p className="text-[13px] text-ivoryDim">No tags yet. Type a name above to make the first one.</p>
        )}
        {matches.map((tag) => (
          <TagChip key={tag.id} label={tag.label} active={selectedIds.has(tag.id)} onClick={() => onToggle(tag.id)} />
        ))}
      </div>
    </div>
  )
}
