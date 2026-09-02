import type { ReactNode } from 'react'
import type { Priority, Tag } from '../lib/types'

/**
 * The small shared pieces of Chronicle's surface. They live together because they
 * are the vocabulary every list row is built from, and keeping them in one file is
 * what stops a second, slightly-different tag chip appearing in the Voice tab.
 */

/* ------------------------------------------------------------------------- */
/* Priority                                                                   */
/* ------------------------------------------------------------------------- */

const PRIORITY_STYLE: Record<Priority, { color: string; height: string; label: string }> = {
  // Height is the redundant channel. Ranking three levels by hue alone is not
  // legible to a colourblind or low-vision reader — gold, warm grey and cooler
  // grey are three similar mid-tones once hue is gone — so the mark also gets
  // longer as the priority rises, and carries a title for assistive tech.
  HIGH: { color: 'var(--gold-primary)', height: '100%', label: 'High priority' },
  MEDIUM: { color: 'var(--ivory-dim)', height: '58%', label: 'Medium priority' },
  LOW: { color: 'var(--chr-priority-low)', height: '30%', label: 'Low priority' },
}

export function PriorityMark({ priority }: { priority: Priority }) {
  const style = PRIORITY_STYLE[priority]
  return (
    <span
      className="relative flex w-[3px] shrink-0 items-center self-stretch rounded-full"
      role="img"
      aria-label={style.label}
    >
      <span className="w-full rounded-full" style={{ background: style.color, height: style.height }} />
    </span>
  )
}

/* ------------------------------------------------------------------------- */
/* Tags                                                                       */
/* ------------------------------------------------------------------------- */

interface TagChipProps {
  label: string
  active?: boolean
  onClick?: () => void
  onRemove?: () => void
}

export function TagChip({ label, active = false, onClick, onRemove }: TagChipProps) {
  const base =
    'inline-flex min-h-[28px] items-center gap-1 rounded-full px-2.5 text-[11.5px] leading-none transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-gold'
  // The active chip is a gold FILL with charcoal ink (6.85:1) rather than gold text,
  // which would fail contrast anywhere near the teal surfaces.
  const tone = active
    ? 'bg-gold text-chrBase'
    : 'chr-chip text-ivoryDim hover:text-ivory'

  if (onRemove) {
    return (
      <span className={`${base} ${tone}`}>
        {label}
        <button
          type="button"
          onClick={onRemove}
          aria-label={`Remove tag ${label}`}
          className="-mr-1 flex h-6 w-6 items-center justify-center rounded-full text-current focus:outline-none focus-visible:ring-2 focus-visible:ring-gold"
        >
          <svg width="9" height="9" viewBox="0 0 10 10" aria-hidden>
            <path d="M1 1 L9 9 M9 1 L1 9" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
          </svg>
        </button>
      </span>
    )
  }

  if (!onClick) return <span className={`${base} ${tone}`}>{label}</span>

  return (
    <button type="button" onClick={onClick} aria-pressed={active} className={`${base} ${tone}`}>
      {label}
    </button>
  )
}

export function TagRow({ tags, max = 3 }: { tags: Tag[]; max?: number }) {
  if (tags.length === 0) return null
  const shown = tags.slice(0, max)
  const rest = tags.length - shown.length
  return (
    <span className="flex flex-wrap items-center gap-1.5">
      {shown.map((tag) => (
        <span key={tag.id} className="text-[11.5px] leading-none text-ivoryDim">
          #{tag.label}
        </span>
      ))}
      {rest > 0 && <span className="text-[11.5px] leading-none text-ivoryDim">+{rest}</span>}
    </span>
  )
}

/* ------------------------------------------------------------------------- */
/* Empty states                                                               */
/* ------------------------------------------------------------------------- */

/**
 * The only centred thing in Chronicle — everything else is left-aligned, because
 * this is a reading module. An empty state is the one place with nothing to read.
 */
export function EmptyState({ title, body, icon }: { title: string; body: string; icon?: ReactNode }) {
  return (
    <div className="flex flex-col items-center px-8 py-16 text-center">
      {icon && <div className="mb-4 opacity-70">{icon}</div>}
      <p className="font-chronicle text-[17px] text-ivory">{title}</p>
      <p className="mt-2 max-w-[34ch] text-[13.5px] leading-relaxed text-ivoryDim">{body}</p>
    </div>
  )
}

/* ------------------------------------------------------------------------- */
/* Buttons                                                                    */
/* ------------------------------------------------------------------------- */

interface ButtonProps {
  children: ReactNode
  onClick?: () => void
  type?: 'button' | 'submit'
  disabled?: boolean
  full?: boolean
}

/** Gold fill, charcoal ink — 6.85:1, and the only saturated fill in the module. */
export function PrimaryButton({ children, onClick, type = 'button', disabled, full }: ButtonProps) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`${full ? 'w-full' : ''} min-h-[44px] rounded-card bg-gold px-4 text-[14px] font-semibold text-chrBase transition-opacity active:opacity-90 disabled:opacity-40 focus:outline-none focus-visible:ring-2 focus-visible:ring-ivory focus-visible:ring-offset-2 focus-visible:ring-offset-chrBase`}
    >
      {children}
    </button>
  )
}

export function QuietButton({ children, onClick, type = 'button', disabled, full }: ButtonProps) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`${full ? 'w-full' : ''} chr-neu-raised-sm min-h-[44px] rounded-card px-4 text-[14px] text-ivory transition-opacity active:opacity-90 disabled:opacity-40 focus:outline-none focus-visible:ring-2 focus-visible:ring-gold`}
    >
      {children}
    </button>
  )
}

/* ------------------------------------------------------------------------- */
/* Fields                                                                     */
/* ------------------------------------------------------------------------- */

/**
 * Every text input in Chronicle is a pressed well — an input is a place things go
 * into, so it is cut into the surface rather than sitting on it. That is the one
 * rule that keeps the neumorphism meaning something instead of being decoration.
 */
export const FIELD_CLASS =
  'chr-neu-pressed-sm w-full rounded-card bg-transparent px-3.5 py-3 text-[15px] text-ivory placeholder:text-ivoryDim focus:outline-none focus-visible:ring-2 focus-visible:ring-gold'

export function FieldLabel({ children, htmlFor }: { children: ReactNode; htmlFor?: string }) {
  return (
    <label htmlFor={htmlFor} className="mb-1.5 block text-[12.5px] text-ivoryDim">
      {children}
    </label>
  )
}

/** A quiet horizontal rule — the divider Chronicle's lists use instead of cards. */
export function Rule({ teal = false }: { teal?: boolean }) {
  return <div className="h-px w-full" style={{ background: teal ? 'var(--chr-rule-teal)' : 'var(--chr-rule)' }} />
}
