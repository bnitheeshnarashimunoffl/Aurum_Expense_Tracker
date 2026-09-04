import type { CSSProperties, ReactNode } from 'react'
import { Link } from 'react-router-dom'

/**
 * The zero-state every module shows before it has anything in it.
 *
 * WHY THIS EXISTS AS ONE COMPONENT. Meridian ships with almost no data now — a
 * new account's Virtus, Loom, Vigil and Aurum are all completely empty on first
 * open — so the empty state stopped being an edge case and became the first
 * screen of four of the six apps. Five hand-rolled versions would have drifted
 * within a week; this way they are the same object with five palettes.
 *
 * Every one of them ends in a button. That is the whole point of the component:
 * an empty screen that only says "nothing here yet" has told the user something
 * they could already see. The useful half is what to do about it, and where.
 */

export type EmptyTone = 'aurum' | 'kindle' | 'vigil' | 'loom' | 'virtus'

interface Tone {
  /** The raised card, in that module's own neumorphic pair. */
  surface: string
  /** The pressed well the icon sits in. */
  well: string
  title: string
  body: string
  /** Filled primary button — the module's action colour and the ink that reads on it. */
  action: CSSProperties
  quiet: string
  ring: string
  /** The gold-or-equivalent hairline along the top edge, the shared family signal. */
  hairline: string
}

const TONES: Record<EmptyTone, Tone> = {
  aurum: {
    surface: 'neu-raised',
    well: 'neu-pressed',
    title: 'font-display text-primary',
    body: 'text-muted',
    action: { background: 'var(--accent)', color: '#0B0D10' },
    quiet: 'text-muted',
    ring: 'focus-visible:ring-accent',
    hairline: 'rgba(201,164,106,0.3)',
  },
  kindle: {
    surface: 'kindle-neu-raised',
    well: 'kindle-neu-pressed',
    title: 'font-display text-primary',
    body: 'text-muted',
    action: { background: 'var(--accent)', color: '#0B0D10' },
    quiet: 'text-muted',
    ring: 'focus-visible:ring-accent',
    hairline: 'rgba(201,164,106,0.3)',
  },
  vigil: {
    surface: 'vigil-neu-raised',
    well: 'vigil-neu-pressed-sm',
    title: 'font-display text-vigilInk',
    body: 'text-vigilInkSoft',
    action: { background: 'var(--vigil-bronze)', color: 'var(--vigil-bg-surface)' },
    quiet: 'text-vigilInkSoft',
    ring: 'focus-visible:ring-vigilBronze',
    hairline: 'rgba(188,138,63,0.45)',
  },
  loom: {
    surface: 'loom-neu-raised',
    well: 'loom-neu-pressed-sm',
    title: 'font-display text-loomInk',
    body: 'text-loomMuted',
    action: { background: 'var(--loom-gold)', color: 'var(--loom-bg-base)' },
    quiet: 'text-loomMuted',
    ring: 'focus-visible:ring-loomGold',
    hairline: 'rgba(201,164,106,0.32)',
  },
  virtus: {
    surface: 'virtus-neu-raised',
    well: 'virtus-neu-pressed-sm',
    title: 'font-inscribe text-inkCharcoal',
    body: 'text-inkSoft',
    action: { background: 'var(--bronze-primary)', color: 'var(--marble-base)' },
    quiet: 'text-inkSoft',
    ring: 'focus-visible:ring-bronzeDeep',
    hairline: 'rgba(168,118,62,0.4)',
  },
}

export interface EmptyAction {
  label: string
  to?: string
  onClick?: () => void
}

interface ModuleEmptyStateProps {
  tone: EmptyTone
  icon?: ReactNode
  title: string
  body: string
  /** The one thing to do next. Rendered filled, and always present in practice. */
  action?: EmptyAction
  /** A second, quieter way on — "or start from scratch", "show me how". */
  secondary?: EmptyAction
  /**
   * Numbered steps, for the two modules where the next action is not one action
   * but a chain. Virtus is unusable until three things exist in order, and saying
   * so on the empty screen is the difference between a setup task and a dead end.
   */
  steps?: ReactNode[]
}

export default function ModuleEmptyState({
  tone,
  icon,
  title,
  body,
  action,
  secondary,
  steps,
}: ModuleEmptyStateProps) {
  const t = TONES[tone]

  const button = (entry: EmptyAction, filled: boolean) => {
    const className = filled
      ? `flex min-h-[48px] w-full items-center justify-center rounded-card text-[14px] font-semibold transition-transform active:scale-[0.98] focus:outline-none focus-visible:ring-2 ${t.ring}`
      : `flex min-h-[44px] w-full items-center justify-center rounded-card text-[13px] ${t.quiet} focus:outline-none focus-visible:ring-2 ${t.ring}`
    const style = filled ? t.action : undefined

    return entry.to ? (
      <Link to={entry.to} className={className} style={style}>
        {entry.label}
      </Link>
    ) : (
      <button type="button" onClick={entry.onClick} className={className} style={style}>
        {entry.label}
      </button>
    )
  }

  return (
    <div
      className={`${t.surface} rounded-card px-5 py-7 text-center`}
      // The hairline along the top edge is the one thing every empty state in
      // Meridian has in common, whatever palette it is wearing — the same signal
      // the launcher's summary cards carry.
      style={{ boxShadow: `inset 0 1px 0 ${t.hairline}` }}
    >
      {icon && (
        <span className={`${t.well} mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full`}>
          {icon}
        </span>
      )}

      <h2 className={`${t.title} text-[17px] font-semibold leading-snug`}>{title}</h2>
      <p className={`mx-auto mt-2 max-w-[34ch] text-[13px] leading-relaxed ${t.body}`}>{body}</p>

      {steps && steps.length > 0 && (
        <ol className="mx-auto mt-5 max-w-[32ch] space-y-2.5 text-left">
          {steps.map((step, i) => (
            <li key={i} className={`flex items-baseline gap-3 text-[13px] leading-relaxed ${t.body}`}>
              <span
                className="flex h-[19px] w-[19px] flex-shrink-0 items-center justify-center rounded-full text-[10px] font-semibold tabular-nums"
                style={t.action}
              >
                {i + 1}
              </span>
              <span className="min-w-0 flex-1">{step}</span>
            </li>
          ))}
        </ol>
      )}

      {(action || secondary) && (
        <div className="mt-6 space-y-2">
          {action && button(action, true)}
          {secondary && button(secondary, false)}
        </div>
      )}
    </div>
  )
}
