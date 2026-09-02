import { useEffect, useState } from 'react'
import ChronicleSheet from './ChronicleSheet'
import TagPicker from './TagPicker'
import { FIELD_CLASS, FieldLabel, PrimaryButton, QuietButton, Rule, TagChip } from './Primitives'
import { recurrenceSummary } from '../lib/recurrence'
import { formatDuration } from '../lib/audio'
import { noteLabel, voiceLabel, type Note, type Priority, type Recurrence, type Tag, type Todo, type TodoLink, type VoiceEntry } from '../lib/types'

interface TodoSheetProps {
  todo: Todo | null
  open: boolean
  onClose: () => void
  allTags: Tag[]
  selectedTags: Tag[]
  onToggleTag: (tagId: string) => void
  onCreateTag: (label: string) => Promise<void>
  onSave: (patch: {
    title?: string
    notes?: string
    priority?: Priority
    due_date?: string | null
    recurrence?: Recurrence | null
    recurrence_interval?: number | null
  }) => Promise<void>
  onDelete: () => Promise<void>
  links: TodoLink[]
  notes: Note[]
  voice: VoiceEntry[]
  onAttach: (itemType: 'note' | 'voice', itemId: string) => Promise<void>
  onUnlink: (linkId: string) => Promise<void>
  onOpenLinked: (itemType: 'note' | 'voice', itemId: string) => void
  onCreateLinkedNote: () => Promise<void>
}

const PRIORITIES: Priority[] = ['LOW', 'MEDIUM', 'HIGH']
const REPEATS: (Recurrence | null)[] = [null, 'DAILY', 'WEEKLY', 'MONTHLY', 'CUSTOM']

function Segmented<T extends string | null>({
  options,
  value,
  onChange,
  labelFor,
  label,
}: {
  options: T[]
  value: T
  onChange: (next: T) => void
  labelFor: (option: T) => string
  label: string
}) {
  return (
    <div role="group" aria-label={label} className="chr-neu-pressed-sm flex gap-1 rounded-card p-1">
      {options.map((option) => {
        const active = option === value
        return (
          <button
            key={String(option)}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(option)}
            className={`min-h-[38px] flex-1 rounded-[14px] px-1 text-[12.5px] transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-gold ${
              active ? 'chr-neu-raised-teal font-semibold text-ivory' : 'text-ivoryDim'
            }`}
          >
            {labelFor(option)}
          </button>
        )
      })}
    </div>
  )
}

