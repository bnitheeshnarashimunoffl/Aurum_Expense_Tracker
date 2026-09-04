import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { db as supabase, isOwnerMode } from '@/lib/dataClient'
import { authClient } from '@/lib/supabase'
import { notify, subscribe } from '@/lib/sync'
import { currentUserId, downloadAudio, removeFile, uploadAudio } from '../lib/media'
import { TAG_CHANNEL } from './useTags'
import type { VoiceEntry } from '../lib/types'

const CHANNEL = 'chronicle_voice'

/**
 * How long a 'pending' row is given before it is treated as abandoned.
 *
 * Transcription is fire-and-forget by design, and the app can be closed the
 * second a recording stops — which, on the route where the browser is the one
 * writing the result back, leaves nothing alive to record the failure. Without
 * this a recording would sit saying "transcribing" forever and never offer the
 * retry that would fix it. Generous enough that a slow upload is never mistaken
 * for a dead one.
 */
const STALE_PENDING_MS = 10 * 60 * 1000

export interface FinishedRecording {
  blob: Blob
  extension: string
  durationSeconds: number
  /** Whatever the browser's live recogniser heard, if it was available at all. */
  liveTranscript: string
}

/**
 * Flips long-abandoned 'pending' rows to 'failed', so the retry affordance shows
 * up instead of a spinner that will never resolve. Fire-and-forget: the next
 * refresh reads the corrected rows, and a failure here changes nothing.
 */
async function reapStalePending(rows: VoiceEntry[]): Promise<VoiceEntry[]> {
  const cutoff = Date.now() - STALE_PENDING_MS
  const staleIds = rows
    .filter((row) => row.transcript_status === 'pending' && new Date(row.updated_at).getTime() < cutoff)
    .map((row) => row.id)
  if (staleIds.length === 0) return rows

  const stamp = new Date().toISOString()
  try {
    await supabase
      .from('chronicle_voice')
      .update({ transcript_status: 'failed', transcript_error: 'Transcription did not finish.', updated_at: stamp })
      .in('id', staleIds)
  } catch {
    /* Cosmetic recovery only — fall through and show the corrected rows anyway. */
  }
  const ids = new Set(staleIds)
  return rows.map((row) =>
    ids.has(row.id)
      ? { ...row, transcript_status: 'failed' as const, transcript_error: 'Transcription did not finish.', updated_at: stamp }
      : row
  )
}

