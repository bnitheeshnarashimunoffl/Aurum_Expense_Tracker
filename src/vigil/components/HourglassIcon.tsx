import { useId } from 'react'

/**
 * Vigil's mark: a geometric hourglass, faceted the same way Kindle's ember is —
 * straight edges, no outline, a vertical gold gradient. Sized and weighted to sit
 * beside <FlameIcon> and the Aurum disc on the launcher without looking borrowed.
 * The sand already fallen is the deeper bronze, so the glass reads as mid-run.
 */
export default function HourglassIcon({ size = 28 }: { size?: number }) {
  const gradientId = useId()

  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
      <defs>
        <linearGradient id={gradientId} x1="0.5" y1="0" x2="0.5" y2="1">
          <stop offset="0%" stopColor="#E8CE9A" />
          <stop offset="42%" stopColor="#C9A46A" />
          <stop offset="72%" stopColor="#BC8A3F" />
          <stop offset="100%" stopColor="#7A5A28" />
        </linearGradient>
      </defs>
      {/* Frame: two plates joined by the pinched glass. */}
      <path d="M5 2.4h14v1.9H5zM5 19.7h14v1.9H5z" fill={`url(#${gradientId})`} />
      <path
        d="M6.7 4.3h10.6L12 11.1 6.7 4.3ZM12 12.9l5.3 6.8H6.7L12 12.9Z"
        fill={`url(#${gradientId})`}
      />
      {/* The sand that has already run through, settled in the lower bulb. */}
      <path d="M8.9 17.9h6.2L12 14.1l-3.1 3.8Z" fill="#7A5A28" opacity="0.55" />
    </svg>
  )
}
