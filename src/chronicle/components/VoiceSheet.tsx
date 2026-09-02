import { useEffect, useRef, useState } from 'react'
import ChronicleSheet from './ChronicleSheet'
import TagPicker from './TagPicker'
import { FIELD_CLASS, FieldLabel, PrimaryButton, QuietButton, Rule, TagChip } from './Primitives'
import { formatDuration } from '../lib/audio'
import { signedUrl } from '../lib/media'
import { voiceLabel, type Tag, type VoiceEntry } from '../lib/types'

interface VoiceSheetProps {
  entry: VoiceEntry | null
  open: boolean
  onClose: () => void
  allTags: Tag[]
  selectedTags: Tag[]
  onToggleTag: (tagId: string) => void
  onCreateTag: (label: string) => Promise<void>
  onRename: (title: string) => Promise<void>
  onSaveTranscript: (transcript: string) => Promise<void>
  onRetry: () => Promise<void>
  onDelete: () => Promise<void>
  linkedTodoTitles: string[]
}

/**
 * Playback, built rather than borrowed. A native <audio controls> is the reliable
 * option, but it drops a chrome-coloured widget into the middle of a designed
 * surface — so this is a play button, a seek slider (a real range input, so it
 * stays keyboard operable and announces its value) and two tabular clocks.
 */
function Player({ path, duration }: { path: string; duration: number }) {
  const audioRef = useRef<HTMLAudioElement>(null)
  const [url, setUrl] = useState<string | null>(null)
  const [playing, setPlaying] = useState(false)
  const [position, setPosition] = useState(0)
  const [failed, setFailed] = useState(false)

  // The bucket is private, so the src has to be signed each time the sheet opens.
  useEffect(() => {
    let cancelled = false
    setUrl(null)
    setFailed(false)
    signedUrl(path).then((signed) => {
      if (cancelled) return
      if (signed) setUrl(signed)
      else setFailed(true)
    })
    return () => {
      cancelled = true
    }
  }, [path])

  // The recorded duration is the one we stored at capture time: a WebM from
  // MediaRecorder reports Infinity for its own duration, so the element cannot be
  // trusted for the total even once it has loaded.
  const total = duration > 0 ? duration : 0

  function toggle() {
    const audio = audioRef.current
    if (!audio) return
    if (playing) {
      audio.pause()
    } else {
      void audio.play()
    }
  }

  if (failed) return <p className="text-[13px] text-ivoryDim">The audio file could not be loaded.</p>

  return (
    <div className="chr-neu-pressed-sm flex items-center gap-3 rounded-card px-3 py-2.5">
      <button
        type="button"
        onClick={toggle}
        disabled={!url}
        aria-label={playing ? 'Pause' : 'Play'}
        className="chr-neu-raised-sm flex h-11 w-11 shrink-0 items-center justify-center rounded-full disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-gold"
      >
        {playing ? (
          <svg width="15" height="15" viewBox="0 0 16 16" aria-hidden>
            <rect x="3.4" y="2.6" width="3.4" height="10.8" rx="1.2" fill="var(--gold-primary)" />
            <rect x="9.2" y="2.6" width="3.4" height="10.8" rx="1.2" fill="var(--gold-primary)" />
          </svg>
        ) : (
          <svg width="15" height="15" viewBox="0 0 16 16" aria-hidden>
            <path d="M4.4 2.9 L13 8 L4.4 13.1 Z" fill="var(--gold-primary)" />
          </svg>
        )}
      </button>

      <input
        type="range"
        min={0}
        max={Math.max(total, 0.1)}
        step={0.1}
        value={Math.min(position, total)}
        onChange={(e) => {
          const next = Number(e.target.value)
          setPosition(next)
          if (audioRef.current) audioRef.current.currentTime = next
        }}
        aria-label="Playback position"
        className="h-1.5 w-full cursor-pointer"
        style={{ accentColor: 'var(--gold-primary)' }}
      />

      <span className="shrink-0 text-[12px] tabular-nums text-ivoryDim">
        {formatDuration(position)} / {formatDuration(total)}
      </span>

      {url && (
        <audio
          ref={audioRef}
          src={url}
          preload="metadata"
          onPlay={() => setPlaying(true)}
          onPause={() => setPlaying(false)}
          onEnded={() => {
            setPlaying(false)
            setPosition(0)
          }}
          onTimeUpdate={(e) => setPosition(e.currentTarget.currentTime)}
          className="hidden"
        />
      )}
    </div>
  )
}

