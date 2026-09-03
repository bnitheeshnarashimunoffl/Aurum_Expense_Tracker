interface HorizonProps {
  /**
   * `fixed` pins it to the bottom of the viewport — the original launcher, where
   * the screen never scrolled. `inline` places it in the flow instead, which is
   * what the dashboard needs now that summary cards can scroll past: a fixed gold
   * rule drawn across the middle of a card reads as a rendering fault, not as a
   * horizon.
   */
  variant?: 'fixed' | 'inline'
}

/**
 * The gold horizon line that closes the Meridian launcher, and the visual target
 * the sun in <SunExitButton> "sets" behind on module exit.
 */
export default function Horizon({ variant = 'fixed' }: HorizonProps) {
  const line = (
    <div
      className="absolute inset-x-0 h-px"
      style={{
        bottom: variant === 'fixed' ? '4.5rem' : '3rem',
        background: 'linear-gradient(90deg, transparent, var(--accent) 20%, var(--accent) 80%, transparent)',
      }}
    />
  )
  const glow = (
    <div
      className="absolute inset-x-0 bottom-0"
      style={{
        height: variant === 'fixed' ? '4.5rem' : '3rem',
        background: 'linear-gradient(180deg, rgba(201,164,106,0.08), transparent)',
      }}
    />
  )

  if (variant === 'inline') {
    return (
      <div className="pointer-events-none relative mt-10 h-24" aria-hidden>
        {line}
        {glow}
      </div>
    )
  }

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-0 h-40 pb-safe-bottom" aria-hidden>
      {line}
      {glow}
    </div>
  )
}
