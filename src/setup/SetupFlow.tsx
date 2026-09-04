import { useMemo, useState, type ReactNode } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import setupSql from '../../supabase/user_setup.sql?raw'
import { useAuth } from '@/context/AuthContext'
import { useDataConnection } from '@/context/DataContext'
import { authClient } from '@/lib/supabase'
import { testConnection } from '@/lib/dataClient'
import { classifyAnonKey, normaliseProjectUrl, writeStoredConnection } from '@/lib/dataConnection'
import { Callout, ClickPath, CodeBlock, CopyButton, ExternalLink, Field, SetupFrame, SunProgress, Ui } from './SetupChrome'

/**
 * The one-time setup walkthrough: six screens that take someone who has never
 * heard of Supabase from nothing to a working, private database of their own.
 *
 * Two rules shape all the copy below.
 *
 * First, every instruction is a thing you can click. No terminal, no editor, no
 * files — a stranger opening a link on their phone has none of those, and asking
 * for them is where a public launch loses people. Where a step happens somewhere
 * else, it is written as the literal sequence of taps, with the words to look for
 * marked in gold so they can be matched against the real screen.
 *
 * Second, it explains before it asks. The first screen is not a form; it is the
 * reason there is a form at all, including the part nobody wants to say out loud
 * (these credentials live on this device and nowhere else).
 */

type StepKey = 'why' | 'project' | 'script' | 'confirm' | 'keys' | 'connect'

interface Step {
  key: StepKey
  title: string
  lede: string
  body: ReactNode
}

const SUPABASE = 'https://supabase.com'

