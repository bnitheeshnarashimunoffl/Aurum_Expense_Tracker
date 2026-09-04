import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'

interface InlineAddProps {
  placeholder: string
  onAdd: (label: string) => Promise<void>
  /** Compact sits inside a subject's subtopic list; default sits at category level. */
  size?: 'md' | 'sm'
  /**
   * Bump this to spring the field open from outside.
   *
   * A counter rather than a boolean, so pressing the same button twice works: a
   * boolean that is already true fires no effect, and the second press would do
   * nothing. Used by the empty state on Topics, whose whole job is to put the
   * user in this field — the alternative was auto-focusing on mount, which throws
   * a keyboard over the screen every time anyone opens the tab.
   */
  openToken?: number
}

/**
 * Add-anywhere affordance: a "+" that expands in place into a field and stays open
 * after each submit, so adding six subtopics is six keystrokes-and-enter rather than
 * six trips through a modal. Deliberately ungated — unlike Kindle, structural edits
 * here carry no PIN.
 */
export default function InlineAdd({ placeholder, onAdd, size = 'md', openToken = 0 }: InlineAddProps) {
  const reduceMotion = useReducedMotion()
  const [open, setOpen] = useState(false)
  const [value, setValue] = useState('')
  const [saving, setSaving] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (open) inputRef.current?.focus()
  }, [open])

  useEffect(() => {
    if (openToken > 0) setOpen(true)
  }, [openToken])

  async function submit() {
    const label = value.trim()
    if (!label || saving) return
    setSaving(true)
    try {
      await onAdd(label)
      setValue('')
      inputRef.current?.focus()
    } finally {
      setSaving(false)
    }
  }

  const text = size === 'sm' ? 'text-xs' : 'text-sm'

  return (
    <div className={size === 'sm' ? 'mt-1.5' : 'mt-2'}>
      <AnimatePresence initial={false} mode="wait">
        {open ? (
          <motion.div
            key="field"
            className="flex items-center gap-2"
            initial={reduceMotion ? false : { opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reduceMotion ? undefined : { opacity: 0, y: -4 }}
          >
            <input
              ref={inputRef}
              value={value}
              onChange={(e) => setValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') void submit()
                if (e.key === 'Escape') {
                  setValue('')
                  setOpen(false)
                }
              }}
              onBlur={() => {
                if (!value.trim()) setOpen(false)
              }}
              placeholder={placeholder}
              className={`vigil-neu-pressed-sm min-h-[38px] w-full rounded-xl border-none bg-transparent px-3 text-vigilInk outline-none placeholder:text-vigilInkSoft focus:ring-1 focus:ring-vigilGold ${text}`}
            />
            <button
              type="button"
              onClick={() => void submit()}
              disabled={!value.trim() || saving}
              className="vigil-neu-raised-sm flex h-[38px] flex-shrink-0 items-center rounded-xl px-3 text-xs font-medium text-vigilGold disabled:opacity-40"
            >
              {saving ? 'Adding…' : 'Add'}
            </button>
          </motion.div>
        ) : (
          <motion.button
            key="trigger"
            type="button"
            onClick={() => setOpen(true)}
            className={`flex min-h-[34px] items-center gap-1.5 rounded-xl px-1 text-vigilInkSoft transition-colors hover:text-vigilGold ${text}`}
            initial={reduceMotion ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={reduceMotion ? undefined : { opacity: 0 }}
          >
            <span className="vigil-neu-raised-sm flex h-[22px] w-[22px] items-center justify-center rounded-full text-vigilGold">
              <svg width="12" height="12" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3" strokeLinecap="round" aria-hidden>
                <path d="M12 5v14M5 12h14" />
              </svg>
            </span>
            {placeholder}
          </motion.button>
        )}
      </AnimatePresence>
    </div>
  )
}
