/**
 * Recording primitives for the Voice tab. Kept apart from React so the awkward
 * bits — codec negotiation, and the fact that the browser's own speech recogniser
 * cannot read a finished file — are in one place.
 */

/**
 * Browsers disagree about container support: Chrome and Firefox record WebM/Opus,
 * Safari records MP4/AAC and does not support WebM at all. Groq's Whisper endpoint
 * accepts both, so the fix is to ask the browser what it can do rather than to
 * assume, and to carry the resulting extension through to the filename — Whisper
 * picks its demuxer from that extension.
 */
const CANDIDATES: { mime: string; extension: string }[] = [
  { mime: 'audio/webm;codecs=opus', extension: 'webm' },
  { mime: 'audio/webm', extension: 'webm' },
  { mime: 'audio/mp4', extension: 'm4a' },
  { mime: 'audio/ogg;codecs=opus', extension: 'ogg' },
]

export function pickRecordingFormat(): { mime: string; extension: string } | null {
  if (typeof MediaRecorder === 'undefined') return null
  for (const candidate of CANDIDATES) {
    if (MediaRecorder.isTypeSupported(candidate.mime)) return candidate
  }
  // Some builds support recording but report nothing; let the browser choose.
  return { mime: '', extension: 'webm' }
}

/**
 * The right file extension for whatever the recorder ACTUALLY produced.
 *
 * This is not the same question as pickRecordingFormat(), and the difference is
 * a real bug on Android. When no candidate is supported the recorder is started
 * with no mimeType at all and the browser picks its own — Chrome on Android
 * lands on WebM, Samsung Internet has been known to produce MP4 — and asking
 * pickRecordingFormat() again afterwards returns the guess, not the answer.
 * Whisper chooses its demuxer from the filename, so a WebM named .m4a (or the
 * reverse) fails to transcribe on one platform and works on the other, which is
 * exactly the kind of fault that only shows up on the device nobody has.
 *
 * MediaRecorder.mimeType is authoritative once recording has begun, so it is
 * what the saved filename is built from.
 */
export function extensionForMime(mime: string | undefined | null): string {
  const type = (mime ?? '').toLowerCase().split(';')[0].trim()
  switch (type) {
    case 'audio/webm':
    case 'video/webm':
      return 'webm'
    case 'audio/mp4':
    case 'video/mp4':
    case 'audio/x-m4a':
    case 'audio/aac':
      return 'm4a'
    case 'audio/ogg':
    case 'audio/ogg;codecs=opus':
      return 'ogg'
    case 'audio/mpeg':
      return 'mp3'
    case 'audio/wav':
    case 'audio/wave':
    case 'audio/x-wav':
      return 'wav'
    case 'audio/flac':
      return 'flac'
    default:
      // Every format Groq's Whisper endpoint accepts is covered above. An unknown
      // one is almost certainly WebM (the only container a browser reaches for
      // without being asked), and guessing it is better than sending no extension
      // at all, which Whisper rejects outright.
      return 'webm'
  }
}

export function canRecord(): boolean {
  return (
    typeof navigator !== 'undefined' &&
    Boolean(navigator.mediaDevices?.getUserMedia) &&
    typeof MediaRecorder !== 'undefined'
  )
}

/** m:ss for anything under an hour, h:mm:ss beyond it. */
export function formatDuration(totalSeconds: number): string {
  const seconds = Math.max(0, Math.floor(totalSeconds))
  const s = seconds % 60
  const m = Math.floor(seconds / 60) % 60
  const h = Math.floor(seconds / 3600)
  const mm = h > 0 ? String(m).padStart(2, '0') : String(m)
  return h > 0 ? `${h}:${mm}:${String(s).padStart(2, '0')}` : `${mm}:${String(s).padStart(2, '0')}`
}

/* ------------------------------------------------------------------------- */
/* Browser speech recognition — the fallback                                  */
/* ------------------------------------------------------------------------- */

/**
 * The Web Speech API can only transcribe a LIVE microphone stream; there is no way
 * to hand it a finished blob. So the fallback cannot run after Groq fails — by then
 * the audio is only a file. It has to run *alongside* the recording, buffering a
 * transcript that is thrown away if Groq succeeds (which it usually will, and its
 * output is markedly better) and used only if Groq does not.
 *
 * Worth knowing: in Chrome this streams audio to Google's servers for recognition.
 * It is off the critical path and only ever a backstop, and a transcript produced
 * this way is stored with transcript_source = 'browser' so it is never passed off
 * as the Whisper one.
 */
type SpeechRecognitionLike = {
  continuous: boolean
  interimResults: boolean
  lang: string
  start: () => void
  stop: () => void
  onresult: ((event: { resultIndex: number; results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }> }) => void) | null
  onerror: (() => void) | null
  onend: (() => void) | null
}

function speechRecognitionCtor(): (new () => SpeechRecognitionLike) | null {
  const w = window as unknown as {
    SpeechRecognition?: new () => SpeechRecognitionLike
    webkitSpeechRecognition?: new () => SpeechRecognitionLike
  }
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null
}

export interface LiveTranscriber {
  stop: () => string
}

/**
 * Starts live recognition if the browser has it, returning a handle whose stop()
 * yields whatever was recognised. Returns null where unsupported (Firefox, and
 * any non-secure context) — the caller treats that as "no fallback available",
 * which is a normal outcome, not an error.
 */
export function startLiveTranscription(): LiveTranscriber | null {
  const Ctor = speechRecognitionCtor()
  if (!Ctor) return null

  let finalText = ''
  let recognition: SpeechRecognitionLike
  try {
    recognition = new Ctor()
    recognition.continuous = true
    recognition.interimResults = false
    recognition.lang = navigator.language || 'en-US'
    recognition.onresult = (event) => {
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i]
        if (result.isFinal) finalText += `${result[0].transcript} `
      }
    }
    // A recogniser that dies mid-recording must not take the recording with it —
    // swallow the error and keep whatever was captured before it stopped.
    recognition.onerror = () => {}
    recognition.start()
  } catch {
    return null
  }

  return {
    stop() {
      try {
        recognition.stop()
      } catch {
        /* already stopped */
      }
      return finalText.trim()
    },
  }
}