function buildSteps(): Step[] {
  return [
    {
      key: 'why',
      title: 'Your data lives in your database',
      lede: 'Not mine. Setting that up takes about five minutes, once.',
      body: (
        <>
          <p className="mt-3 text-[13.5px] leading-relaxed text-muted">
            Meridian keeps your sign-in here, but everything you actually write — what you spent, what you studied,
            your timetable, your workouts, your notes — is stored in a database that belongs to you. You make it in
            the next few steps. It is free, it stays free, and nobody else can read it.
          </p>
          <p className="mt-3 text-[13.5px] leading-relaxed text-muted">
            You will need a <span className="text-primary">Supabase</span> account. Supabase is a company that gives
            away small databases; that is the whole of what you need to know about them.
          </p>
          <Callout title="This device only">
            The two values you are about to create are saved on this phone or computer, and nowhere else — they are
            never sent to me. If you clear your browser data, or open Meridian somewhere new, you will paste them in
            again. Keep them somewhere you can find, like a note to yourself.
          </Callout>
        </>
      ),
    },
    {
      key: 'project',
      title: 'Make a free Supabase project',
      lede: 'A project is just a database with a name.',
      body: (
        <>
          <ClickPath
            steps={[
              <>
                Open <ExternalLink href={SUPABASE}>supabase.com</ExternalLink> and press <Ui>Start your project</Ui>.
                Sign in with GitHub, or with an email — whichever is less trouble.
              </>,
              <>
                On the dashboard, press <Ui>New project</Ui>.
              </>,
              <>
                Give it any name you like — <Ui>Meridian</Ui> works — and leave the organisation as it is.
              </>,
              <>
                A <Ui>database password</Ui> is filled in for you. Leave it alone, but copy it somewhere safe. Meridian
                never asks for it; it is yours, for later.
              </>,
              <>
                Pick the region closest to you, then press <Ui>Create new project</Ui>.
              </>,
            ]}
          />
          <p className="mt-4 text-[12.5px] leading-relaxed text-muted">
            It takes a minute or two to build itself. Wait until the top of the page stops saying it is setting up.
            The free plan is all of this that you need — there is nothing to pay for and nothing to choose.
          </p>
        </>
      ),
    },
    {
      key: 'script',
      title: 'Run the setup script',
      lede: 'One copy, one paste, one Run. It builds everything all six apps need.',
      body: (
        <>
          <div className="mt-4">
            <CopyButton text={setupSql} />
          </div>
          <CodeBlock code={setupSql} />
          <ClickPath
            steps={[
              <>
                In your project, open <Ui>SQL Editor</Ui> in the left sidebar.
              </>,
              <>
                Press <Ui>New query</Ui>.
              </>,
              <>Paste the script into the big empty box.</>,
              <>
                Press <Ui>Run</Ui> — bottom right of the box.
              </>,
              <>
                Wait for <Ui>Success. No rows returned</Ui>. That sentence is what finished looks like.
              </>,
            ]}
          />
          <p className="mt-4 text-[12.5px] leading-relaxed text-muted">
            Safe to run twice if you are not sure it worked. It only ever creates things — it never deletes anything.
          </p>
        </>
      ),
    },
    {
      key: 'confirm',
      title: 'Turn off the confirmation email',
      lede: 'One switch. Without it, Meridian cannot get into the database you just made.',
      body: (
        <>
          <p className="mt-3 text-[13.5px] leading-relaxed text-muted">
            Meridian signs itself in to your database in the background — that sign-in is what keeps your rows yours
            and everyone else out. Supabase would normally email that new sign-in and wait for it to be confirmed, but
            there is nobody at the other end to open it.
          </p>
          <ClickPath
            steps={[
              <>
                In the left sidebar, open <Ui>Authentication</Ui>.
              </>,
              <>
                Open <Ui>Sign In / Providers</Ui>. Some projects call this section <Ui>Providers</Ui>.
              </>,
              <>
                Click <Ui>Email</Ui> in the list.
              </>,
              <>
                Turn <Ui>Confirm email</Ui> off.
              </>,
              <>
                Press <Ui>Save</Ui>.
              </>,
            ]}
          />
          <p className="mt-4 text-[12.5px] leading-relaxed text-muted">
            This changes nothing outside your own project, and nothing about how you sign in to Meridian.
          </p>
        </>
      ),
    },
    {
      key: 'keys',
      title: 'Copy two values',
      lede: 'An address, and a key. Both are on the same page.',
      body: (
        <>
          <ClickPath
            steps={[
              <>
                Open <Ui>Project Settings</Ui> — the gear at the bottom of the left sidebar.
              </>,
              <>
                Choose <Ui>API Keys</Ui>. Older projects call this page <Ui>API</Ui> or <Ui>Data API</Ui>.
              </>,
              <>
                Copy the <Ui>Project URL</Ui>. It looks like <span className="text-primary">https://abcdefgh.supabase.co</span>.
              </>,
              <>
                Copy the key labelled <Ui>anon</Ui>, <Ui>public</Ui> or <Ui>publishable</Ui>. It is very long and starts
                with <span className="text-primary">eyJ</span> or <span className="text-primary">sb_publishable_</span>.
              </>,
            ]}
          />
          <Callout tone="warn" title="Never the service_role key">
            The same page has a second key called <span className="text-primary">service_role</span> or{' '}
            <span className="text-primary">secret</span>, usually hidden behind a Reveal button. That one ignores every
            security rule in your database, so anyone who ever got hold of this device could read all of it. The anon
            key cannot do that — the rules the script installed are what stop it. Meridian will refuse the wrong key if
            you paste it, but it is worth knowing which is which.
          </Callout>
        </>
      ),
    },
    {
      key: 'connect',
      title: 'Paste them in',
      lede: 'Then let Meridian check it can actually reach your database.',
      body: null,
    },
  ]
}

/* -------------------------------------------------------------------------- */