export default function TodoSheet(props: TodoSheetProps) {
  const { todo, open, onClose } = props
  const [title, setTitle] = useState('')
  const [detail, setDetail] = useState('')
  const [showTags, setShowTags] = useState(false)
  const [attaching, setAttaching] = useState<'note' | 'voice' | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)

  // Re-seed the local draft whenever a different to-do is opened. Keyed on the id
  // rather than the object so an autosave-driven refresh does not wipe what is
  // being typed.
  useEffect(() => {
    if (!todo) return
    setTitle(todo.title)
    setDetail(todo.notes)
    setShowTags(false)
    setAttaching(null)
    setConfirmDelete(false)
  }, [todo?.id])

  if (!todo) return null

  const linkedItems = props.links.map((link) => {
    if (link.item_type === 'note') {
      const note = props.notes.find((n) => n.id === link.item_id)
      return { link, label: note ? noteLabel(note) : 'Note', detail: null as string | null }
    }
    const entry = props.voice.find((v) => v.id === link.item_id)
    return {
      link,
      label: entry ? voiceLabel(entry) : 'Recording',
      detail: entry ? formatDuration(entry.duration_seconds) : null,
    }
  })

  const linkedIds = new Set(props.links.map((l) => l.item_id))
  // Secret notes are not in props.notes at all (they are never fetched outside the
  // unlocked section), so they cannot appear here even by mistake.
  const attachable =
    attaching === 'note'
      ? props.notes.filter((n) => !linkedIds.has(n.id)).map((n) => ({ id: n.id, label: noteLabel(n) }))
      : attaching === 'voice'
        ? props.voice.filter((v) => !linkedIds.has(v.id)).map((v) => ({ id: v.id, label: voiceLabel(v) }))
        : []

  return (
    <ChronicleSheet open={open} onClose={onClose} title="To-do">
      <div className="space-y-5">
        <div>
          <FieldLabel htmlFor="todo-title">Title</FieldLabel>
          <input
            id="todo-title"
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={() => title.trim() && title !== todo.title && props.onSave({ title })}
            className={FIELD_CLASS}
          />
        </div>

        <div>
          <FieldLabel htmlFor="todo-detail">Detail</FieldLabel>
          <textarea
            id="todo-detail"
            rows={2}
            value={detail}
            onChange={(e) => setDetail(e.target.value)}
            onBlur={() => detail !== todo.notes && props.onSave({ notes: detail })}
            placeholder="Anything worth remembering about it"
            className={`${FIELD_CLASS} resize-none`}
          />
        </div>

        <div>
          <FieldLabel>Priority</FieldLabel>
          <Segmented
            label="Priority"
            options={PRIORITIES}
            value={todo.priority}
            onChange={(priority) => props.onSave({ priority })}
            labelFor={(p) => (p === 'LOW' ? 'Low' : p === 'MEDIUM' ? 'Medium' : 'High')}
          />
        </div>

        <div>
          <FieldLabel htmlFor="todo-due">Due</FieldLabel>
          <div className="flex items-center gap-2">
            <input
              id="todo-due"
              type="date"
              value={todo.due_date ?? ''}
              onChange={(e) => props.onSave({ due_date: e.target.value || null })}
              className={FIELD_CLASS}
            />
            {todo.due_date && (
              <button
                type="button"
                onClick={() => props.onSave({ due_date: null })}
                className="min-h-[44px] shrink-0 rounded-card px-3 text-[13px] text-ivoryDim focus:outline-none focus-visible:ring-2 focus-visible:ring-gold"
              >
                Clear
              </button>
            )}
          </div>
        </div>

        <div>
          <FieldLabel>Repeat</FieldLabel>
          <Segmented
            label="Repeat"
            options={REPEATS}
            value={todo.recurrence}
            onChange={(recurrence) => props.onSave({ recurrence, recurrence_interval: recurrence === 'CUSTOM' ? (todo.recurrence_interval ?? 2) : null })}
            labelFor={(r) => (r === null ? 'Never' : r === 'DAILY' ? 'Day' : r === 'WEEKLY' ? 'Week' : r === 'MONTHLY' ? 'Month' : 'Custom')}
          />
          {todo.recurrence === 'CUSTOM' && (
            <div className="mt-2.5 flex items-center gap-2.5">
              <span className="text-[13px] text-ivoryDim">Every</span>
              <input
                type="number"
                min={1}
                max={365}
                value={todo.recurrence_interval ?? 2}
                onChange={(e) => props.onSave({ recurrence_interval: Math.max(1, Number(e.target.value) || 1) })}
                aria-label="Repeat every how many days"
                className={`${FIELD_CLASS} w-24 tabular-nums`}
              />
              <span className="text-[13px] text-ivoryDim">days</span>
            </div>
          )}
          {todo.recurrence && (
            <p className="mt-2 text-[12px] leading-relaxed text-ivoryDim">
              {recurrenceSummary(todo.recurrence, todo.recurrence_interval)} — ticking this off creates the next one and
              keeps this occurrence in the completed list.
            </p>
          )}
        </div>

        <Rule />

        <div>
          <div className="mb-2 flex items-center justify-between">
            <FieldLabel>Tags</FieldLabel>
            <button
              type="button"
              onClick={() => setShowTags((v) => !v)}
              className="min-h-[32px] text-[12.5px] text-gold focus:outline-none focus-visible:ring-2 focus-visible:ring-gold"
            >
              {showTags ? 'Done' : 'Edit'}
            </button>
          </div>
          {showTags ? (
            <TagPicker
              all={props.allTags}
              selected={props.selectedTags}
              onToggle={props.onToggleTag}
              onCreate={props.onCreateTag}
            />
          ) : props.selectedTags.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {props.selectedTags.map((tag) => (
                <TagChip key={tag.id} label={tag.label} />
              ))}
            </div>
          ) : (
            <p className="text-[13px] text-ivoryDim">No tags.</p>
          )}
        </div>

        <Rule />

        <div>
          <FieldLabel>Attached</FieldLabel>
          {linkedItems.length === 0 && (
            <p className="mb-2.5 text-[13px] text-ivoryDim">
              Nothing attached yet. Notes and recordings linked here stay their own items — removing a link never
              deletes them.
            </p>
          )}
          <div className="space-y-1.5">
            {linkedItems.map(({ link, label, detail: sub }) => (
              <div key={link.id} className="chr-neu-raised-sm flex items-center gap-2 rounded-card px-3 py-2">
                <span className="text-[11px] uppercase tracking-wide text-ivoryDim">
                  {link.item_type === 'note' ? 'Note' : 'Voice'}
                </span>
                <button
                  type="button"
                  onClick={() => props.onOpenLinked(link.item_type, link.item_id)}
                  className="min-w-0 flex-1 truncate text-left text-[13.5px] text-ivory focus:outline-none focus-visible:ring-2 focus-visible:ring-gold"
                >
                  {label}
                  {sub && <span className="ml-2 text-[11.5px] tabular-nums text-ivoryDim">{sub}</span>}
                </button>
                <button
                  type="button"
                  onClick={() => props.onUnlink(link.id)}
                  aria-label={`Unlink ${label}`}
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-ivoryDim focus:outline-none focus-visible:ring-2 focus-visible:ring-gold"
                >
                  <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden>
                    <path d="M1 1 L9 9 M9 1 L1 9" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
                  </svg>
                </button>
              </div>
            ))}
          </div>

          {attaching ? (
            <div className="mt-3">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-[12.5px] text-ivoryDim">
                  Pick a {attaching === 'note' ? 'note' : 'recording'}
                </span>
                <button
                  type="button"
                  onClick={() => setAttaching(null)}
                  className="min-h-[32px] text-[12.5px] text-gold focus:outline-none focus-visible:ring-2 focus-visible:ring-gold"
                >
                  Cancel
                </button>
              </div>
              {attachable.length === 0 ? (
                <p className="text-[13px] text-ivoryDim">
                  Nothing left to attach — everything you have is already linked here.
                </p>
              ) : (
                <div className="max-h-52 space-y-1.5 overflow-y-auto">
                  {attachable.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={async () => {
                        await props.onAttach(attaching, item.id)
                        setAttaching(null)
                      }}
                      className="chr-neu-raised-sm block w-full truncate rounded-card px-3 py-2.5 text-left text-[13.5px] text-ivory focus:outline-none focus-visible:ring-2 focus-visible:ring-gold"
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="mt-3 flex flex-wrap gap-2">
              <QuietButton onClick={() => setAttaching('note')}>Attach note</QuietButton>
              <QuietButton onClick={() => setAttaching('voice')}>Attach recording</QuietButton>
              <QuietButton onClick={() => void props.onCreateLinkedNote()}>New linked note</QuietButton>
            </div>
          )}
        </div>

        <Rule />

        {confirmDelete ? (
          <div className="flex items-center gap-2">
            <QuietButton full onClick={() => setConfirmDelete(false)}>
              Keep it
            </QuietButton>
            <PrimaryButton full onClick={() => void props.onDelete()}>
              Delete to-do
            </PrimaryButton>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setConfirmDelete(true)}
            className="min-h-[44px] w-full rounded-card text-[13.5px] text-ivoryDim focus:outline-none focus-visible:ring-2 focus-visible:ring-gold"
          >
            Delete this to-do
          </button>
        )}
      </div>
    </ChronicleSheet>
  )
}
