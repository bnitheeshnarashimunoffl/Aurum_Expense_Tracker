import { describeDue, recurrenceSummary } from '../lib/recurrence'
import { formatDuration } from '../lib/audio'
import { formatStamp } from '../lib/time'
import { noteLabel, voiceLabel } from '../lib/types'
import { PriorityMark, TagRow } from './Primitives'
import type { Note, Tag, Todo, VoiceEntry } from '../lib/types'

/**
 * The three list rows.
 *
 * They are deliberately NOT cards. A list of twenty raised neumorphic tiles is the
 * generic-SaaS look the brief rules out, and stacking twenty shadow pairs on a dark
 * ground turns the page into noise. So rows sit flush on the ground, divided by a
 * 1.36:1 hairline, and the module's depth is spent where depth means something:
 * fields you type into are cut in, controls you press are raised.
 */

const ROW_BASE =
  'flex w-full items-start gap-3 py-3.5 text-left transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-gold focus-visible:ring-inset'

/* ------------------------------------------------------------------------- */
/* To-do                                                                      */
/* ------------------------------------------------------------------------- */

function Checkbox({ checked, onToggle, label }: { checked: boolean; onToggle: () => void; label: string }) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      aria-label={label}
      onClick={(e) => {
        e.stopPropagation()
        onToggle()
      }}
      // 44px of touch target around a 22px mark: the checkbox is the most-tapped
      // thing in the module and the one most often reached for one-handed.
      className="-my-3 -ml-1.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-gold"
    >
      <span
        className={`flex h-[22px] w-[22px] items-center justify-center rounded-[8px] ${
          checked ? 'bg-gold' : 'chr-check'
        }`}
      >
        {checked && (
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden>
            <path d="M2.5 6.3l2.4 2.4 4.6-5" stroke="var(--ink-charcoal-bg)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
      </span>
    </button>
  )
}

function RecurringMark() {
  return (
    <span className="inline-flex items-center gap-1 text-[11.5px] text-ivoryDim" title="Repeats">
      <svg width="11" height="11" viewBox="0 0 12 12" fill="none" aria-hidden>
        <path d="M2 6a4 4 0 0 1 6.9-2.7M10 6a4 4 0 0 1-6.9 2.7" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
        <path d="M9.2 1.6v1.9H7.3M2.8 10.4V8.5h1.9" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </span>
  )
}

interface TodoRowProps {
  todo: Todo
  tags: Tag[]
  linkCount: number
  onToggle: () => void
  onOpen: () => void
}

export function TodoRow({ todo, tags, linkCount, onToggle, onOpen }: TodoRowProps) {
  const due = describeDue(todo.due_date)
  const repeats = recurrenceSummary(todo.recurrence, todo.recurrence_interval)

  // "Overdue" is spelled out in the label, so the colour is reinforcement rather
  // than the only way to know — which matters because gold also marks high priority.
  const dueTone =
    due?.tone === 'overdue' ? 'text-gold' : due?.tone === 'today' ? 'text-ivory' : 'text-ivoryDim'

  return (
    <div className="flex items-stretch gap-2.5">
      <Checkbox
        checked={todo.is_complete}
        onToggle={onToggle}
        label={todo.is_complete ? `Mark “${todo.title}” as not done` : `Mark “${todo.title}” as done`}
      />
      {!todo.is_complete && <PriorityMark priority={todo.priority} />}
      <button type="button" onClick={onOpen} className={`${ROW_BASE} flex-1 flex-col gap-1`}>
        <span
          className={`text-[15px] leading-snug ${
            todo.is_complete ? 'text-ivoryDim line-through decoration-ivoryDim/50' : 'text-ivory'
          }`}
        >
          {todo.title}
        </span>
        <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
          {due && !todo.is_complete && <span className={`text-[11.5px] ${dueTone}`}>{due.label}</span>}
          {todo.is_complete && todo.completed_at && (
            <span className="text-[11.5px] text-ivoryDim">Done {formatStamp(todo.completed_at)}</span>
          )}
          {repeats && !todo.is_complete && (
            <span className="flex items-center gap-1 text-[11.5px] text-ivoryDim">
              <RecurringMark />
              {repeats}
            </span>
          )}
          {linkCount > 0 && <span className="text-[11.5px] text-ivoryDim">{linkCount} attached</span>}
          <TagRow tags={tags} />
        </span>
      </button>
    </div>
  )
}

