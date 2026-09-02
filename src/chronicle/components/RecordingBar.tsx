import { motion, useReducedMotion } from 'framer-motion'
import { formatDuration } from '../lib/audio'
import type { RecorderState } from '../hooks/useRecorder'

interface RecordingBarProps {
  state: RecorderState
  elapsed: number
  saving: boolean
  onStop: () => void
  onCancel: () => void
}

/**
 * The recording state. One of the three places the brief allows real motion, and
 * the one that has to be unmistakable: while this is on screen the microphone is
 * live, and the user needs to know that at a glance from across the room.
 *
 * The pulse is gold rather than a red borrowed from outside the palette — the brief
 * asks for a harmonious use of these colours, not an ad-hoc one — so the wording and
 * the elapsed clock carry the meaning and the pulse carries the urgency.
 */
export default function RecordingBar({ state, elapsed, saving, onStop, onCancel }: RecordingBarProps) {
  const reduceMotion = useReducedMotion()

  if (state === 'unsupported' || state === 'denied') {
    return (
      <div className="chr-glass fixed inset-x-0 bottom-0 z-40 mx-auto max-w-lg rounded-t-sheet px-5 pb-safe-bottom pt-4">
        <div className="pb-5">
          <p className="text-[14px] text-ivory">
            {state === 'denied' ? 'Microphone access was declined.' : 'This browser cannot record audio.'}
          </p>
          <p className="mt-1 text-[12.5px] leading-relaxed text-ivoryDim">
            {state === 'denied'
              ? 'Allow the microphone in your browser’s site settings, then try again.'
              : 'Recording needs a browser with MediaRecorder — Chrome, Edge, Firefox or Safari 14.1+.'}
          </p>
          <button
            type="button"
            onClick={onCancel}
            className="chr-neu-raised-sm mt-4 min-h-[44px] w-full rounded-card text-[14px] text-ivory focus:outline-none focus-visible:ring-2 focus-visible:ring-gold"
          >
            Close
          </button>
        </div>
      </div>
    )
  }

  const starting = state === 'starting'

  return (
    <motion.div
      className="chr-glass-teal fixed inset-x-0 bottom-0 z-40 mx-auto max-w-lg rounded-t-sheet px-5 pb-safe-bottom pt-4"
      initial={{ y: '100%' }}
      animate={{ y: 0 }}
      exit={{ y: '100%' }}
      transition={reduceMotion ? { duration: 0.12 } : { type: 'spring', stiffness: 360, damping: 30 }}
      role="status"
      aria-live="polite"
    >
      <div className="flex items-center gap-3 pb-5">
        <motion.span
          className="h-3 w-3 shrink-0 rounded-full"
          style={{ background: 'var(--gold-primary)' }}
          animate={reduceMotion ? undefined : { opacity: [1, 0.25, 1] }}
          transition={{ duration: 1.4, repeat: Infinity, ease: 'easeInOut' }}
          aria-hidden
        />
        <div className="min-w-0 flex-1">
          <p className="text-[14px] font-medium text-ivory">
            {starting ? 'Starting…' : saving ? 'Saving…' : 'Recording'}
          </p>
          <p className="text-[12.5px] tabular-nums text-ivory/80">{formatDuration(elapsed)}</p>
        </div>

        <button
          type="button"
          onClick={onCancel}
          disabled={saving}
          className="min-h-[44px] rounded-card px-3 text-[13.5px] text-ivory/80 disabled:opacity-40 focus:outline-none focus-visible:ring-2 focus-visible:ring-gold"
        >
          Discard
        </button>
        <button
          type="button"
          onClick={onStop}
          disabled={starting || saving}
          className="flex min-h-[46px] items-center gap-2 rounded-card bg-gold px-4 text-[14px] font-semibold text-chrBase disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-ivory"
        >
          <svg width="13" height="13" viewBox="0 0 14 14" aria-hidden>
            <rect x="2" y="2" width="10" height="10" rx="2" fill="currentColor" />
          </svg>
          Stop
        </button>
      </div>
    </motion.div>
  )
}
