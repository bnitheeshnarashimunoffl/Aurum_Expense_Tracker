import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { useDataConnection } from '@/context/DataContext'
import SunExitButton from '@/components/SunExitButton'
import Toast from '@/components/Toast'
import { useToast } from '@/hooks/useToast'
import { testConnection } from '@/lib/dataClient'
import { classifyAnonKey, normaliseProjectUrl, readStoredConnection, writeStoredConnection } from '@/lib/dataConnection'
import { Callout, Field } from '@/setup/SetupChrome'

/** Typed in full before the replace button will do anything. */
const CONFIRM_WORD = 'REPLACE'

/**
 * Settings → Supabase connection.
 *
 * The most dangerous screen in Meridian, and the design says so before it does
 * anything else. Pointing the app at a different project does not move a single
 * row: everything on screen a moment ago is still in the OLD database, and the
 * new one will simply be empty. Nothing here can undo that, so the cost of the
 * action is stated in full, and it takes a passed connection test plus a typed
 * word to reach the button — one mis-tap cannot do it.
 */
export default function ConnectionSettings() {
  const { session } = useAuth()
  const { status, projectRef, reconnect } = useDataConnection()
  const navigate = useNavigate()
  const { message, showToast } = useToast()

  const current = readStoredConnection()

  const [url, setUrl] = useState('')
  const [anonKey, setAnonKey] = useState('')
  const [confirmText, setConfirmText] = useState('')
  const [testState, setTestState] = useState<'idle' | 'testing' | 'pass' | 'fail'>('idle')
  const [failMessage, setFailMessage] = useState('')
  const [saving, setSaving] = useState(false)

  const owner = status === 'owner'

  async function handleTest() {
    setTestState('testing')
    setFailMessage('')

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
    setTestState('pass')
  }

  async function handleReplace() {
    const cleanUrl = normaliseProjectUrl(url)
    if (!cleanUrl) return
    setSaving(true)
    try {
      writeStoredConnection({ url: cleanUrl, anonKey: anonKey.trim(), userId: session?.user.id ?? '' })
      await reconnect()
      showToast('Connection replaced')
      navigate('/', { replace: true })
    } finally {
      setSaving(false)
    }
  }

  const changed =
    Boolean(normaliseProjectUrl(url)) && anonKey.trim().length > 0
  const armed = testState === 'pass' && confirmText.trim().toUpperCase() === CONFIRM_WORD

  return (
    <div className="mx-auto min-h-full max-w-lg px-5 pb-20 pt-safe-top">
      <SunExitButton />

      <header className="pb-6 pr-14 pt-8">
        <p className="font-display text-[11px] font-semibold tracking-[0.3em] text-muted">MERIDIAN</p>
        <h1 className="font-display mt-1 text-2xl font-bold text-primary">Supabase connection</h1>
      </header>

      {owner ? (
        <div className="neu-raised rounded-card px-5 py-5">
          <h2 className="font-display text-[15px] font-semibold text-primary">Nothing to change</h2>
          <p className="mt-2 text-[13px] leading-relaxed text-muted">
            This account stores its data in Meridian’s own project, the way it always has. There is no per-device
            connection to update.
          </p>
        </div>
      ) : (
        <>
          <section className="mb-8">
            <div className="mb-2.5 flex items-baseline gap-3">
              <h2 className="font-display text-sm font-semibold text-primary">Right now</h2>
              <span className="h-px flex-1" style={{ background: 'linear-gradient(90deg, var(--accent), transparent 85%)', opacity: 0.4 }} />
            </div>
            <div className="neu-pressed rounded-card px-4 py-3.5">
              <p className="text-[13px] text-primary">
                {projectRef ? (
                  <span style={{ fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace' }}>
                    {projectRef}.supabase.co
                  </span>
                ) : (
                  'No project connected on this device'
                )}
              </p>
              <p className="mt-1 text-[11.5px] text-muted">
                {status === 'ready'
                  ? 'Connected and readable.'
                  : status === 'error'
                    ? 'Saved on this device, but not answering.'
                    : 'Not connected.'}
                {current?.savedAt ? ` Saved ${new Date(current.savedAt).toLocaleDateString()}.` : ''}
              </p>
              <p className="mt-2 text-[11.5px] leading-relaxed text-muted">
                Your key is stored on this device and is never shown again here — copy it from your Supabase dashboard
                if you need it.
              </p>
            </div>
          </section>

          <section className="mb-8">
            <div className="mb-2.5 flex items-baseline gap-3">
              <h2 className="font-display text-sm font-semibold text-primary">Point somewhere else</h2>
              <span className="h-px flex-1" style={{ background: 'linear-gradient(90deg, var(--accent), transparent 85%)', opacity: 0.4 }} />
            </div>

            {/* The warning comes BEFORE the fields, not beside the button. By the
                time someone has typed a key in, they have already decided. */}
            <div
              className="rounded-card px-5 py-5"
              style={{
                background: 'var(--bg-surface)',
                boxShadow: '8px 8px 16px rgba(0,0,0,0.55), -6px -6px 14px rgba(255,255,255,0.03), inset 0 0 0 1.5px rgba(201,124,93,0.55)',
              }}
            >
              <div className="flex items-start gap-3">
                <span className="neu-pressed mt-0.5 flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl">
                  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="var(--expense)" strokeWidth="2" strokeLinecap="round" aria-hidden>
                    <path d="M12 8v5.5" />
                    <circle cx="12" cy="17.4" r="1" fill="var(--expense)" stroke="none" />
                    <path d="M10.3 3.9 2.5 18a1.9 1.9 0 0 0 1.7 2.9h15.6A1.9 1.9 0 0 0 21.5 18L13.7 3.9a1.9 1.9 0 0 0-3.4 0Z" />
                  </svg>
                </span>
                <div className="min-w-0 flex-1">
                  <h3 className="font-display text-[15px] font-bold text-expense">Read this first</h3>
                  <ul className="mt-2.5 space-y-2 text-[13px] leading-relaxed text-primary">
                    <li className="flex items-baseline gap-2.5">
                      <span className="mt-[7px] h-1 w-1 flex-shrink-0 rounded-full" style={{ background: 'var(--expense)' }} />
                      <span>
                        Everything you can see in Meridian right now lives in the <span className="text-expense">old</span>{' '}
                        project. It will <span className="text-expense">not</span> come with you.
                      </span>
                    </li>
                    <li className="flex items-baseline gap-2.5">
                      <span className="mt-[7px] h-1 w-1 flex-shrink-0 rounded-full" style={{ background: 'var(--expense)' }} />
                      <span>Nothing is copied, moved or merged. The new project starts empty.</span>
                    </li>
                    <li className="flex items-baseline gap-2.5">
                      <span className="mt-[7px] h-1 w-1 flex-shrink-0 rounded-full" style={{ background: 'var(--expense)' }} />
                      <span>
                        Your old data is not deleted — it stays in the old project — but reaching it again means
                        pasting that project’s details back in yourself.
                      </span>
                    </li>
                    <li className="flex items-baseline gap-2.5">
                      <span className="mt-[7px] h-1 w-1 flex-shrink-0 rounded-full" style={{ background: 'var(--expense)' }} />
                      <span>Whatever happens as a result of this change is yours to sort out. Meridian cannot undo it.</span>
                    </li>
                  </ul>
                </div>
              </div>
            </div>

            <Field
              id="connection-url"
              label="New project URL"
              value={url}
              onChange={(next) => {
                setUrl(next)
                setTestState('idle')
                setConfirmText('')
              }}
              placeholder="https://abcdefgh.supabase.co"
            />
            <Field
              id="connection-key"
              label="New anon / public key"
              hint="Not the service_role key."
              value={anonKey}
              onChange={(next) => {
                setAnonKey(next)
                setTestState('idle')
                setConfirmText('')
              }}
              placeholder="eyJhbGciOi…"
              multiline
            />

            <button
              type="button"
              onClick={() => void handleTest()}
              disabled={!changed || testState === 'testing'}
              className="neu-raised mt-5 min-h-[48px] w-full rounded-card text-[14px] font-semibold text-accent disabled:opacity-45 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            >
              {testState === 'testing' ? 'Checking…' : testState === 'pass' ? 'Connection works' : 'Test Connection'}
            </button>

            {testState === 'fail' && (
              <Callout tone="warn" title="That did not connect">
                {failMessage || 'Check the project URL and key, then try again.'}
              </Callout>
            )}

            {testState === 'pass' && (
              <>
                <Field
                  id="connection-confirm"
                  label={`Type ${CONFIRM_WORD} to confirm`}
                  hint="This is the last step before the switch happens."
                  value={confirmText}
                  onChange={setConfirmText}
                  placeholder={CONFIRM_WORD}
                />
                <button
                  type="button"
                  onClick={() => void handleReplace()}
                  disabled={!armed || saving}
                  className="mt-4 min-h-[50px] w-full rounded-card text-[14px] font-bold text-ink transition-transform active:scale-[0.98] disabled:opacity-40 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                  style={{ background: armed ? 'var(--expense)' : 'var(--bg-surface)', color: armed ? '#0B0D10' : 'var(--text-muted)' }}
                >
                  {saving ? 'Switching…' : 'Replace connection'}
                </button>
              </>
            )}
          </section>
        </>
      )}

      <Toast message={message} />
    </div>
  )
}