export default function SetupFlow() {
  const { session } = useAuth()
  const { status, reconnect } = useDataConnection()
  const navigate = useNavigate()
  const reduceMotion = useReducedMotion()
  const steps = useMemo(buildSteps, [])

  const [index, setIndex] = useState(0)
  const [url, setUrl] = useState('')
  const [anonKey, setAnonKey] = useState('')
  const [testState, setTestState] = useState<'idle' | 'testing' | 'pass' | 'fail'>('idle')
  const [failMessage, setFailMessage] = useState('')
  const [storageWarning, setStorageWarning] = useState(false)

  // Already connected — there is nothing here to do. The owner never sees this
  // screen at all, and neither does anyone who has already finished.
  if (status === 'owner' || status === 'ready') return <Navigate to="/" replace />

  const step = steps[index]
  const isLast = index === steps.length - 1

  async function handleSignOut() {
    await authClient.auth.signOut()
    navigate('/login', { replace: true })
  }

  async function handleTest() {
    setTestState('testing')
    setFailMessage('')

    // Only reachable behind RequireAuth, but the session can still expire while
    // somebody is halfway through reading step three.
    if (!session) {
      setTestState('fail')
      setFailMessage('You have been signed out. Sign in again, then come back to this step.')
      return
    }

    const cleanUrl = normaliseProjectUrl(url)
    if (!cleanUrl) {
      setTestState('fail')
      setFailMessage('That does not look like a Supabase project URL. It should end in .supabase.co')
      return
    }
    const verdict = classifyAnonKey(anonKey)
    if (!verdict.ok) {
      setTestState('fail')
      setFailMessage(verdict.reason)
      return
    }

    const result = await testConnection(cleanUrl, anonKey, session)
    if (!result.ok) {
      setTestState('fail')
      setFailMessage(result.message)
      return
    }

    // The test passed, so these are the credentials — save them and bring the
    // real client up before saying so, rather than declaring success and then
    // discovering the app still cannot read anything.
    const saved = writeStoredConnection({ url: cleanUrl, anonKey: anonKey.trim(), userId: session.user.id })
    setStorageWarning(!saved)
    await reconnect()
    setTestState('pass')
  }

  return (
    <SetupFrame eyebrow="MERIDIAN">
      <div className="mb-5 flex items-center justify-between gap-3">
        <SunProgress index={index} total={steps.length} />
        <span className="text-[11px] tabular-nums text-muted">
          {index + 1} / {steps.length}
        </span>
      </div>

      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={step.key}
          initial={reduceMotion ? false : { opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={reduceMotion ? undefined : { opacity: 0, y: -8 }}
          transition={reduceMotion ? { duration: 0.1 } : { type: 'spring', stiffness: 420, damping: 34 }}
        >
          <div className="neu-raised rounded-card px-5 py-5" style={{ boxShadow: '8px 8px 16px rgba(0,0,0,0.55), -6px -6px 14px rgba(255,255,255,0.03), inset 0 1px 0 rgba(201,164,106,0.28)' }}>
            <h1 className="font-display text-[19px] font-bold leading-snug text-primary">{step.title}</h1>
            <p className="mt-1.5 text-[13px] leading-relaxed text-accent">{step.lede}</p>

            {step.key === 'connect' ? (
              <ConnectStep
                url={url}
                anonKey={anonKey}
                onUrl={(next) => {
                  setUrl(next)
                  setTestState('idle')
                }}
                onKey={(next) => {
                  setAnonKey(next)
                  setTestState('idle')
                }}
                testState={testState}
                failMessage={failMessage}
                storageWarning={storageWarning}
                onTest={() => void handleTest()}
              />
            ) : (
              step.body
            )}
          </div>
        </motion.div>
      </AnimatePresence>

      <div className="mt-5 flex items-center gap-3">
        {index > 0 && (
          <button
            type="button"
            onClick={() => setIndex((i) => i - 1)}
            className="min-h-[46px] rounded-full px-4 text-[13px] font-medium text-muted focus:outline-none focus-visible:ring-1 focus-visible:ring-accent"
          >
            Back
          </button>
        )}
        <div className="flex-1" />
        {!isLast ? (
          <button
            type="button"
            onClick={() => setIndex((i) => i + 1)}
            className="min-h-[46px] rounded-full px-6 text-[14px] font-semibold text-ink transition-transform active:scale-[0.97] focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            style={{ background: 'var(--accent)' }}
          >
            {index === 0 ? 'Start' : 'Next'}
          </button>
        ) : (
          testState === 'pass' && (
            <button
              type="button"
              onClick={() => navigate('/', { replace: true })}
              className="min-h-[46px] rounded-full px-6 text-[14px] font-semibold text-ink transition-transform active:scale-[0.97] focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              style={{ background: 'var(--accent)' }}
            >
              Open Meridian
            </button>
          )
        )}
      </div>

      <p className="mt-8 text-center text-[11.5px] leading-relaxed text-muted">
        Stuck on a step? Go back and read it again — every one of these is somewhere on the Supabase site, and nothing
        here needs anything installed.
      </p>

      {/* The way out. Until this is finished there is nowhere else to go, and a
          first screen with no exit is a trap — especially for someone who opened
          a stranger's link and has decided they would rather not. */}
      <button
        type="button"
        onClick={() => void handleSignOut()}
        className="mx-auto mt-4 block min-h-[40px] rounded-full px-4 text-[12px] text-muted focus:outline-none focus-visible:ring-1 focus-visible:ring-accent"
      >
        Sign out
      </button>
    </SetupFrame>
  )
}

/* -------------------------------------------------------------------------- */
/* The last step                                                               */
/* -------------------------------------------------------------------------- */

function ConnectStep({
  url,
  anonKey,
  onUrl,
  onKey,
  testState,
  failMessage,
  storageWarning,
  onTest,
}: {
  url: string
  anonKey: string
  onUrl: (next: string) => void
  onKey: (next: string) => void
  testState: 'idle' | 'testing' | 'pass' | 'fail'
  failMessage: string
  storageWarning: boolean
  onTest: () => void
}) {
  const ready = url.trim().length > 0 && anonKey.trim().length > 0

  if (testState === 'pass') {
    return (
      <div className="mt-5">
        <div className="neu-pressed rounded-card px-4 py-5 text-center">
          <span
            className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-full"
            style={{ background: 'var(--income)' }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--bg-base)" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M4 12.5l5 5L20 6.5" />
            </svg>
          </span>
          <h3 className="font-display text-[15px] font-semibold text-primary">Connected</h3>
          <p className="mx-auto mt-1.5 max-w-[30ch] text-[12.5px] leading-relaxed text-muted">
            Meridian wrote to your database and read it back. Everything you do from here is stored there.
          </p>
        </div>
        {storageWarning && (
          <Callout tone="warn" title="This browser will not remember it">
            Storage is blocked here — private browsing usually. Meridian works for now, but you will be asked for these
            two values again the next time you open it.
          </Callout>
        )}
      </div>
    )
  }

  return (
    <>
      <Field
        id="setup-url"
        label="Project URL"
        hint="From Project Settings → API Keys."
        value={url}
        onChange={onUrl}
        placeholder="https://abcdefgh.supabase.co"
      />
      <Field
        id="setup-key"
        label="anon / public key"
        hint="The long one. Not the service_role key."
        value={anonKey}
        onChange={onKey}
        placeholder="eyJhbGciOi…"
        multiline
      />

      <button
        type="button"
        onClick={onTest}
        disabled={!ready || testState === 'testing'}
        className="neu-raised mt-5 min-h-[48px] w-full rounded-card text-[14px] font-semibold text-accent disabled:opacity-45 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
      >
        {testState === 'testing' ? 'Checking…' : 'Test Connection'}
      </button>

      {testState === 'fail' && (
        <Callout tone="warn" title="That did not connect">
          {failMessage || 'Go back and check the steps above, then try again.'}
        </Callout>
      )}

      <p className="mt-4 text-[11.5px] leading-relaxed text-muted">
        The test writes one row into your database and reads it straight back. If that works, all six apps will.
      </p>
    </>
  )
}
