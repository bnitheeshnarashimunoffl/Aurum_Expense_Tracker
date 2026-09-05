import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import SunExitButton from '@/components/SunExitButton'
import { useAuth } from '@/context/AuthContext'
import { ExternalLink } from '@/setup/SetupChrome'

/**
 * Meridian's privacy policy, at /privacy.
 *
 * PUBLIC — mounted outside RequireAuth on purpose, and it has to stay that way.
 * Google's OAuth consent screen requires a privacy policy URL it can reach
 * without an account, and a policy explaining what happens to your data that is
 * only readable once you have handed over your data is not a policy, it is a
 * receipt.
 *
 * Which means this screen renders in two situations that look nothing alike: a
 * signed-in user arriving from Settings, and a stranger (or a Google reviewer)
 * landing on the URL cold. The only concession made for that is the way out — the
 * sun sets back to a launcher a logged-out visitor cannot reach, so they get a
 * link to sign in instead.
 *
 * The content is the architecture, not boilerplate. Meridian genuinely cannot
 * read module data, and the reason is structural (src/lib/dataClient.ts), so this
 * says so plainly rather than hedging it into meaninglessness.
 */

const INSTAGRAM_URL = 'https://www.instagram.com/_.nxthx.xsh._/'

/** Set by hand. Bump it when the wording below actually changes. */
const LAST_UPDATED = '5 September 2026'

/* -------------------------------------------------------------------------- */

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mt-8">
      <div className="mb-3 flex items-baseline gap-3">
        <h2 className="font-display text-[15px] font-semibold text-primary">{title}</h2>
        <span
          className="h-px flex-1"
          style={{ background: 'linear-gradient(90deg, var(--accent), transparent 85%)', opacity: 0.4 }}
        />
      </div>
      {children}
    </section>
  )
}

function P({ children }: { children: ReactNode }) {
  return <p className="mt-2.5 text-[13px] leading-relaxed text-muted first:mt-0">{children}</p>
}

/** A raised card, for the sections built out of several distinct statements. */
function Card({ children }: { children: ReactNode }) {
  return <div className="neu-raised rounded-card px-4 py-4">{children}</div>
}

function Lede({ children }: { children: ReactNode }) {
  return <h3 className="text-[13.5px] font-semibold text-primary">{children}</h3>
}

/**
 * A list whose markers are gold hairline dashes rather than bullet glyphs — the
 * same rule that divides every section, shrunk to eight pixels.
 */
function Points({ items }: { items: ReactNode[] }) {
  return (
    <ul className="mt-3 space-y-2.5">
      {items.map((item, i) => (
        <li key={i} className="flex items-baseline gap-3">
          <span
            className="mt-[7px] h-px w-2 flex-shrink-0"
            style={{ background: 'var(--accent)', opacity: 0.75 }}
            aria-hidden
          />
          <span className="min-w-0 flex-1 text-[13px] leading-relaxed text-muted">{item}</span>
        </li>
      ))}
    </ul>
  )
}

/** Emphasis inside body copy, matching how the setup flow marks the words that matter. */
function Em({ children }: { children: ReactNode }) {
  return <span className="font-medium text-primary">{children}</span>
}

/* -------------------------------------------------------------------------- */

