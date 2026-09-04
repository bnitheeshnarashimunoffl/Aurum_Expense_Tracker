import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'

/**
 * The shared parts of the first-run setup walkthrough.
 *
 * This is the first screen a stranger ever sees, and it is asking them to do
 * something in a product they have never heard of. So it borrows every signal the
 * rest of Meridian already uses — the neumorphic pair, the gold hairline, the sun
 * crossing a horizon as progress — rather than inventing a "setup wizard" look
 * that would read as a different app bolted on the front.
 */

/* -------------------------------------------------------------------------- */
/* Progress — the same sun-over-a-horizon as the module walkthroughs           */
/* -------------------------------------------------------------------------- */

export function SunProgress({ index, total }: { index: number; total: number }) {
  const t = total <= 1 ? 1 : index / (total - 1)
  const x = 8 + 47 - 47 * Math.cos(Math.PI * t)
  const y = 20 - 14 * Math.sin(Math.PI * t)

  return (
    <svg width="110" height="27" viewBox="0 0 110 27" fill="none" role="img" aria-label={`Step ${index + 1} of ${total}`}>
      <path d="M8 20 A 47 14 0 0 1 102 20" stroke="var(--text-muted)" strokeWidth="1" strokeDasharray="2 3" opacity="0.5" fill="none" />
      <line x1="2" y1="20" x2="108" y2="20" stroke="var(--accent)" strokeWidth="1" opacity="0.45" strokeLinecap="round" />
      <circle cx={x} cy={y} r="8" fill="var(--accent)" opacity="0.18" />
      <circle cx={x} cy={y} r="4.2" fill="var(--accent)" />
    </svg>
  )
}

/* -------------------------------------------------------------------------- */
/* Numbered click-path list                                                    */
/* -------------------------------------------------------------------------- */

/**
 * The exact taps, in order, with the same gold numerals the iOS install banner
 * uses. Every step in this flow that asks the user to go somewhere else uses
 * this, so "what do I click" always looks the same.
 */
export function ClickPath({ steps }: { steps: ReactNode[] }) {
  return (
    <ol className="mt-3 space-y-2.5">
      {steps.map((step, i) => (
        <li key={i} className="flex items-baseline gap-3 text-[13px] leading-relaxed text-primary">
          <span
            className="flex h-[19px] w-[19px] flex-shrink-0 items-center justify-center rounded-full text-[10px] font-semibold tabular-nums text-ink"
            style={{ background: 'var(--accent)' }}
          >
            {i + 1}
          </span>
          <span className="min-w-0 flex-1">{step}</span>
        </li>
      ))}
    </ol>
  )
}

/** A phrase to look for on the other site, set apart so the eye can match it. */
export function Ui({ children }: { children: ReactNode }) {
  return <span className="text-accent">{children}</span>
}

export function ExternalLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer noopener"
      className="text-accent underline decoration-accent/40 underline-offset-[3px]"
    >
      {children}
    </a>
  )
}

/* -------------------------------------------------------------------------- */
/* Callout                                                                     */
/* -------------------------------------------------------------------------- */

/**
 * A pressed-in panel for the two things in this flow that are worth stopping for:
 * the key that must never be used, and the fact that these credentials live on
 * this device only.
 */
