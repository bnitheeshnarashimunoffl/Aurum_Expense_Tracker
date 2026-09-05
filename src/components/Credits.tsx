import { Link } from 'react-router-dom'

const INSTAGRAM_URL = 'https://www.instagram.com/_.nxthx.xsh._/'

interface CreditsProps {
  /**
   * Draws the short gold hairline above the signature — a miniature of the
   * launcher's horizon, closing the page the same way the horizon does.
   *
   * Off on the launcher itself, where the real <Horizon> is already sitting
   * directly above this and a second rule eight pixels under it reads as a
   * mistake rather than as a mark.
   */
  mark?: boolean
  /**
   * Adds the contact line under the signature. Settings only: the launcher is
   * the most-seen screen in the platform and has no business asking anyone for
   * anything, whereas Settings is already where you go when something is wrong.
   */
  contact?: boolean
  /**
   * Adds the privacy policy link. Settings only, for the same reason as the
   * contact line: /privacy is public and Google's consent screen links straight
   * to it, so this is for the person already inside the app who wants to find it
   * without leaving.
   */
  privacy?: boolean
}

/**
 * The signature that closes the Meridian launcher and the Settings screen.
 *
 * Deliberately not a footer. There is no bar, no background, no rule under it —
 * just tracked 10.5px type centred in the space the page was already leaving
 * empty at the bottom, so it reads as the last quiet line of the design rather
 * than as a strip bolted beneath it.
 *
 * Quiet is done with size and colour, never with opacity: --text-muted at 10.5px
 * measures 6.6:1 on --bg-base and the accent 8.3:1, both comfortably past AA.
 * Fading either one to 55% to make it "subtle" would have taken them to roughly
 * 2.6:1, which is not restraint, it is an accessibility bug wearing restraint's
 * clothes.
 */
export default function Credits({ mark = true, contact = false, privacy = false }: CreditsProps) {
  return (
    // Without the mark this is sitting directly under the launcher's horizon,
    // whose own block already leaves 48px of fading glow below the line; a
    // second 40px on top of that would strand the signature halfway down a
    // blank screen.
    <footer className={`${mark ? 'mt-10' : 'mt-2'} flex flex-col items-center gap-3 pb-2 text-center`}>
      {mark && (
        <span
          className="h-px w-10"
          aria-hidden
          style={{
            background: 'linear-gradient(90deg, transparent, var(--accent), transparent)',
            opacity: 0.5,
          }}
        />
      )}

      <p className="font-display text-[10.5px] tracking-[0.14em] text-muted">
        Designed and Developed by <span className="font-medium text-accent">Nitheesh</span>
      </p>

      {contact && (
        <p className="max-w-[19rem] text-[11.5px] leading-relaxed text-muted">
          Questions, suggestions, or found a bug? Reach out on{' '}
          <a
            href={INSTAGRAM_URL}
            target="_blank"
            rel="noopener noreferrer"
            // -my-1/py-1 buys a little vertical tap area without moving the line
            // off its own baseline, which a block-level pill here would.
            className="-my-1 inline-block py-1 font-medium text-accent underline decoration-accent underline-offset-[3px] focus:outline-none focus-visible:ring-1 focus-visible:ring-accent"
          >
            Instagram
          </a>
          .
        </p>
      )}

      {privacy && (
        <Link
          to="/privacy"
          className="-my-1 py-1 text-[11.5px] text-muted underline decoration-muted underline-offset-[3px] transition-colors hover:text-accent focus:outline-none focus-visible:ring-1 focus-visible:ring-accent"
        >
          Privacy policy
        </Link>
      )}
    </footer>
  )
}
