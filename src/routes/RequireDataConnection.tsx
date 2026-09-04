import { useCallback, useEffect, useState } from 'react'
import { Link, Navigate, Outlet } from 'react-router-dom'
import LoadingRing from '@/components/LoadingRing'
import { useDataConnection } from '@/context/DataContext'
import { readStoredConnection } from '@/lib/dataConnection'
import { dashboardUrl, probeProject, type ProjectHealth } from '@/lib/projectHealth'
import { ClickPath, ExternalLink, SetupFrame, Ui } from '@/setup/SetupChrome'

/**
 * Stands between a signed-in account and the six modules, and answers one
 * question: is there a database to read from?
 *
 * Three outcomes. Not set up yet goes to the walkthrough. Connected passes
 * through. Set up but unreachable gets the panel below — which now DOES try to
 * work out why, for exactly one cause.
 *
 * That is a deliberate exception to the rule everywhere else in Meridian, which
 * is to refuse to guess at connection errors. Supabase suspends a free project
 * after about a week without traffic. That is not an edge case: it is what
 * happens to almost everyone who tries an app and does not open it daily. The
 * user has done nothing wrong, nothing is lost, and the fix is one button in
 * their own dashboard. A screen that says only "could not connect" turns a
 * thirty-second fix into an app that looks broken.
 *
 * See src/lib/projectHealth.ts for how confident the detection can be, and why
 * this screen says "paused" outright in one case and "most likely paused" in the
 * other.
 */
export default function RequireDataConnection() {
  const { status, projectRef, failure, reconnect } = useDataConnection()
  const [retrying, setRetrying] = useState(false)
  const [health, setHealth] = useState<ProjectHealth | 'checking'>('checking')

  const runProbe = useCallback(async () => {
    const stored = readStoredConnection()
    if (!stored) {
      setHealth('unreachable')
      return
    }
    setHealth(await probeProject(stored.url, stored.anonKey))
  }, [])

  useEffect(() => {
    // Only worth asking when the project failed to answer at all. A project that
    // answered and then refused us has a different problem, and probing it would
    // just be a slower way of saying so.
    if (status !== 'error') return
    if (failure === 'schema' || failure === 'auth' || failure === 'invalid') {
      setHealth('reachable')
      return
    }
    setHealth('checking')
    void runProbe()
  }, [status, failure, runProbe])

  if (status === 'unconfigured') return <Navigate to="/setup" replace />

  if (status === 'idle' || status === 'connecting') {
    return (
      <div className="flex h-full items-center justify-center">
        <LoadingRing label="Opening your database" />
      </div>
    )
  }

  if (status === 'error') {
    return (
      <ConnectionTrouble
        health={health}
        failure={failure}
        projectRef={projectRef}
        retrying={retrying}
        onRetry={() => {
          setRetrying(true)
          setHealth('checking')
          void reconnect().finally(() => {
            setRetrying(false)
            void runProbe()
          })
        }}
      />
    )
  }

  return <Outlet />
}

/* -------------------------------------------------------------------------- */

function WarningGlyph({ tone }: { tone: string }) {
  return (
    <span className="neu-pressed mb-4 flex h-11 w-11 items-center justify-center rounded-full">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={tone} strokeWidth="1.8" strokeLinecap="round" aria-hidden>
        <circle cx="12" cy="12" r="9" opacity="0.5" />
        <path d="M9.5 9.5v5M14.5 9.5v5" />
      </svg>
    </span>
  )
}

interface TroubleProps {
  health: ProjectHealth | 'checking'
  failure: 'schema' | 'auth' | 'network' | 'invalid' | null
  projectRef: string
  retrying: boolean
  onRetry: () => void
}