export function Callout({ tone = 'neutral', title, children }: { tone?: 'neutral' | 'warn'; title: string; children: ReactNode }) {
  return (
    <div
      className="neu-pressed mt-4 rounded-card px-4 py-3.5"
      style={tone === 'warn' ? { boxShadow: 'inset 6px 6px 12px rgba(0,0,0,0.5), inset -4px -4px 10px rgba(255,255,255,0.03), inset 0 0 0 1px rgba(201,124,93,0.35)' } : undefined}
    >
      <h3 className={`text-[13px] font-semibold ${tone === 'warn' ? 'text-expense' : 'text-primary'}`}>{title}</h3>
      <p className="mt-1 text-[12.5px] leading-relaxed text-muted">{children}</p>
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/* Copy button                                                                 */
/* -------------------------------------------------------------------------- */

/**
 * One tap puts the whole script on the clipboard.
 *
 * The execCommand fallback is not legacy cruft — navigator.clipboard is refused
 * outright in a few mobile in-app browsers (and in any non-HTTPS context), and a
 * copy button that silently does nothing on the one step that cannot be typed by
 * hand would end the setup right there.
 */
export function CopyButton({ text, label = 'Copy the script' }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false)
  const timer = useRef<number | null>(null)

  useEffect(
    () => () => {
      if (timer.current !== null) window.clearTimeout(timer.current)
    },
    []
  )

  const flash = useCallback(() => {
    setCopied(true)
    if (timer.current !== null) window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => setCopied(false), 2200)
  }, [])

  async function handleCopy() {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text)
        flash()
        return
      }
    } catch {
      /* fall through to the textarea route */
    }
    try {
      const area = document.createElement('textarea')
      area.value = text
      area.setAttribute('readonly', '')
      area.style.position = 'fixed'
      area.style.opacity = '0'
      document.body.appendChild(area)
      area.select()
      area.setSelectionRange(0, text.length)
      document.execCommand('copy')
      document.body.removeChild(area)
      flash()
    } catch {
      // Nothing left to try. Selecting the block by hand still works, which is
      // why the script is shown rather than hidden behind the button.
      setCopied(false)
    }
  }

  return (
    <button
      type="button"
      onClick={() => void handleCopy()}
      className="neu-raised min-h-[48px] w-full rounded-card text-[14px] font-semibold text-ink transition-transform active:scale-[0.98] focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
      style={{ background: copied ? 'var(--income)' : 'var(--accent)' }}
    >
      {copied ? 'Copied' : label}
    </button>
  )
}

/* -------------------------------------------------------------------------- */
/* Code block                                                                  */
/* -------------------------------------------------------------------------- */

/**
 * The script itself, shown rather than hidden. It is long and nobody will read
 * it, but a page that asks you to paste something invisible into your own
 * database is asking for trust it has not earned.
 */
export function CodeBlock({ code }: { code: string }) {
  return (
    <div className="neu-pressed mt-3 overflow-hidden rounded-card">
      <pre
        className="max-h-[190px] overflow-auto px-4 py-3 text-[11px] leading-[1.55] text-muted"
        style={{ fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace', WebkitOverflowScrolling: 'touch' }}
      >
        <code>{code}</code>
      </pre>
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/* Field                                                                       */
/* -------------------------------------------------------------------------- */

export function Field({
  id,
  label,
  hint,
  value,
  onChange,
  placeholder,
  autoComplete = 'off',
  multiline = false,
}: {
  id: string
  label: string
  hint?: string
  value: string
  onChange: (next: string) => void
  placeholder?: string
  autoComplete?: string
  multiline?: boolean
}) {
  const shared =
    'neu-pressed w-full rounded-card border-none bg-surface px-4 py-3 text-[13px] text-primary outline-none placeholder:text-muted/50 focus:ring-1 focus:ring-accent'

  return (
    <div className="mt-4">
      <label className="mb-1.5 block text-[12.5px] font-medium text-primary" htmlFor={id}>
        {label}
      </label>
      {hint && <p className="mb-2 text-[11.5px] leading-relaxed text-muted">{hint}</p>}
      {multiline ? (
        <textarea
          id={id}
          rows={3}
          spellCheck={false}
          autoCapitalize="none"
          autoCorrect="off"
          autoComplete={autoComplete}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className={`${shared} resize-none break-all`}
          style={{ fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace' }}
        />
      ) : (
        <input
          id={id}
          type="text"
          inputMode="url"
          spellCheck={false}
          autoCapitalize="none"
          autoCorrect="off"
          autoComplete={autoComplete}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className={shared}
          style={{ fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace' }}
        />
      )}
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/* Page frame                                                                  */
/* -------------------------------------------------------------------------- */

export function SetupFrame({ eyebrow, children }: { eyebrow: string; children: ReactNode }) {
  return (
    <div className="mx-auto min-h-full max-w-lg px-5 pb-10 pt-safe-top">
      <header className="pb-5 pt-9">
        <p className="font-display text-center text-[11px] font-semibold tracking-[0.32em] text-muted">{eyebrow}</p>
        <div className="mx-auto mt-3 h-px w-24" style={{ background: 'linear-gradient(90deg, transparent, var(--accent), transparent)', opacity: 0.6 }} />
      </header>
      {children}
    </div>
  )
}
