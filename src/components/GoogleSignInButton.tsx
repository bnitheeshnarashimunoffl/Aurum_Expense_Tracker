/**
 * "Continue with Google", built out of Meridian's own material.
 *
 * The logo is the one thing here that is NOT adapted. Google's branding terms
 * allow the button's shape, size, surface and type to be restyled to fit the host
 * app — which is the whole reason this is a `neu-raised` card and not the stock
 * white pill that would land on Meridian's dark ground like a sticker — but the G
 * itself must be reproduced exactly: official four-colour paths, unrecoloured,
 * unrotated, uncropped, with clear space around it of at least half its height
 * (the 12px gap and the button's 20px padding both clear an 18px mark).
 *
 * The full-colour mark sits directly on the dark surface rather than on a white
 * tile, which is what Google's own dark-theme button does.
 */

/** The official Google "G". Do not edit these paths or their fills. */
function GoogleMark({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden focusable="false">
      <path
        fill="#EA4335"
        d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
      />
      <path
        fill="#4285F4"
        d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
      />
      <path
        fill="#FBBC05"
        d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
      />
      <path
        fill="#34A853"
        d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
      />
    </svg>
  )
}

/**
 * The rule between the form and the alternative. A hairline that fades out from
 * the centre in both directions, which is the same gradient the launcher's band
 * divider and every Settings section heading already use — so this reads as
 * Meridian's rule with a word in it, not as a generic OAuth separator.
 */
export function OrDivider() {
  const fade = (direction: string) =>
    `linear-gradient(${direction}, transparent, var(--accent) 90%)`
  return (
    <div className="my-6 flex items-center gap-3" aria-hidden>
      <span className="h-px flex-1" style={{ background: fade('90deg'), opacity: 0.32 }} />
      <span className="text-[10.5px] font-medium uppercase tracking-[0.22em] text-muted">or</span>
      <span className="h-px flex-1" style={{ background: fade('270deg'), opacity: 0.32 }} />
    </div>
  )
}

interface GoogleSignInButtonProps {
  onClick: () => void
  /** True while the hand-off is in flight — the tab is about to be replaced. */
  busy?: boolean
  disabled?: boolean
  /** "Continue with Google" reads correctly on both screens; overridable anyway. */
  label?: string
}

export default function GoogleSignInButton({
  onClick,
  busy = false,
  disabled = false,
  label = 'Continue with Google',
}: GoogleSignInButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={busy || disabled}
      className="neu-raised flex min-h-[48px] w-full items-center justify-center gap-3 rounded-card px-5 text-[14px] font-medium text-primary transition-transform active:scale-[0.98] disabled:opacity-60 focus:outline-none focus-visible:ring-1 focus-visible:ring-accent"
    >
      <GoogleMark />
      <span>{busy ? 'Taking you to Google…' : label}</span>
    </button>
  )
}