function ConnectionTrouble({ health, failure, projectRef, retrying, onRetry }: TroubleProps) {
  if (health === 'checking') {
    return (
      <div className="flex h-full items-center justify-center">
        <LoadingRing label="Checking your project" />
      </div>
    )
  }

  const paused = health === 'paused' || health === 'unreachable'

  /* ---- Offline. Their project is probably fine; their signal is not. ---- */
  if (health === 'offline') {
    return (
      <SetupFrame eyebrow="MERIDIAN">
        <Panel accent="rgba(201,164,106,0.35)">
          <WarningGlyph tone="var(--accent)" />
          <h1 className="font-display text-[19px] font-bold leading-snug text-primary">You’re offline</h1>
          <p className="mt-2 text-[13.5px] leading-relaxed text-muted">
            Meridian can’t reach anything from here. Nothing is lost — everything is still in your database waiting.
          </p>
          <Actions retrying={retrying} onRetry={onRetry} />
        </Panel>
      </SetupFrame>
    )
  }

  /* ---- The project answered, but would not let us in. ---- */
  if (!paused) {
    const schema = failure === 'schema'
    return (
      <SetupFrame eyebrow="MERIDIAN">
        <Panel accent="rgba(201,124,93,0.35)">
          <WarningGlyph tone="var(--expense)" />
          <h1 className="font-display text-[19px] font-bold leading-snug text-primary">
            {schema ? 'Your project has no tables yet' : 'Meridian can’t sign in to your project'}
          </h1>
          <p className="mt-2 text-[13.5px] leading-relaxed text-muted">
            {schema
              ? 'Your Supabase project is up and answering, but the setup script has not finished running in it. Running it again is safe — it only ever creates things.'
              : 'Your project is up and answering, but it turned Meridian away. The usual cause is the “Confirm email” switch, which has to be off for the sign-in Meridian makes on your behalf.'}
          </p>
          <p className="mt-3 text-[12.5px] leading-relaxed text-muted">
            Troubleshooting has the exact steps for both.
          </p>
          <Actions retrying={retrying} onRetry={onRetry} />
        </Panel>
      </SetupFrame>
    )
  }

  /* ---- Paused, certainly or most likely. The common case. ---- */
  const certain = health === 'paused'
  return (
    <SetupFrame eyebrow="MERIDIAN">
      <Panel accent="rgba(201,164,106,0.35)">
        <span className="neu-pressed mb-4 flex h-11 w-11 items-center justify-center rounded-full">
          <svg width="19" height="19" viewBox="0 0 24 24" fill="none" aria-hidden>
            <circle cx="12" cy="12" r="9" stroke="var(--accent)" strokeWidth="1.8" opacity="0.5" />
            <path d="M10 9v6M14 9v6" stroke="var(--accent)" strokeWidth="1.9" strokeLinecap="round" />
          </svg>
        </span>

        <h1 className="font-display text-[19px] font-bold leading-snug text-primary">
          {certain ? 'Your Supabase project is paused' : 'Your Supabase project isn’t answering'}
        </h1>

        <p className="mt-2 text-[13.5px] leading-relaxed text-muted">
          {certain ? (
            <>
              Supabase pauses free projects that go about a week without being used. Nothing has been deleted and
              nothing is wrong — everything you have logged is still sitting in there.
            </>
          ) : (
            <>
              Almost always this means Supabase has paused it: free projects go to sleep after about a week without
              being used. Nothing is deleted when that happens — everything you have logged is still in there.
            </>
          )}
        </p>

        <p className="mt-4 text-[13px] font-medium text-primary">Waking it up takes about a minute:</p>
        <ClickPath
          steps={[
            <>
              Open{' '}
              <ExternalLink href={dashboardUrl(projectRef)}>
                {projectRef ? `your project’s dashboard` : 'your Supabase dashboard'}
              </ExternalLink>{' '}
              and sign in to Supabase if it asks.
            </>,
            <>
              {projectRef ? (
                <>
                  Find the project called <Ui>{projectRef}</Ui> — it will be marked as paused.
                </>
              ) : (
                <>Find your Meridian project in the list — it will be marked as paused.</>
              )}
            </>,
            <>
              Press <Ui>Restore project</Ui>, then confirm.
            </>,
            <>Wait a minute or two while it starts up, then come back here and press Try again.</>,
          ]}
        />

        <p className="mt-4 text-[12px] leading-relaxed text-muted">
          Opening Meridian every few days is enough to stop it going to sleep again.
        </p>

        <Actions retrying={retrying} onRetry={onRetry} />
      </Panel>
    </SetupFrame>
  )
}

function Panel({ accent, children }: { accent: string; children: React.ReactNode }) {
  return (
    <div
      className="neu-raised rounded-card px-5 py-6"
      style={{ boxShadow: `8px 8px 16px rgba(0,0,0,0.55), -6px -6px 14px rgba(255,255,255,0.03), inset 0 1px 0 ${accent}` }}
    >
      {children}
    </div>
  )
}

/**
 * The same three ways forward on every variant of this screen, in the same order:
 * try again, get more help, or leave. The last one matters — every other route is
 * behind this screen while it is showing, and a dead end is not a fair thing to
 * hand someone whose only mistake was not opening an app for a week.
 */
function Actions({ retrying, onRetry }: { retrying: boolean; onRetry: () => void }) {
  return (
    <div className="mt-5 flex flex-col gap-2.5">
      <button
        type="button"
        disabled={retrying}
        onClick={onRetry}
        className="min-h-[48px] w-full rounded-card text-[14px] font-semibold text-ink transition-transform active:scale-[0.98] disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        style={{ background: 'var(--accent)' }}
      >
        {retrying ? 'Trying again…' : 'Try again'}
      </button>
      <Link
        to="/settings/help"
        className="neu-raised flex min-h-[48px] w-full items-center justify-center rounded-card text-[14px] font-medium text-accent focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
      >
        Troubleshooting
      </Link>
      <Link
        to="/settings"
        className="flex min-h-[44px] w-full items-center justify-center rounded-card text-[13px] text-muted focus:outline-none focus-visible:ring-1 focus-visible:ring-accent"
      >
        Meridian settings
      </Link>
    </div>
  )
}