export default function VoiceSheet(props: VoiceSheetProps) {
  const { entry, open, onClose } = props
  const [title, setTitle] = useState('')
  const [transcript, setTranscript] = useState('')
  const [showTags, setShowTags] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [retrying, setRetrying] = useState(false)

  useEffect(() => {
    if (!entry) return
    setTitle(entry.title)
    setTranscript(entry.transcript)
    setShowTags(false)
    setConfirmDelete(false)
  }, [entry?.id])

  // A transcript that arrives while the sheet is open should appear in it, but only
  // if the field has not been edited — otherwise the arriving text would overwrite
  // a correction being typed.
  useEffect(() => {
    if (entry && entry.transcript !== transcript && transcript === '') setTranscript(entry.transcript)
  }, [entry?.transcript])

  if (!entry) return null

  return (
    <ChronicleSheet open={open} onClose={onClose} title={voiceLabel(entry)}>
      <div className="space-y-5">
        <Player path={entry.audio_path} duration={entry.duration_seconds} />

        <div>
          <FieldLabel htmlFor="voice-title">Title</FieldLabel>
          <input
            id="voice-title"
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={() => title !== entry.title && props.onRename(title)}
            placeholder="Untitled — the first line of the transcript stands in"
            className={FIELD_CLASS}
          />
        </div>

        <div>
          <div className="mb-1.5 flex items-baseline justify-between gap-3">
            <FieldLabel htmlFor="voice-transcript">Transcript</FieldLabel>
            {entry.transcript_status === 'pending' && <span className="text-[12px] text-ivoryDim">Transcribing…</span>}
            {entry.transcript_source === 'browser' && entry.transcript_status === 'done' && (
              <span className="text-[12px] text-ivoryDim">From the browser recogniser</span>
            )}
          </div>

          {entry.transcript_status === 'failed' && (
            <div className="mb-2.5 rounded-card px-3 py-2.5" style={{ background: 'var(--charcoal-shadow)' }}>
              <p className="text-[12.5px] leading-relaxed text-ivory">Transcription failed. The recording is safe.</p>
              {entry.transcript_error && (
                <p className="mt-1 text-[11.5px] leading-relaxed text-ivoryDim">{entry.transcript_error}</p>
              )}
              <div className="mt-2.5">
                <QuietButton
                  disabled={retrying}
                  onClick={async () => {
                    setRetrying(true)
                    try {
                      await props.onRetry()
                    } finally {
                      setRetrying(false)
                    }
                  }}
                >
                  {retrying ? 'Retrying…' : 'Retry transcription'}
                </QuietButton>
              </div>
            </div>
          )}

          <textarea
            id="voice-transcript"
            rows={6}
            value={transcript}
            onChange={(e) => setTranscript(e.target.value)}
            onBlur={() => transcript !== entry.transcript && props.onSaveTranscript(transcript)}
            placeholder={
              entry.transcript_status === 'pending'
                ? 'Waiting for the transcript — you can type over it when it arrives.'
                : 'No transcript. You can write one yourself.'
            }
            className={`${FIELD_CLASS} resize-y leading-relaxed`}
          />
          <p className="mt-1.5 text-[11.5px] text-ivoryDim">
            Auto-transcription gets things wrong; edits are saved as your own version.
          </p>
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
            <TagPicker all={props.allTags} selected={props.selectedTags} onToggle={props.onToggleTag} onCreate={props.onCreateTag} />
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

        {props.linkedTodoTitles.length > 0 && (
          <p className="text-[12.5px] text-ivoryDim">
            Attached to {props.linkedTodoTitles.map((t) => `“${t}”`).join(', ')}
          </p>
        )}

        <Rule />

        {confirmDelete ? (
          <div className="flex items-center gap-2">
            <QuietButton full onClick={() => setConfirmDelete(false)}>
              Keep it
            </QuietButton>
            <PrimaryButton full onClick={() => void props.onDelete()}>
              Delete recording
            </PrimaryButton>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setConfirmDelete(true)}
            className="min-h-[44px] w-full rounded-card text-[13.5px] text-ivoryDim focus:outline-none focus-visible:ring-2 focus-visible:ring-gold"
          >
            Delete this recording
          </button>
        )}
      </div>
    </ChronicleSheet>
  )
}
