import { useEffect, useRef } from 'react'
import { motion, useReducedMotion } from 'framer-motion'

/**
 * The persistent furniture of Chronicle's home screen: the search field, the three
 * tabs, and the capture action. Together they are the module's whole navigation, so
 * they are kept in one file — a change to how the tabs read almost always needs the
 * same change to what the capture button does.
 */

export type ChronicleTab = 'todos' | 'notes' | 'voice'

export const TABS: { id: ChronicleTab; label: string }[] = [
  { id: 'todos', label: 'To-Dos' },
  { id: 'notes', label: 'Notes' },
  { id: 'voice', label: 'Voice' },
]

/* ------------------------------------------------------------------------- */
/* Search                                                                     */
/* ------------------------------------------------------------------------- */

interface SearchFieldProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  /** Set once, on mount, when the field should take focus (the Secret section does). */
  autoFocus?: boolean
  teal?: boolean
}

export function SearchField({ value, onChange, placeholder = 'Search everything', autoFocus, teal }: SearchFieldProps) {
  const ref = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (autoFocus) ref.current?.focus()
  }, [autoFocus])

  return (
    <div
      data-tour="chronicle-search"
      className={`${teal ? 'chr-neu-pressed-teal' : 'chr-neu-pressed-sm'} flex items-center gap-2.5 rounded-card px-3.5 focus-within:ring-2 focus-within:ring-gold`}
    >
      <svg width="16" height="16" viewBox="0 0 20 20" fill="none" aria-hidden className="shrink-0">
        <circle cx="8.5" cy="8.5" r="5.5" stroke="var(--ivory-dim)" strokeWidth="1.6" />
        <path d="M12.8 12.8 L17 17" stroke="var(--ivory-dim)" strokeWidth="1.6" strokeLinecap="round" />
      </svg>
      <input
        ref={ref}
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label={placeholder}
        // No autocomplete or spellcheck: this field doubles as the way into the
        // Secret Notes section, and a browser that remembers what was typed here
        // would offer it back in a dropdown to whoever opens the app next.
        autoComplete="off"
        autoCorrect="off"
        spellCheck={false}
        className="min-h-[46px] w-full bg-transparent text-[15px] text-ivory placeholder:text-ivoryDim focus:outline-none"
      />
      {value && (
        <button
          type="button"
          onClick={() => onChange('')}
          aria-label="Clear search"
          className="-mr-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-ivoryDim focus:outline-none focus-visible:ring-2 focus-visible:ring-gold"
        >
          <svg width="11" height="11" viewBox="0 0 10 10" aria-hidden>
            <path d="M1 1 L9 9 M9 1 L1 9" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
          </svg>
        </button>
      )}
    </div>
  )
}

/* ------------------------------------------------------------------------- */
/* Tabs                                                                       */
/* ------------------------------------------------------------------------- */

interface TabBarProps {
  active: ChronicleTab
  onChange: (tab: ChronicleTab) => void
  counts: Record<ChronicleTab, number>
}

/**
 * A raised strip with the active tab cut INTO it in teal — the one place the brief
 * assigns teal, and the module's main hierarchy signal. The moving indicator is a
 * layoutId, so it slides between tabs rather than blinking; reduced-motion drops
 * the slide and keeps the position.
 */
export function TabBar({ active, onChange, counts }: TabBarProps) {
  const reduceMotion = useReducedMotion()

  return (
    <div data-tour="chronicle-tabs" role="tablist" aria-label="Chronicle sections" className="chr-neu-raised-sm flex gap-1 rounded-card p-1">
      {TABS.map((tab) => {
        const isActive = tab.id === active
        return (
          <button
            key={tab.id}
            role="tab"
            id={`chronicle-tab-${tab.id}`}
            aria-selected={isActive}
            aria-controls="chronicle-panel"
            onClick={() => onChange(tab.id)}
            className="relative flex min-h-[40px] flex-1 items-center justify-center rounded-[15px] focus:outline-none focus-visible:ring-2 focus-visible:ring-gold"
          >
            {isActive && (
              <motion.span
                layoutId="chronicle-tab-indicator"
                className="chr-neu-raised-teal absolute inset-0 rounded-[15px]"
                transition={reduceMotion ? { duration: 0 } : { type: 'spring', stiffness: 420, damping: 34 }}
              />
            )}
            {/* Ivory on teal-raised is 7.61:1; ivory-dim there would be 3.60 and fail,
                so the inactive label is the only one allowed to be dim. */}
            <span className={`relative z-10 text-[13.5px] ${isActive ? 'font-semibold text-ivory' : 'text-ivoryDim'}`}>
              {tab.label}
              {counts[tab.id] > 0 && (
                <span className={`ml-1.5 text-[11.5px] tabular-nums ${isActive ? 'text-ivory/70' : 'text-ivoryDim/70'}`}>
                  {counts[tab.id]}
                </span>
              )}
            </span>
          </button>
        )
      })}
    </div>
  )
}

/* ------------------------------------------------------------------------- */
/* Capture                                                                    */
/* ------------------------------------------------------------------------- */

interface CaptureButtonProps {
  tab: ChronicleTab
  onCapture: () => void
}

const CAPTURE_LABEL: Record<ChronicleTab, string> = {
  todos: 'New to-do',
  notes: 'New note',
  voice: 'Start recording',
}

/**
 * The hero interaction. One tap, always in the same place, always within reach of a
 * thumb — and context-aware, so in the Voice tab it is a microphone that begins
 * recording immediately rather than a plus that opens a form.
 */
export function CaptureButton({ tab, onCapture }: CaptureButtonProps) {
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-30 mx-auto max-w-lg">
      <button
        type="button"
        onClick={onCapture}
        data-tour="chronicle-capture"
        aria-label={CAPTURE_LABEL[tab]}
        className="chr-neu-raised pointer-events-auto absolute right-5 flex h-[58px] w-[58px] items-center justify-center rounded-full ring-1 ring-inset ring-gold/25 transition-transform active:scale-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-gold"
        style={{ bottom: 'calc(env(safe-area-inset-bottom) + 1.5rem)' }}
      >
        {tab === 'voice' ? (
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden>
            <rect x="9" y="3" width="6" height="11" rx="3" fill="var(--gold-primary)" />
            <path d="M5.5 11.5a6.5 6.5 0 0 0 13 0" stroke="var(--gold-primary)" strokeWidth="1.8" strokeLinecap="round" />
            <path d="M12 18v3" stroke="var(--gold-primary)" strokeWidth="1.8" strokeLinecap="round" />
          </svg>
        ) : (
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden>
            <path d="M12 5v14M5 12h14" stroke="var(--gold-primary)" strokeWidth="2" strokeLinecap="round" />
          </svg>
        )}
      </button>
    </div>
  )
}
