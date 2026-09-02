import type { ItemType, Note, Todo, VoiceEntry } from './types'
import { noteLabel, voiceLabel } from './types'

/**
 * Global search across all three types, in one pass, client-side.
 *
 * Client-side rather than a Postgres full-text query because every screen already
 * holds the whole account in memory (a personal notebook is thousands of rows, not
 * millions), and because searching locally means results update as you type with no
 * round trip — which is what makes the search field usable as the module's spine
 * rather than a separate destination.
 *
 * SECRET NOTES: this function never sees them. The normal notes hook queries with
 * is_secret = false, so a secret note is not in the array that gets passed in — it
 * is not fetched and then filtered, it is never fetched. That is the difference
 * between a leak that needs a correct filter everywhere and one that cannot happen.
 */

export interface SearchHit {
  type: ItemType
  id: string
  title: string
  /** Context around the match in the body/transcript, or null if the title matched. */
  snippet: string | null
  score: number
  timestamp: string
}

const SNIPPET_RADIUS = 46

/** ~90 characters of the body centred on the match, with ellipses where it was cut. */
function snippetAround(text: string, at: number, queryLength: number): string {
  const flat = text.replace(/\s+/g, ' ').trim()
  // Re-find in the flattened text: collapsing whitespace shifts every index after it.
  const start = Math.max(0, at - SNIPPET_RADIUS)
  const end = Math.min(flat.length, at + queryLength + SNIPPET_RADIUS)
  return `${start > 0 ? '…' : ''}${flat.slice(start, end).trim()}${end < flat.length ? '…' : ''}`
}

interface Scored {
  score: number
  snippet: string | null
}

/**
 * Scores one item. Title matches outrank body matches, and an earlier match
 * outranks a later one, so typing "gro" surfaces the note called "Groceries"
 * above one that mentions groceries in its last paragraph.
 */
function scoreOne(title: string, body: string, needle: string): Scored | null {
  const t = title.toLowerCase()
  const titleAt = t.indexOf(needle)
  if (titleAt === 0) return { score: 1000, snippet: null }
  if (titleAt > 0) return { score: 800 - Math.min(titleAt, 100), snippet: null }

  const flat = body.replace(/\s+/g, ' ').trim()
  const bodyAt = flat.toLowerCase().indexOf(needle)
  if (bodyAt < 0) return null
  return { score: 500 - Math.min(bodyAt, 400) / 4, snippet: snippetAround(flat, bodyAt, needle.length) }
}

export interface SearchInput {
  query: string
  todos: Todo[]
  notes: Note[]
  voice: VoiceEntry[]
  /** tag_id -> the set of item ids carrying it, already narrowed to the active filter. */
  allowedIds: Set<string> | null
}

export function searchAll({ query, todos, notes, voice, allowedIds }: SearchInput): SearchHit[] {
  const needle = query.trim().toLowerCase()
  if (!needle) return []

  const hits: SearchHit[] = []
  const allow = (id: string) => allowedIds === null || allowedIds.has(id)

  for (const todo of todos) {
    if (!allow(todo.id)) continue
    const scored = scoreOne(todo.title, todo.notes, needle)
    if (scored) {
      hits.push({
        type: 'todo',
        id: todo.id,
        title: todo.title,
        snippet: scored.snippet,
        // A completed to-do is still a valid result — it is history — but it should
        // not outrank the thing you still have to do.
        score: scored.score - (todo.is_complete ? 250 : 0),
        timestamp: todo.updated_at,
      })
    }
  }

  for (const note of notes) {
    if (!allow(note.id)) continue
    const scored = scoreOne(noteLabel(note), note.body_text, needle)
    if (scored) {
      hits.push({ type: 'note', id: note.id, title: noteLabel(note), snippet: scored.snippet, score: scored.score, timestamp: note.updated_at })
    }
  }

  for (const entry of voice) {
    if (!allow(entry.id)) continue
    const scored = scoreOne(voiceLabel(entry), entry.transcript, needle)
    if (scored) {
      hits.push({
        type: 'voice',
        id: entry.id,
        title: voiceLabel(entry),
        snippet: scored.snippet,
        score: scored.score,
        timestamp: entry.created_at,
      })
    }
  }

  // Recency breaks ties, so two equally good matches put the one you touched last on top.
  return hits.sort((a, b) => b.score - a.score || b.timestamp.localeCompare(a.timestamp))
}

/**
 * Splits a string on every occurrence of the query so the UI can mark the matched
 * runs. Returned as alternating [plain, match, plain, match, …] segments rather
 * than HTML, because building HTML here would mean dangerouslySetInnerHTML at the
 * other end — over text that includes the user's own note bodies.
 */
export function highlightSegments(text: string, query: string): { text: string; match: boolean }[] {
  const needle = query.trim().toLowerCase()
  if (!needle) return [{ text, match: false }]

  const segments: { text: string; match: boolean }[] = []
  const lower = text.toLowerCase()
  let cursor = 0
  for (;;) {
    const at = lower.indexOf(needle, cursor)
    if (at < 0) break
    if (at > cursor) segments.push({ text: text.slice(cursor, at), match: false })
    segments.push({ text: text.slice(at, at + needle.length), match: true })
    cursor = at + needle.length
  }
  if (cursor < text.length) segments.push({ text: text.slice(cursor), match: false })
  return segments
}

export const TYPE_LABEL: Record<ItemType, string> = {
  todo: 'To-Do',
  note: 'Note',
  voice: 'Voice',
}