export default function Privacy() {
  const { session } = useAuth()

  return (
    <div className="mx-auto min-h-full max-w-lg px-5 pb-16 pt-safe-top">
      {/* Only for someone who has a launcher to be returned to. */}
      {session && <SunExitButton />}

      <header className={`pb-2 pt-8 ${session ? 'pr-14' : ''}`}>
        <p className="font-display text-[11px] font-semibold tracking-[0.3em] text-muted">MERIDIAN</p>
        <h1 className="font-display mt-1 text-2xl font-bold text-primary">Privacy policy</h1>
        <p className="mt-2 text-[11.5px] text-muted opacity-80">Last updated {LAST_UPDATED}</p>
      </header>

      <p className="mt-4 text-[13px] leading-relaxed text-muted">
        Meridian is a personal “day OS” application. This page explains what data Meridian collects and how it is
        handled.
      </p>

      {/* ---- The short version, given the weight it deserves ---------------- */}
      <div
        className="neu-raised mt-6 rounded-card px-5 py-5"
        // The gold hairline the dashboard cards and the Settings notification
        // panel already carry. This is the part most people will read and then
        // stop, so it is the part that has to look like the answer.
        style={{
          boxShadow:
            '8px 8px 16px rgba(0,0,0,0.55), -6px -6px 14px rgba(255,255,255,0.03), inset 0 1px 0 rgba(201,164,106,0.28)',
        }}
      >
        <h2 className="font-display text-[15px] font-semibold text-primary">The short version</h2>
        <p className="mt-1.5 text-[13px] leading-relaxed text-muted">
          Meridian uses two separate places to store information.
        </p>

        <ol className="mt-4 space-y-3.5">
          {[
            <>
              <Em>Your login</Em> — email and password, or your Google account — is stored with Meridian’s
              authentication provider (Supabase), so you can sign in and so the app knows who you are.
            </>,
            <>
              <Em>Everything else you enter into Meridian</Em> — your habits, expenses, study sessions, timetable,
              workouts, notes, voice memos and to-dos — is stored in a separate database that{' '}
              <Em>you set up and control yourself</Em>. Meridian’s developer has no access to this data.
            </>,
          ].map((item, i) => (
            <li key={i} className="flex items-baseline gap-3 text-[13px] leading-relaxed text-muted">
              <span
                className="flex h-[19px] w-[19px] flex-shrink-0 items-center justify-center rounded-full text-[10px] font-semibold tabular-nums text-ink"
                style={{ background: 'var(--accent)' }}
              >
                {i + 1}
              </span>
              <span className="min-w-0 flex-1">{item}</span>
            </li>
          ))}
        </ol>
      </div>

      {/* ---- What we collect ------------------------------------------------ */}
      <Section title="What we collect">
        <div className="space-y-2.5">
          <Card>
            <Lede>Account information</Lede>
            <Points
              items={[
                <>Your email address, used to sign in and identify your account.</>,
                <>
                  If you sign in with Google, the basic profile information Google shares with us: your email address
                  and name.
                </>,
              ]}
            />
            <P>
              We do not collect payment information, phone numbers, or any other personal details beyond what is
              needed to authenticate you.
            </P>
          </Card>

          <Card>
            <Lede>App data — habits, expenses, notes, everything else</Lede>
            <P>
              This information is stored entirely in a database project that you create and control, on Supabase’s
              free tier. Meridian’s developer cannot access, read or export it: it lives under your own account with
              your own database provider, protected by that provider’s access controls.
            </P>
            <P>
              The credentials connecting your device to your database are stored <Em>only on your own device</Em>, in
              your browser’s local storage, and are never sent to or stored by Meridian’s developer.
            </P>
          </Card>

          <Card>
            <Lede>Voice memo transcription</Lede>
            <P>
              If you use Chronicle’s voice memo feature, your recorded audio is sent to a third-party transcription
              service — Groq, running OpenAI’s Whisper model — to convert speech to text. Audio is processed for that
              purpose only, and is not retained by Meridian’s developer.
            </P>
          </Card>

          <Card>
            <Lede>Push notifications</Lede>
            <P>
              If you enable notifications, your device’s push subscription details are stored so reminders can be sent
              to you. You can turn this off at any time in Settings.
            </P>
          </Card>
        </div>
      </Section>

      {/* ---- What we don't do ----------------------------------------------- */}
      <Section title="What we don’t do">
        <Card>
          <Points
            items={[
              <>We do not sell or share your data with third parties for advertising or marketing purposes.</>,
              <>We do not track you across other websites or apps.</>,
              <>
                We do not access your personal app data — habits, notes, expenses and the rest. Given the architecture
                described above, it is not technically accessible to us.
              </>,
            ]}
          />
        </Card>
      </Section>

      {/* ---- Your control ---------------------------------------------------- */}
      <Section title="Your control over your data">
        <Card>
          <Points
            items={[
              <>You can delete your account at any time, which removes your login information.</>,
              <>
                Your app data lives in your own database. You can export, modify or delete it at any time from your
                own Supabase dashboard, independently of Meridian.
              </>,
              <>
                You can change which database Meridian connects to, or disconnect entirely, from Meridian’s Settings.
              </>,
            ]}
          />
        </Card>
      </Section>

      {/* ---- Third parties --------------------------------------------------- */}
      <Section title="Third-party services used">
        <Card>
          <dl className="space-y-3">
            {(
              [
                ['Supabase', 'Authentication, and — in your own separate project — your app data storage.'],
                ['Groq', 'Voice memo transcription. Chronicle only, and only if you use it.'],
                ['Vercel', 'Hosting, and anonymised web analytics (page views, not personal data).'],
                ['Google', 'An optional sign-in method, if you choose to use it.'],
              ] as const
            ).map(([name, detail]) => (
              <div key={name}>
                <dt className="text-[13px] font-medium text-accent">{name}</dt>
                <dd className="mt-0.5 text-[12.5px] leading-relaxed text-muted">{detail}</dd>
              </div>
            ))}
          </dl>
        </Card>
      </Section>

      {/* ---- Changes --------------------------------------------------------- */}
      <Section title="Changes to this policy">
        <P>If this policy changes, the “Last updated” date at the top of this page will be updated to match.</P>
      </Section>

      {/* ---- Contact --------------------------------------------------------- */}
      <Section title="Contact">
        <P>
          Questions about this policy, or about how your data is handled? Reach out on{' '}
          <ExternalLink href={INSTAGRAM_URL}>Instagram</ExternalLink>.
        </P>
      </Section>

      {/* The way out for a visitor with no launcher behind them. The sun in the
          corner is the exit everywhere else in Meridian, but it sets back to a
          screen this person cannot open. */}
      {!session && (
        <div className="mt-10 flex flex-col items-center gap-3">
          <span
            className="h-px w-10"
            aria-hidden
            style={{ background: 'linear-gradient(90deg, transparent, var(--accent), transparent)', opacity: 0.5 }}
          />
          <Link
            to="/login"
            className="min-h-[44px] px-3 py-2.5 text-[13px] text-muted transition-colors hover:text-accent focus:outline-none focus-visible:ring-1 focus-visible:ring-accent"
          >
            Back to sign in
          </Link>
        </div>
      )}
    </div>
  )
}
