import { useId } from 'react'

/**
 * Loom's mark: three strands interwoven into a helix-like braid, drawn as
 * geometric arcs rather than freehand curves so it sits beside Aurum's disc,
 * Kindle's faceted ember and Vigil's hourglass at the same weight. Two strands
 * carry the gold gradient, the third the burgundy, so the weave reads even at
 * launcher-tile size.
 */
export default function LoomIcon({ size = 28 }: { size?: number }) {
  const gradientId = useId()

  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
      <defs>
        <linearGradient id={gradientId} x1="0.5" y1="0" x2="0.5" y2="1">
          <stop offset="0%" stopColor="#E8CE9A" />
          <stop offset="50%" stopColor="#C9A46A" />
          <stop offset="100%" stopColor="#9C7A44" />
        </linearGradient>
      </defs>
      {/* Left and right strands cross repeatedly; the centre strand runs straight
          through the crossings, which is what makes it read as woven. */}
      <path
        d="M7 2 C 7 6, 17 6, 17 10 C 17 14, 7 14, 7 18 C 7 20.4, 9 21.4, 12 22"
        stroke={`url(#${gradientId})`}
        strokeWidth="2"
        strokeLinecap="round"
      />
      <path
        d="M17 2 C 17 6, 7 6, 7 10 C 7 14, 17 14, 17 18 C 17 20.4, 15 21.4, 12 22"
        stroke={`url(#${gradientId})`}
        strokeWidth="2"
        strokeLinecap="round"
      />
      <path d="M12 2 V 22" stroke="#A4405C" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  )
}
