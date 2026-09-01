/**
 * The persistent gold horizon line fixed at the bottom of the Meridian launcher.
 * Also the visual target the sun in <SunExitButton> "sets" behind on module exit.
 */
export default function Horizon() {
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-0 h-40 pb-safe-bottom" aria-hidden>
      <div
        className="absolute inset-x-0 bottom-[4.5rem] h-px"
        style={{ background: 'linear-gradient(90deg, transparent, var(--accent) 20%, var(--accent) 80%, transparent)' }}
      />
      <div
        className="absolute inset-x-0 bottom-0 h-[4.5rem]"
        style={{ background: 'linear-gradient(180deg, rgba(201,164,106,0.08), transparent)' }}
      />
    </div>
  )
}
