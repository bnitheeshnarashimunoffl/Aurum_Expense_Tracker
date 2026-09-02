interface LaurelIconProps {
  size?: number
}

const CENTRE = 20
const BOUGH_RADIUS = 12
/** Where each bough starts and stops, in degrees: 90° is the bottom of the circle. */
const START_ANGLE = 100
const END_ANGLE = 246
const LEAF_COUNT = 6

const rad = (deg: number) => (deg * Math.PI) / 180

/** A point on the bough circle, optionally pushed outward to sit a leaf on it. */
function at(angle: number, radius = BOUGH_RADIUS) {
  return { x: CENTRE + radius * Math.cos(rad(angle)), y: CENTRE + radius * Math.sin(rad(angle)) }
}

/**
 * Virtus's mark: a laurel wreath. Two boughs sweep up from a tie at the bottom and
 * stop short of meeting, leaving the wreath open at the top.
 *
 * Built from the geometry rather than hand-placed, because the two halves have to
 * be exact mirrors — an earlier hand-placed version drifted and read as a pair of
 * loose hooks rather than a wreath.
 *
 * Chosen over a column glyph because the ring silhouette survives the 30px launcher
 * tile far better than a tall thin rectangle, and stays clearly apart from the other
 * four marks at that size: Kindle's flame, Vigil's hourglass and Loom's braid are
 * all vertical forms, where this one is round.
 */
export default function LaurelIcon({ size = 30 }: LaurelIconProps) {
  const angles = Array.from(
    { length: LEAF_COUNT },
    (_, i) => START_ANGLE + ((END_ANGLE - START_ANGLE) * i) / (LEAF_COUNT - 1)
  )

  // The bough itself, sampled finely enough to read as a smooth arc at 30px.
  const stem = Array.from({ length: 24 }, (_, i) => {
    const a = START_ANGLE + ((END_ANGLE - START_ANGLE) * i) / 23
    const { x, y } = at(a)
    return `${i === 0 ? 'M' : 'L'}${x.toFixed(2)} ${y.toFixed(2)}`
  }).join(' ')

  function bough(mirror: boolean) {
    const flip = (x: number) => (mirror ? 2 * CENTRE - x : x)
    return (
      <g key={String(mirror)}>
        <path
          d={stem}
          transform={mirror ? `translate(${2 * CENTRE},0) scale(-1,1)` : undefined}
          stroke="url(#virtus-laurel)"
          strokeWidth="1.7"
          strokeLinecap="round"
          fill="none"
        />
        {angles.map((a, i) => {
          const { x, y } = at(a, BOUGH_RADIUS + 3.1)
          // Long axis along the bough, canted so the leaves sweep towards the opening.
          const rotation = a + 90 - 20
          return (
            <ellipse
              key={a}
              cx={flip(x)}
              cy={y}
              rx="3.6"
              ry="1.85"
              fill="url(#virtus-laurel)"
              opacity={0.55 + i * 0.075}
              transform={`rotate(${mirror ? 180 - rotation : rotation} ${flip(x)} ${y})`}
            />
          )
        })}
      </g>
    )
  }

  return (
    <svg width={size} height={size} viewBox="0 0 40 40" fill="none" aria-hidden>
      <defs>
        <linearGradient id="virtus-laurel" x1="0" y1="6" x2="0" y2="34" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="var(--bronze-primary)" />
          <stop offset="1" stopColor="var(--bronze-deep)" />
        </linearGradient>
      </defs>

      {bough(false)}
      {bough(true)}

      {/* The tie where the two boughs meet. */}
      <circle cx={CENTRE} cy="33.2" r="2" fill="var(--ember-red)" />
    </svg>
  )
}
