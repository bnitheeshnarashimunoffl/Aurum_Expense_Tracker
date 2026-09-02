import { useCallback, useEffect, useRef, useState } from 'react'
import { canRecord, pickRecordingFormat, startLiveTranscription, type LiveTranscriber } from '../lib/audio'
import type { FinishedRecording } from './useVoice'

export type RecorderState = 'idle' | 'starting' | 'recording' | 'stopping' | 'unsupported' | 'denied'

/**
 * Microphone capture for the Voice tab. One tap starts it — the brief is explicit
 * that recording must not be behind a form — so this hook owns the permission
 * prompt, the stream, the elapsed clock and the browser's live recogniser, and
 * hands back a finished blob.
 */
export function useRecorder() {
  const [state, setState] = useState<RecorderState>(() => (canRecord() ? 'idle' : 'unsupported'))
  const [elapsed, setElapsed] = useState(0)

  const recorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const streamRef = useRef<MediaStream | null>(null)
  const startedAtRef = useRef(0)
  const liveRef = useRef<LiveTranscriber | null>(null)
  const tickRef = useRef<number | null>(null)

  const teardown = useCallback(() => {
    if (tickRef.current !== null) {
      window.clearInterval(tickRef.current)
      tickRef.current = null
    }
    streamRef.current?.getTracks().forEach((track) => track.stop())
    streamRef.current = null
    recorderRef.current = null
  }, [])

  // Releasing the microphone on unmount matters more than usual here: a stream left
  // open keeps the browser's recording indicator lit, which reads as the app still
  // listening after the user has left the tab.
  useEffect(() => teardown, [teardown])

  const start = useCallback(async (): Promise<boolean> => {
    if (!canRecord()) {
      setState('unsupported')
      return false
    }
    setState('starting')
    let stream: MediaStream
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    } catch {
      setState('denied')
      return false
    }

    const format = pickRecordingFormat()
    const recorder = new MediaRecorder(stream, format?.mime ? { mimeType: format.mime } : undefined)
    chunksRef.current = []
    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) chunksRef.current.push(event.data)
    }

    streamRef.current = stream
    recorderRef.current = recorder
    startedAtRef.current = performance.now()
    // Runs alongside the recording, not after it — see lib/audio.ts for why the
    // browser recogniser cannot be applied to a finished file.
    liveRef.current = startLiveTranscription()

    recorder.start()
    setElapsed(0)
    setState('recording')
    tickRef.current = window.setInterval(() => {
      setElapsed((performance.now() - startedAtRef.current) / 1000)
    }, 200)
    return true
  }, [])

  const stop = useCallback(async (): Promise<FinishedRecording | null> => {
    const recorder = recorderRef.current
    if (!recorder || recorder.state === 'inactive') return null
    setState('stopping')

    const format = pickRecordingFormat()
    // The elapsed clock is the duration of record: a WebM produced by MediaRecorder
    // carries no duration in its header, so reading it back gives Infinity.
    const durationSeconds = (performance.now() - startedAtRef.current) / 1000

    const blob = await new Promise<Blob>((resolve) => {
      recorder.onstop = () => resolve(new Blob(chunksRef.current, { type: recorder.mimeType || format?.mime || 'audio/webm' }))
      recorder.stop()
    })

    const liveTranscript = liveRef.current?.stop() ?? ''
    liveRef.current = null
    teardown()
    setState('idle')
    setElapsed(0)

    return { blob, extension: format?.extension ?? 'webm', durationSeconds, liveTranscript }
  }, [teardown])

  /** Abandons the recording without producing anything to save. */
  const cancel = useCallback(() => {
    const recorder = recorderRef.current
    if (recorder && recorder.state !== 'inactive') {
      recorder.onstop = null
      recorder.stop()
    }
    liveRef.current?.stop()
    liveRef.current = null
    teardown()
    setState('idle')
    setElapsed(0)
  }, [teardown])

  return { state, elapsed, start, stop, cancel, recording: state === 'recording' }
}
