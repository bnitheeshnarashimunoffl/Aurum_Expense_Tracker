import { forwardRef, type ReactNode } from 'react'
import { Link } from 'react-router-dom'

/**
 * The chassis every dashboard card is built on.
 *
 * The brief's hard part is that the four cards have to read as one family with
 * four personalities — not four fully-themed widgets (chaotic), not four
 * identical grey boxes (lifeless). The split is drawn here rather than left to
 * each card:
 *
 *   SHARED, and identical on all four — the charcoal ground, the neumorphic
 *   shadow pair, the corner radius, the gold hairline along the top edge, the
 *   layout, and the type scale.
 *
 *   PER-MODULE, and never anything else — the small-caps label colour, the
 *   horizon that glows along the bottom edge, and whatever the card's own body
 *   renders. That horizon is the launcher's own motif (see Horizon.tsx) reused
 *   at card scale, which is why a module's colour can be this present without
 *   the card stopping looking like Meridian.
 */

export interface SummaryCardProps {
  to: string
  /** Small-caps module name, top left. */
  label: string
  /** This module's own accent — the label, the horizon, and the chevron take it. */
  accent: string
  /** The same accent at low alpha, for the horizon's glow. Kept explicit so each card can tune it. */
  glow: string
  children: ReactNode
  /**
   * Aurum's card is swipeable, and a swipe that ends on the card must not also
   * navigate. Returning true from here cancels the tap.
   */
  shouldBlockNavigation?: () => boolean
}

const SummaryCard = forwardRef<HTMLAnchorElement, SummaryCardProps>(function SummaryCard(
  { to, label, accent, glow, children, shouldBlockNavigation },
  ref
) {
  return (
    <Link
      ref={ref}
      to={to}
      onClick={(event) => {
        if (shouldBlockNavigation?.()) event.preventDefault()
      }}
      aria-label={`Open ${label}`}
      className="mer-card relative block overflow-hidden rounded-card px-4 py-3.5 transition-transform active:scale-[0.985] focus:outline-none focus-visible:ring-1 focus-visible:ring-accent"
    >
      {/* The horizon: a hairline in the module's colour with the sky glowing above
          it, fading out to the right exactly the way the launcher's does. */}
      <span
        aria-hidden
        className="pointer-events-none absolute inset-x-0 bottom-0 h-9"
        style={{ background: `linear-gradient(180deg, transparent, ${glow})` }}
      />
      <span
        aria-hidden
        className="pointer-events-none absolute inset-x-0 bottom-0 h-px"
        style={{ background: `linear-gradient(90deg, ${accent}, transparent 82%)` }}
      />

      <div className="relative">
        <div className="mb-2 flex items-center justify-between">
          <span className="text-[10px] font-semibold uppercase tracking-[0.22em]" style={{ color: accent }}>
            {label}
          </span>
          {/* A quiet affordance rather than a button: the whole card is the target. */}
          <svg width="7" height="11" viewBox="0 0 7 11" fill="none" aria-hidden className="opacity-50">
            <path d="M1.2 1.2 L5.4 5.5 L1.2 9.8" stroke={accent} strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
        {children}
      </div>
    </Link>
  )
})

export default SummaryCard

/** The caption line under a card's headline value. One rule for all four. */
export function CardCaption({ children, color }: { children: ReactNode; color?: string }) {
  return (
    <p className="mt-0.5 text-[11.5px] leading-snug" style={{ color: color ?? 'var(--text-muted)' }}>
      {children}
    </p>
  )
}

/** The shared skeleton, so four loading cards never disagree about what loading looks like. */
export function CardSkeleton({ lines = 2 }: { lines?: number }) {
  return (
    <div className="space-y-2 py-0.5">
      <span className="skeleton block h-6 w-32 rounded-md" />
      {lines > 1 && <span className="skeleton block h-3 w-40 rounded-md" />}
    </div>
  )
}
