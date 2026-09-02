/** Chronicle's row shapes — one per table in supabase/chronicle_schema.sql. */

export type Priority = 'LOW' | 'MEDIUM' | 'HIGH'
export type Recurrence = 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'CUSTOM'
export type TranscriptStatus = 'pending' | 'done' | 'failed'
export type TranscriptSource = 'groq' | 'browser' | 'manual'

/** The three things a tag can be attached to, and the two a to-do can link out to. */
export type ItemType = 'todo' | 'note' | 'voice'
export type LinkTarget = 'note' | 'voice'

export interface Tag {
  id: string
  label: string
  created_at: string
}

export interface Note {
  id: string
  title: string
  body_html: string
  body_text: string
  is_secret: boolean
  created_at: string
  updated_at: string
}

export interface Todo {
  id: string
  title: string
  notes: string
  priority: Priority
  due_date: string | null
  is_complete: boolean
  completed_at: string | null
  recurrence: Recurrence | null
  recurrence_interval: number | null
  series_id: string
  spawned_todo_id: string | null
  created_at: string
  updated_at: string
}

export interface VoiceEntry {
  id: string
  title: string
  audio_path: string
  duration_seconds: number
  transcript: string
  transcript_status: TranscriptStatus
  transcript_source: TranscriptSource | null
  transcript_error: string | null
  created_at: string
  updated_at: string
}

export interface ItemTag {
  id: string
  tag_id: string
  item_type: ItemType
  item_id: string
}

export interface TodoLink {
  id: string
  todo_id: string
  item_type: LinkTarget
  item_id: string
  created_at: string
}

/** Ordered worst-to-best so a sort can just compare indices. */
export const PRIORITY_ORDER: Priority[] = ['HIGH', 'MEDIUM', 'LOW']

export const PRIORITY_LABEL: Record<Priority, string> = {
  HIGH: 'High',
  MEDIUM: 'Medium',
  LOW: 'Low',
}

export const RECURRENCE_LABEL: Record<Recurrence, string> = {
  DAILY: 'Every day',
  WEEKLY: 'Every week',
  MONTHLY: 'Every month',
  CUSTOM: 'Every few days',
}

/**
 * The display name for a voice entry. The brief allows the title to be absent, in
 * which case the first line of the transcript stands in — so an entry recorded and
 * never named still reads as something rather than as "Untitled".
 */
export function voiceLabel(entry: VoiceEntry): string {
  const title = entry.title.trim()
  if (title) return title
  const firstLine = entry.transcript.trim().split('\n')[0]?.trim()
  if (firstLine) return firstLine.length > 60 ? `${firstLine.slice(0, 59)}…` : firstLine
  return entry.transcript_status === 'pending' ? 'Transcribing…' : 'Untitled recording'
}

/** Same idea for a note that was written but never given a title. */
export function noteLabel(note: Note): string {
  const title = note.title.trim()
  if (title) return title
  const firstLine = note.body_text.trim().split('\n')[0]?.trim()
  if (firstLine) return firstLine.length > 60 ? `${firstLine.slice(0, 59)}…` : firstLine
  return 'Untitled note'
}
