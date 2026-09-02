import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { notify, subscribe } from '@/lib/sync'
import { currentUserId, removeFile, uploadAudio } from '../lib/media'
import { TAG_CHANNEL } from './useTags'
import type { VoiceEntry } from '../lib/types'

const CHANNEL = 'chronicle_voice'

export interface FinishedRecording {
  blob: Blob
  extension: string
  durationSeconds: number
  /** Whatever the browser's live recogniser heard, if it was available at all. */
  liveTranscript: string
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
      setEntries((data ?? []) as VoiceEntry[])
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
   * already saved, listed and playable by the time this runs. Everything here is
   * best-effort — the function writes 'failed' onto the row itself if it cannot
   * finish, so the retry affordance appears even if this tab is closed first.
   */
  async function requestTranscription(voiceId: string, liveTranscript = '') {
    try {
      const { error: e } = await supabase.functions.invoke('transcribe-voice', { body: { voice_id: voiceId } })
      if (!e) {
        await done()
        return
      }
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
          .eq('id', voiceId)
      }
    } catch {
      /* The row already carries a failed status written server-side. */
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
    void requestTranscription(entry.id, recording.liveTranscript)
    return entry
  }

  async function retryTranscription(voiceId: string) {
    await supabase
      .from('chronicle_voice')
      .update({ transcript_status: 'pending', transcript_error: null, updated_at: new Date().toISOString() })
      .eq('id', voiceId)
    await done()
    await requestTranscription(voiceId)
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