/* ------------------------------------------------------------------------- */
/* Note                                                                       */
/* ------------------------------------------------------------------------- */

export function NoteRow({ note, tags, onOpen }: { note: Note; tags: Tag[]; onOpen: () => void }) {
  const preview = note.body_text.replace(/\s+/g, ' ').trim()
  return (
    <button type="button" onClick={onOpen} className={`${ROW_BASE} flex-col gap-1.5`}>
      <span className="font-chronicle text-[16.5px] font-medium leading-snug text-ivory">{noteLabel(note)}</span>
      {preview && <span className="line-clamp-2 text-[13.5px] leading-relaxed text-ivoryDim">{preview}</span>}
      <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <span className="text-[11.5px] text-ivoryDim">{formatStamp(note.updated_at)}</span>
        <TagRow tags={tags} />
      </span>
    </button>
  )
}

/* ------------------------------------------------------------------------- */
/* Voice                                                                      */
/* ------------------------------------------------------------------------- */

/** Static bars, not an animated waveform — a list of twenty animating rows is the
 *  decorative motion the brief rules out. */
function WaveGlyph() {
  const heights = [7, 13, 19, 11, 16, 8]
  return (
    <span className="chr-neu-raised-sm flex h-10 w-10 shrink-0 items-center justify-center gap-[2px] rounded-full" aria-hidden>
      {heights.map((h, i) => (
        <span key={i} className="w-[2px] rounded-full" style={{ height: h, background: 'var(--gold-primary)', opacity: 0.55 + i * 0.06 }} />
      ))}
    </span>
  )
}

export function VoiceRow({ entry, tags, onOpen }: { entry: VoiceEntry; tags: Tag[]; onOpen: () => void }) {
  const preview = entry.transcript.replace(/\s+/g, ' ').trim()

  return (
    <button type="button" onClick={onOpen} className={`${ROW_BASE} items-center`}>
      <WaveGlyph />
      <span className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="flex items-baseline gap-2">
          <span className="truncate text-[15px] leading-snug text-ivory">{voiceLabel(entry)}</span>
          <span className="ml-auto shrink-0 text-[11.5px] tabular-nums text-ivoryDim">
            {formatDuration(entry.duration_seconds)}
          </span>
        </span>

        {entry.transcript_status === 'pending' && (
          <span className="text-[12.5px] text-ivoryDim">Transcribing…</span>
        )}
        {entry.transcript_status === 'failed' && (
          <span className="text-[12.5px] text-gold">Transcription failed — tap to retry</span>
        )}
        {entry.transcript_status === 'done' && preview && (
          <span className="line-clamp-2 text-[13px] leading-relaxed text-ivoryDim">{preview}</span>
        )}
        {entry.transcript_status === 'done' && !preview && (
          <span className="text-[12.5px] text-ivoryDim">No speech detected</span>
        )}

        <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="text-[11.5px] text-ivoryDim">{formatStamp(entry.created_at)}</span>
          <TagRow tags={tags} />
        </span>
      </span>
    </button>
  )
}

/* ------------------------------------------------------------------------- */
/* Section heading                                                            */
/* ------------------------------------------------------------------------- */

/** The list's structural signal — Spectral, small, with a rule running off it. */
export function SectionHeading({ children, count }: { children: React.ReactNode; count?: number }) {
  return (
    <div className="flex items-center gap-3 pb-1 pt-6 first:pt-2">
      <h2 className="font-chronicle text-[13px] font-medium tracking-wide text-ivoryDim">{children}</h2>
      {count !== undefined && <span className="text-[11.5px] tabular-nums text-ivoryDim/70">{count}</span>}
      <span className="h-px flex-1" style={{ background: 'var(--chr-rule)' }} />
    </div>
  )
}
