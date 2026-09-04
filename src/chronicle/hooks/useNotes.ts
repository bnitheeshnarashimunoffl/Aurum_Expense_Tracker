import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { db as supabase } from '@/lib/dataClient'
import { notify, subscribe } from '@/lib/sync'
import { currentUserId, dehydrateNoteImages, htmlToText, imagePathsIn, removeFile } from '../lib/media'
import { TAG_CHANNEL } from './useTags'
import type { Note } from '../lib/types'

const CHANNEL = 'chronicle_notes'

/**
 * Notes, scoped to one side of the secret boundary.
 *
 * `secret` is not a display filter — it goes into the query. The normal Notes list
 * and global search both call useNotes(false), so a secret note is never fetched
 * into the page at all: it cannot leak through a forgotten filter, a search result,
 * or a devtools look at the React tree, because it was never in the response. The
 * unlocked section calls useNotes(true) and gets only the other side.
 */
export function useNotes(secret = false) {
  const [notes, setNotes] = useState<Note[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const loadedOnce = useRef(false)

  const refresh = useCallback(async () => {
    if (!loadedOnce.current) setLoading(true)
    const { data, error: e } = await supabase.from('chronicle_notes').select('*').eq('is_secret', secret)
    if (e) setError(e.message)
    else {
      setNotes((data ?? []) as Note[])
      setError(null)
    }
    loadedOnce.current = true
    setLoading(false)
  }, [secret])

  useEffect(() => {
    refresh()
    return subscribe(CHANNEL, refresh)
  }, [refresh])

  async function done() {
    await refresh()
    notify(CHANNEL)
  }

  /** Most recently edited first — a notebook's natural order. */
  const sorted = useMemo(() => [...notes].sort((a, b) => b.updated_at.localeCompare(a.updated_at)), [notes])

  async function createNote(): Promise<Note> {
    const user_id = await currentUserId()
    const { data, error: e } = await supabase
      .from('chronicle_notes')
      .insert({ user_id, title: '', body_html: '', body_text: '', is_secret: secret })
      .select('*')
      .single()
    if (e) throw e
    await done()
    return data as Note
  }

  /**
   * Saves a note. body_html arrives from the editor with live signed URLs in its
   * <img> tags; those expire, so they are swapped back to storage paths before the
   * write. body_text is derived here rather than passed in, so the search mirror can
   * never drift out of step with the body it mirrors.
   */
  async function saveNote(id: string, patch: { title?: string; body_html?: string }) {
    const next: Record<string, unknown> = { updated_at: new Date().toISOString() }
    if (patch.title !== undefined) next.title = patch.title
    if (patch.body_html !== undefined) {
      const stored = dehydrateNoteImages(patch.body_html)
      next.body_html = stored
      next.body_text = htmlToText(stored)
    }
    const { error: e } = await supabase.from('chronicle_notes').update(next).eq('id', id)
    if (e) throw e
    await done()
  }

  /**
   * Deletes a note and the images that only existed inside it. Tag rows and any
   * to-do links are cleaned by a database trigger, but the storage objects have no
   * such relationship — nothing else would ever collect them.
   */
  async function deleteNote(id: string) {
    const note = notes.find((n) => n.id === id)
    const { error: e } = await supabase.from('chronicle_notes').delete().eq('id', id)
    if (e) throw e
    if (note) {
      for (const path of imagePathsIn(note.body_html)) await removeFile(path)
    }
    await done()
    notify(TAG_CHANNEL)
  }

  return { loading, error, notes: sorted, createNote, saveNote, deleteNote, refresh }
}
