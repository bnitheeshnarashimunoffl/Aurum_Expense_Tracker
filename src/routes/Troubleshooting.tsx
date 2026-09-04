import { useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import SunExitButton from '@/components/SunExitButton'
import { useDataConnection } from '@/context/DataContext'
import { dashboardUrl } from '@/lib/projectHealth'
import { ClickPath, ExternalLink, Ui } from '@/setup/SetupChrome'
import { isIOS } from '@/lib/push'

/**
 * Settings → Troubleshooting.
 *
 * Written for someone who has never opened a terminal and does not know what
 * Supabase is beyond "the thing I made an account on". Three rules:
 *
 *   1. Say what is happening before saying what to do. "Nothing loads" is a
 *      symptom someone can recognise; "PGRST205" is not.
 *   2. Every fix is a click path, with the words to look for marked in gold so
 *      they can be matched against the real screen.
 *   3. No apology and no roadmap. Where something is simply not available, say so
 *      plainly and stop.
 *
 * Collapsed by default, because a wall of eight open problems reads as an app
 * with eight problems.
 */

interface Entry {
  id: string
  symptom: string
  answer: ReactNode
}

function Chevron({ open }: { open: boolean }) {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="var(--accent)"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      style={{ transform: open ? 'rotate(90deg)' : 'none', transition: 'transform 180ms ease' }}
    >
      <path d="M9 5l7 7-7 7" />
    </svg>
  )
}