export function useVoice() {
  const [entries, setEntries] = useState<VoiceEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const loadedOnce = useRef(false)

  const refresh = useCallback(async () => {
    if (!loadedOnce.current) setLoading(true)
    const { data, error: e } = await supabase.from('chronicle_voice').select('*')
    if (e) setError(e.message)
    else {
      setEntries(await reapStalePending((data ?? []) as VoiceEntry[]))
      setError(null)
    }
    loadedOnce.current = true
    setLoading(false)
  }, [])

  useEffect(() => {
    refresh()
    return subscribe(CHANNEL, refresh)
  }, [refresh])

  async function done() {
    await refresh()
    notify(CHANNEL)
  }

  const sorted = useMemo(() => [...entries].sort((a, b) => b.created_at.localeCompare(a.created_at)), [entries])

  /**
   * Asks the Edge Function to transcribe an entry. Deliberately NOT awaited by the
   * save path: the brief requires transcription to be asynchronous, so the entry is
   * already saved, listed and playable by the time this runs.
   *
   * TWO ROUTES, and which one runs depends on where the audio actually is.
   *
   * The Edge Function lives in Meridian's own Supabase project. When the data
   * project IS that project (the owner), the function can download the file and
   * write the transcript back itself, which is what it has always done — and the
   * reason that path survives here unchanged is that it is durable: the row gets
   * its result even if this tab is long gone.
   *
   * For everyone else the audio sits in a project the function has never heard of
   * and holds no credentials for. So the browser — the only party signed in to
   * both — downloads the file, posts it up, and writes the answer back to its own
   * database. The transcript never touches Meridian's project; the function is a
   * pipe to Groq and nothing else.
   */
  async function requestTranscription(entry: { id: string; audio_path: string }, liveTranscript = '') {
    const owner = isOwnerMode()
    let transcribed = false

    try {
      if (owner) {
        const { error: e } = await authClient.functions.invoke('transcribe-voice', { body: { voice_id: entry.id } })
        transcribed = !e
      } else {
        const blob = await downloadAudio(entry.audio_path)
        if (blob) {
          const form = new FormData()
          // The extension is load-bearing: Whisper picks its demuxer from the
          // filename, and Android records WebM where iOS records MP4.
          form.append('file', blob, entry.audio_path.split('/').pop() || 'audio.webm')
          const { data, error: e } = await authClient.functions.invoke('transcribe-voice', { body: form })
          const transcript = (data as { transcript?: unknown } | null)?.transcript
          if (!e && typeof transcript === 'string') {
            await supabase
              .from('chronicle_voice')
              .update({
                transcript: transcript.trim(),
                transcript_status: 'done',
                transcript_source: 'groq',
                transcript_error: null,
                updated_at: new Date().toISOString(),
              })
              .eq('id', entry.id)
            transcribed = true
          }
        }
      }

      if (!transcribed) {
        // Groq is unavailable (no key, rate limited, offline). If the browser's own
        // recogniser managed to hear something while recording, that is better than
        // nothing — but it is stored as 'browser' so it is never mistaken for Whisper.
        if (liveTranscript.trim()) {
          await supabase
            .from('chronicle_voice')
            .update({
              transcript: liveTranscript.trim(),
              transcript_status: 'done',
              transcript_source: 'browser',
              transcript_error: null,
              updated_at: new Date().toISOString(),
            })
            .eq('id', entry.id)
        } else if (!owner) {
          // Nobody else is going to write this one down. In owner mode the
          // function has already recorded the failure on the row itself.
          await supabase
            .from('chronicle_voice')
            .update({
              transcript_status: 'failed',
              transcript_error: 'Transcription did not finish.',
              updated_at: new Date().toISOString(),
            })
            .eq('id', entry.id)
        }
      }
    } catch {
      /* Best effort throughout; the recording itself is already safe. */
    }
    await done()
  }

  /**
   * Saves a finished recording. The audio is uploaded and the row written FIRST,
   * with a pending transcript — so a transcription failure can never lose the
   * recording, which is the one guarantee the brief singles out.
   */
  async function saveRecording(recording: FinishedRecording): Promise<VoiceEntry> {
    const user_id = await currentUserId()
    const path = await uploadAudio(recording.blob, recording.extension)
    const { data, error: e } = await supabase
      .from('chronicle_voice')
      .insert({
        user_id,
        title: '',
        audio_path: path,
        duration_seconds: Math.round(recording.durationSeconds * 100) / 100,
        transcript: '',
        transcript_status: 'pending',
      })
      .select('*')
      .single()
    if (e) {
      // Nothing references the file now, so leaving it would be a permanent orphan.
      await removeFile(path)
      throw e
    }
    await done()

    const entry = data as VoiceEntry
    void requestTranscription({ id: entry.id, audio_path: entry.audio_path }, recording.liveTranscript)
    return entry
  }

  async function retryTranscription(voiceId: string) {
    const entry = entries.find((v) => v.id === voiceId)
    if (!entry) return
    await supabase
      .from('chronicle_voice')
      .update({ transcript_status: 'pending', transcript_error: null, updated_at: new Date().toISOString() })
      .eq('id', voiceId)
    await done()
    await requestTranscription({ id: voiceId, audio_path: entry.audio_path })
  }

  /** Editing a transcript marks it 'manual' — auto-transcription gets things wrong,
   *  and a corrected line should not still claim to be the machine's. */
  async function saveTranscript(voiceId: string, transcript: string) {
    const { error: e } = await supabase
      .from('chronicle_voice')
      .update({
        transcript,
        transcript_status: 'done',
        transcript_source: 'manual',
        transcript_error: null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', voiceId)
    if (e) throw e
    await done()
  }

  async function renameEntry(voiceId: string, title: string) {
    const { error: e } = await supabase
      .from('chronicle_voice')
      .update({ title: title.trim(), updated_at: new Date().toISOString() })
      .eq('id', voiceId)
    if (e) throw e
    await done()
  }

  async function deleteEntry(voiceId: string) {
    const entry = entries.find((v) => v.id === voiceId)
    const { error: e } = await supabase.from('chronicle_voice').delete().eq('id', voiceId)
    if (e) throw e
    if (entry) await removeFile(entry.audio_path)
    await done()
    notify(TAG_CHANNEL)
  }

  return {
    loading,
    error,
    entries: sorted,
    saveRecording,
    retryTranscription,
    saveTranscript,
    renameEntry,
    deleteEntry,
    refresh,
  }
}
