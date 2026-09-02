interface QuillIconProps {
  size?: number
}

/**
 * Chronicle's mark: a quill held at the angle you would actually write with.
 *
 * Built from one shaft line so the two halves cannot drift: the vane is a single
 * quadratic bulging off that line, and the nib is a triangle continuing along it
 * past the end. Hand-placing these is how Virtus's laurel first came out looking
 * like two loose hooks.
 *
 * The nib is the only gold in it. At 30px on the launcher the plume reduces to a
 * pale diagonal blade and the eye lands on that bright point — which is what keeps
 * it apart from Kindle's flame, Vigil's hourglass, Loom's braid and Virtus's
 * laurel: those are all upright or round, and this one is a diagonal with a spark
 * at the bottom-left.
 */
export default function QuillIcon({ size = 30 }: QuillIconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" fill="none" aria-hidden>
      <defs>
        <linearGradient id="chronicle-vane" x1="29" y1="10" x2="13" y2="27" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="var(--ivory)" />
          <stop offset="1" stopColor="var(--ivory-dim)" />
        </linearGradient>
      </defs>

      {/* The plume, bulging up-left off the shaft. */}
      <path d="M29 10 Q7.9 6.2 13 27 Z" fill="url(#chronicle-vane)" opacity="0.92" />

      {/* Barbs — texture at large sizes, invisible at 30px, which is the intent. */}
      <g stroke="var(--ink-charcoal-bg)" strokeWidth="0.9" strokeLinecap="round" opacity="0.35">
        <path d="M24.4 12.6 L18.6 11.4" />
        <path d="M20.6 16.7 L14.6 15.2" />
        <path d="M17 20.6 L11.8 20" />
      </g>

      {/* Shaft, drawn over the plume so the quill reads as one object. */}
      <path d="M29 10 L13 27" stroke="var(--ivory)" strokeWidth="1.6" strokeLinecap="round" />

      {/* Nib: the shaft continued past its end and tapered to a point. */}
      <path d="M11.54 25.63 L8.9 31.4 L14.46 28.37 Z" fill="var(--gold-primary)" />
    </svg>
  )
}