export default function Troubleshooting() {
  const { status, projectRef } = useDataConnection()
  const reduceMotion = useReducedMotion()
  const [openId, setOpenId] = useState<string | null>(null)
  const owner = status === 'owner'

  const dash = dashboardUrl(projectRef)

  const entries: Entry[] = [
    {
      id: 'paused',
      symptom: 'Nothing loads, and Meridian says it can’t reach your project',
      answer: (
        <>
          <P>
            This is the common one, and it is not a fault. Supabase puts a free project to sleep after about a week
            without being used, which happens to almost everyone who tries an app and then leaves it for a bit.
            Nothing is deleted while it sleeps — everything you logged is still there.
          </P>
          <ClickPath
            steps={[
              <>
                Open <ExternalLink href={dash}>your Supabase dashboard</ExternalLink> and sign in if it asks.
              </>,
              <>
                Find your Meridian project{projectRef ? <> — it is called <Ui>{projectRef}</Ui></> : null}. It will be
                marked as paused.
              </>,
              <>
                Press <Ui>Restore project</Ui> and confirm.
              </>,
              <>Give it a minute or two, then reopen Meridian.</>,
            ]}
          />
          <P>Opening Meridian every few days is enough to keep it awake.</P>
        </>
      ),
    },
    {
      id: 'wrong-project',
      symptom: 'Meridian connects, but everything is empty',
      answer: (
        <>
          <P>
            Almost always this means Meridian is pointed at a different Supabase project from the one your data is in
            — a second project made by mistake, or details pasted from the wrong page.
          </P>
          <ClickPath
            steps={[
              <>
                Open <ExternalLink href="https://supabase.com/dashboard">your Supabase dashboard</ExternalLink> and
                check how many projects you have.
              </>,
              <>
                Open the one your data is in, then <Ui>Project Settings</Ui> → <Ui>API Keys</Ui>.
              </>,
              <>
                Copy the <Ui>Project URL</Ui> and the <Ui>anon</Ui> / <Ui>public</Ui> key from that page.
              </>,
              <>
                Come back to <Ui>Settings</Ui> → <Ui>Supabase connection</Ui> and paste both in.
              </>,
            ]}
          />
          <P>
            Meridian checks the connection works before it will switch, so a wrong paste cannot leave you worse off
            than you started.
          </P>
        </>
      ),
    },
    {
      id: 'script',
      symptom: 'The setup script didn’t work, or you’re not sure it finished',
      answer: (
        <>
          <P>
            Run it again. It is safe to run as many times as you like — it only ever creates things and never deletes
            anything.
          </P>
          <P>
            You cannot end up half set up. Supabase runs the whole script as one piece, so if any part of it fails,
            none of it is kept. Either everything is there or nothing is, and running it again fixes both.
          </P>
          <ClickPath
            steps={[
              <>
                In your project, open <Ui>SQL Editor</Ui> → <Ui>New query</Ui>.
              </>,
              <>Paste the script and press Run.</>,
              <>
                Wait for <Ui>Success. No rows returned</Ui> — that sentence is what finishing looks like. A red message
                instead means nothing was saved, so nothing was half-done.
              </>,
            ]}
          />
          <P>
            The script is on the setup screen with a copy button. Sign out and back in, or open{' '}
            <Link to="/setup" className="text-accent underline decoration-accent/40 underline-offset-[3px]">
              the setup walkthrough
            </Link>{' '}
            to get to it.
          </P>
        </>
      ),
    },
    {
      id: 'confirm-email',
      symptom: 'Test Connection keeps failing, even though the script ran',
      answer: (
        <>
          <P>
            Meridian signs itself in to your database in the background — that sign-in is what keeps your rows yours.
            If your project still has <Ui>Confirm email</Ui> switched on, Supabase holds that sign-in back waiting for
            an email that nobody will ever open.
          </P>
          <ClickPath
            steps={[
              <>
                In your project, open <Ui>Authentication</Ui> in the left sidebar.
              </>,
              <>
                Open <Ui>Sign In / Providers</Ui>. Some projects call this section just <Ui>Providers</Ui>.
              </>,
              <>
                Click <Ui>Email</Ui> in the list.
              </>,
              <>
                Turn <Ui>Confirm email</Ui> off, then press <Ui>Save</Ui>.
              </>,
              <>Come back and press Test Connection again.</>,
            ]}
          />
          <P>This changes nothing outside your own project, and nothing about how you sign in to Meridian.</P>
        </>
      ),
    },
    {
      id: 'notifications',
      symptom: 'Notifications never arrive',
      answer: (
        <>
          <P>
            {owner
              ? 'Check the notifications section in Settings — it says which of the four possible states this device is in, and each one has its own fix.'
              : 'Reminders are not available for shared instances yet, so none are being sent. This is not something on your device to fix.'}
          </P>
          {!owner && (
            <P>
              Reminders have to read your data to be worth sending — how much water you logged, which class is next,
              what is due today. Your data is in your own Supabase project, and the server that would send them cannot
              reach into it. Everything else in Meridian works exactly as normal.
            </P>
          )}
        </>
      ),
    },
    ...(isIOS()
      ? [
          {
            id: 'ios',
            symptom: 'On iPhone or iPad: it feels cramped, or keeps reloading',
            answer: (
              <>
                <P>
                  Safari keeps its own toolbars on screen and will quietly drop a tab it has not seen for a while. Add
                  Meridian to your Home Screen and it opens as a full-screen app instead.
                </P>
                <ClickPath
                  steps={[
                    <>
                      Open Meridian in <Ui>Safari</Ui> — not Chrome or another browser, which cannot install it.
                    </>,
                    <>
                      Tap the <Ui>Share</Ui> button, the square with an arrow coming out of the top.
                    </>,
                    <>
                      Scroll down and choose <Ui>Add to Home Screen</Ui>.
                    </>,
                    <>Open Meridian from its new icon from then on.</>,
                  ]}
                />
                <P>Same account, same data — it just gets the whole screen.</P>
              </>
            ),
          } satisfies Entry,
        ]
      : []),
    {
      id: 'changed-connection',
      symptom: 'Your data vanished after you changed the Supabase connection',
      answer: (
        <>
          <P>
            This is expected, and nothing has been lost. Changing the connection points Meridian at a different
            database. It does not copy, move or merge anything — the new one starts empty and the old one still has
            every single thing you put in it.
          </P>
          <ClickPath
            steps={[
              <>
                Open <ExternalLink href="https://supabase.com/dashboard">your Supabase dashboard</ExternalLink> and
                find the project you were using before.
              </>,
              <>
                Open <Ui>Project Settings</Ui> → <Ui>API Keys</Ui> and copy its <Ui>Project URL</Ui> and{' '}
                <Ui>anon</Ui> / <Ui>public</Ui> key.
              </>,
              <>
                Go to <Ui>Settings</Ui> → <Ui>Supabase connection</Ui> and paste those back in.
              </>,
            ]}
          />
          <P>Everything reappears the moment Meridian is pointed back at the project it is stored in.</P>
        </>
      ),
    },
    {
      id: 'new-device',
      symptom: 'You’re asked to set up again on a new phone, or after clearing your browser',
      answer: (
        <>
          <P>
            Expected. Your project’s address and key are kept on the device you typed them into and nowhere else —
            they are never sent to Meridian’s server, which is the whole point. A new device, a different browser, or
            cleared browsing data all mean typing them once more.
          </P>
          <P>
            Your data is untouched by any of that. It is in your Supabase project, waiting, and reappears as soon as
            you paste the same two values in.
          </P>
          <ClickPath
            steps={[
              <>
                Open <ExternalLink href={dash}>your Supabase dashboard</ExternalLink> and open your Meridian project.
              </>,
              <>
                Go to <Ui>Project Settings</Ui> → <Ui>API Keys</Ui>.
              </>,
              <>
                Copy the <Ui>Project URL</Ui> and the <Ui>anon</Ui> / <Ui>public</Ui> key, and paste them into the
                setup screen.
              </>,
            ]}
          />
          <P>
            Keeping those two values somewhere you can find them — a note to yourself, a password manager — makes this
            a thirty-second job every time.
          </P>
        </>
      ),
    },
  ]

  return (
    <div className="mx-auto min-h-full max-w-lg px-5 pb-20 pt-safe-top">
      <SunExitButton />

      <header className="pb-6 pr-14 pt-8">
        <p className="font-display text-[11px] font-semibold tracking-[0.3em] text-muted">MERIDIAN</p>
        <h1 className="font-display mt-1 text-2xl font-bold text-primary">Troubleshooting</h1>
        <p className="mt-2 text-[12.5px] leading-relaxed text-muted">
          {owner
            ? 'This account uses Meridian’s own project, so most of these will never apply to it.'
            : 'Find what is happening, and what to do about it. None of these need anything installed.'}
        </p>
      </header>

      <div className="space-y-2.5">
        {entries.map((entry) => {
          const open = openId === entry.id
          return (
            <div key={entry.id} className="neu-raised overflow-hidden rounded-card">
              <button
                type="button"
                aria-expanded={open}
                onClick={() => setOpenId(open ? null : entry.id)}
                className="flex w-full items-center gap-3 px-4 py-3.5 text-left focus:outline-none focus-visible:ring-1 focus-visible:ring-accent"
              >
                <span className="min-w-0 flex-1 text-[13.5px] font-medium leading-snug text-primary">
                  {entry.symptom}
                </span>
                <Chevron open={open} />
              </button>

              <AnimatePresence initial={false}>
                {open && (
                  <motion.div
                    initial={reduceMotion ? false : { height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={reduceMotion ? { opacity: 0 } : { height: 0, opacity: 0 }}
                    transition={reduceMotion ? { duration: 0.1 } : { duration: 0.24, ease: [0.4, 0, 0.2, 1] }}
                    className="overflow-hidden"
                  >
                    {/* The answer sits in a pressed well so it reads as being
                        inside the row rather than as another row below it. */}
                    <div className="neu-pressed mx-3 mb-3 rounded-card px-4 py-3.5">{entry.answer}</div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )
        })}
      </div>

      {!owner && (
        <p className="mt-8 text-center text-[11.5px] leading-relaxed text-muted">
          Still stuck? Your Supabase project is yours — nothing in Meridian can lose what is in it, and pasting the
          right address and key back in always brings it back.
        </p>
      )}
    </div>
  )
}

function P({ children }: { children: ReactNode }) {
  return <p className="mt-2.5 text-[12.5px] leading-relaxed text-muted first:mt-0">{children}</p>
}
