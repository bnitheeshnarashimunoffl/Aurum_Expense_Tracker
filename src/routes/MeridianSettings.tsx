import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { useDataConnection } from '@/context/DataContext'
import SunExitButton from '@/components/SunExitButton'
import Toggle from '@/components/Toggle'
import Toast from '@/components/Toast'
import IosInstallBanner, { useIosInstallGate } from '@/components/IosInstallBanner'
import Credits from '@/components/Credits'
import { InstallRow, useInstallAffordance } from '@/components/InstallPrompt'
import { useToast } from '@/hooks/useToast'
import { MODULE_TOGGLES, useNotificationSettings } from '@/hooks/useNotificationSettings'
import {
  disablePush,
  enablePush,
  resolvePushState,
  sendTestNotification,
  vapidConfigured,
  isIOS,
  isStandalone,
  type PushState,
} from '@/lib/push'
import { WALKTHROUGHS, WALKTHROUGH_ORDER } from '@/onboarding/steps'
import { requestReplay, useWalkthroughStatuses } from '@/onboarding/useWalkthrough'
import type { ModuleKey } from '@/onboarding/types'

/**
 * Each row wears its own module's colour, measured against --bg-surface so a
 * 10px uppercase eyebrow is actually readable: Kindle's lifted purple 5.5:1,
 * Vigil 9.1, Loom 7.7, Virtus 4.6, Chronicle 6.9.
 *
 * Loom takes its gold rather than its burgundy on purpose — --loom-burgundy-soft
 * lands at 2.97 here, which is not a colour, it is a rumour of one. Burgundy
 * stays a fill in Loom, which is where it measures well.
 */
const MODULE_ACCENT: Record<string, string> = {
  Kindle: 'var(--mer-kindle-accent)',
  Vigil: 'var(--vigil-gold-soft)',
  Loom: 'var(--loom-gold)',
  Virtus: 'var(--bronze-primary)',
  Chronicle: 'var(--gold-primary)',
}

/** Where each module's walkthrough has to be replayed, since it points at that module's screen. */
const MODULE_ROUTE: Record<ModuleKey, string> = {
  meridian: '/',
  aurum: '/aurum',
  kindle: '/kindle',
  vigil: '/vigil',
  loom: '/loom',
  virtus: '/virtus',
  chronicle: '/chronicle',
}

/** A row that goes somewhere. Same shape wherever it appears on this screen. */
function SettingsLink({ to, label, detail }: { to: string; label: string; detail: string }) {
  return (
    <Link
      to={to}
      className="neu-raised flex items-center gap-3 rounded-card px-4 py-3.5 focus:outline-none focus-visible:ring-1 focus-visible:ring-accent"
    >
      <span className="min-w-0 flex-1">
        <span className="block text-[14px] font-medium text-primary">{label}</span>
        <span className="mt-0.5 block truncate text-[11.5px] text-muted">{detail}</span>
      </span>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M9 5l7 7-7 7" />
      </svg>
    </Link>
  )
}

function Section({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <section className="mb-8">
      <div className="mb-2.5 flex items-baseline gap-3">
        <h2 className="font-display text-sm font-semibold text-primary">{title}</h2>
        <span className="h-px flex-1" style={{ background: 'linear-gradient(90deg, var(--accent), transparent 85%)', opacity: 0.4 }} />
      </div>
      {subtitle && <p className="mb-3 text-[12px] leading-relaxed text-muted">{subtitle}</p>}
      {children}
    </section>
  )
}

/**
 * A panel that explains the notification state this device is actually in.
 *
 * Push has four ways to be unavailable and only one of them is a dead end, so
 * "notifications are off" would be a wrong answer three times out of four. Each
 * state below gets the sentence that matches it — the iOS one especially, where
 * the fix is three taps and the failure is completely silent.
 */
function PushStatePanel({ state }: { state: PushState }) {
  if (state === 'subscribed' || state === 'prompt') return null

  const copy: Record<string, { title: string; body: string }> = {
    unsupported: {
      title: 'This browser can’t receive notifications',
      body: 'Web Push is not available here. Meridian works exactly as before — it just cannot interrupt you.',
    },
    'ios-needs-install': {
      // The three taps themselves are in the "This device" section above, where
      // the banner now lives permanently rather than behind a "show me how".
      title: 'Add Meridian to your Home Screen first',
      body: 'On iPhone and iPad, notifications only reach an installed app, never a Safari tab. The steps are just above.',
    },
    denied: {
      title: 'Notifications are blocked',
      // The path to un-block is completely different per platform, and the wrong
      // one is worse than none — an Android user sent to Settings → Notifications
      // → Meridian will not find it, and will conclude the app is broken.
      body:
        'This site was refused permission, and only your browser settings can give it back — Meridian cannot ask again. ' +
        (isIOS()
          ? 'On iPhone and iPad: Settings → Notifications → Meridian.'
          : 'On Android, in Chrome: tap the ⋮ menu → Settings → Site settings → Notifications, and find this site.'),
    },
    'granted-unsubscribed': {
      title: 'This device isn’t registered yet',
      body: 'Permission is granted, but this browser has no push subscription stored. Turning the switch below on will register it.',
    },
  }
  const entry = copy[state]
  if (!entry) return null

  return (
    <div className="neu-pressed mb-3 rounded-card px-4 py-3.5">
      <h3 className="text-[13.5px] font-semibold text-primary">{entry.title}</h3>
      <p className="mt-1 text-[12px] leading-relaxed text-muted">{entry.body}</p>
    </div>
  )
}

/**
 * Meridian's own settings — the platform level, above any module. Two things live
 * here because they belong to the whole app rather than to one of the six:
 * notifications, and the walkthroughs.
 */
export default function MeridianSettings() {
  const navigate = useNavigate()
  const { message, showToast } = useToast()
  const { settings, loading, save } = useNotificationSettings()
  const { statuses, refresh: refreshStatuses, reset } = useWalkthroughStatuses()
  const installGate = useIosInstallGate()
  const { status: dataStatus, projectRef } = useDataConnection()
  // Everyone but the owner keeps their module data in a project of their own,
  // which the reminder server cannot read. Two of the five reminders are nothing
  // but that data, so they are shown as unavailable rather than as switches that
  // quietly do nothing.
  const externalData = dataStatus !== 'owner'

  const [pushState, setPushState] = useState<PushState>('prompt')
  const [busy, setBusy] = useState(false)
  const [testing, setTesting] = useState(false)
  // Whether Android has an install prompt waiting — used only to decide whether
  // the "nothing to change here" line is true.
  const { available: installPromptOffered } = useInstallAffordance()

  const refreshPushState = useCallback(async () => {
    setPushState(await resolvePushState())
  }, [])

  useEffect(() => {
    // Never even asked for a shared instance. resolvePushState() is harmless, but
    // the answer is unused and on iOS it walks the service worker registration
    // for a section that is not on screen.
    if (!externalData) void refreshPushState()
  }, [refreshPushState, externalData])

  const canEnable = pushState !== 'unsupported' && pushState !== 'ios-needs-install' && pushState !== 'denied'

  async function handleMaster(next: boolean) {
    setBusy(true)
    try {
      if (next) {
        // Permission and the subscription come FIRST. Flipping the stored setting
        // before the browser has agreed would leave a switch that says "on" while
        // nothing can ever arrive.
        await enablePush()
        await save({ enabled: true })
        showToast('Notifications on for this device')
      } else {
        await save({ enabled: false })
        await disablePush()
        showToast('Notifications off')
      }
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Could not change that', 5000)
    } finally {
      await refreshPushState()
      setBusy(false)
    }
  }

  async function handleModule(key: string, next: boolean) {
    try {
      await save({ [key]: next })
    } catch {
      showToast('Could not save that setting')
    }
  }

  async function handleTest() {
    setTesting(true)
    try {
      await sendTestNotification()
      showToast('Sent — it should arrive in a second or two', 3500)
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Could not send a test', 6000)
    } finally {
      setTesting(false)
    }
  }

  function handleReplay(module: ModuleKey) {
    requestReplay(module)
    navigate(MODULE_ROUTE[module])
  }

  async function handleReset(module: ModuleKey) {
    await reset(module)
    await refreshStatuses()
    showToast(`${WALKTHROUGHS[module].label} will show again on its own`)
  }

  /**
   * Same effect as Aurum's own "Log out" (one shared Supabase Auth session
   * covers the whole platform, so there is only ever one to end) — offered here
   * too since this is the platform-level settings screen, not tucked inside a
   * single module.
   */
  async function handleSignOut() {
    await supabase.auth.signOut()
    navigate('/login', { replace: true })
  }

  return (
    <div className="mx-auto min-h-full max-w-lg px-5 pb-20 pt-safe-top">
      <SunExitButton />

      <header className="pb-6 pr-14 pt-8">
        <p className="font-display text-[11px] font-semibold tracking-[0.3em] text-muted">MERIDIAN</p>
        <h1 className="font-display mt-1 text-2xl font-bold text-primary">Settings</h1>
      </header>

      {/* The install offers sit ABOVE notifications now, and outside that section
          entirely. They used to live inside it because installing was how you got
          notifications on iOS; that is no longer the reason for either platform,
          and for most accounts the notifications section below has no toggles in
          it at all. Installing is worth doing on its own. */}
      {/* Rendered only when there is something to say. On a desktop browser that
          offers no install at all, an empty "This device" heading is a section
          about nothing. */}
      {(installPromptOffered || installGate.needed || isStandalone()) && (
        <Section
          title="This device"
          subtitle="Meridian runs in a browser, but it does not have to look like one."
        >
          {/* Android's install offer. Renders nothing anywhere else — Safari never
              fires the event it depends on, so iOS keeps the banner below and only
              the banner, and neither platform is ever shown the other's advice. */}
          <InstallRow />

          {installGate.needed && (
            <div className="mt-2">
              <IosInstallBanner variant="inline" reason={externalData ? 'experience' : 'notifications'} />
            </div>
          )}

          {isStandalone() && !installPromptOffered && (
            <p className="text-[12px] leading-relaxed text-muted">
              Meridian is installed on this device — this is the full-screen app, not a browser tab.
            </p>
          )}
        </Section>
      )}

      {externalData ? (
        <Section title="Notifications">
          <div
            className="neu-raised rounded-card px-5 py-5"
            // The same gold hairline the dashboard cards and the install banner
            // carry. This is Meridian explaining itself, not an error state, and
            // the surface has to say so before a word of it is read.
            style={{ boxShadow: '8px 8px 16px rgba(0,0,0,0.55), -6px -6px 14px rgba(255,255,255,0.03), inset 0 1px 0 rgba(201,164,106,0.28)' }}
          >
            <div className="flex items-start gap-3">
              <span className="neu-pressed mt-0.5 flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl">
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <path d="M6 9a6 6 0 0 1 12 0c0 4 1.5 5.5 1.5 5.5h-15S6 13 6 9Z" />
                  <path d="M10 18a2 2 0 0 0 4 0" />
                  <path d="M4 4l16 16" opacity="0.55" />
                </svg>
              </span>
              <div className="min-w-0 flex-1">
                <h3 className="font-display text-[15px] font-semibold text-primary">
                  Not available for shared instances yet
                </h3>
                <p className="mt-1.5 text-[13px] leading-relaxed text-muted">
                  Reminders have to read your data to be worth sending — how much water you have logged, which class
                  is next, what is due today. Your data is in your own Supabase project, and the server that would
                  send them cannot reach into it.
                </p>
                <p className="mt-2.5 text-[12px] leading-relaxed text-muted">
                  Everything else works exactly as it does for anyone else. Meridian simply will not interrupt you.
                </p>
              </div>
            </div>
          </div>
        </Section>
      ) : (
      <Section
        title="Notifications"
        subtitle="Meridian sends these from the server, so they arrive on time whether or not the app is open. Each one is checked before it is sent — nothing fires into an empty day."
      >
        {/* Two versions of the same fact. In development it names the variable,
            because that is the fix. On the public site nobody reading it owns the
            deployment, so it says what is true for them and nothing about how the
            app is configured. */}
        {!vapidConfigured() && (
          <div className="neu-pressed mb-3 rounded-card px-4 py-3.5">
            <h3 className="text-[13.5px] font-semibold text-expense">
              {import.meta.env.DEV ? 'Not configured yet' : 'Notifications are unavailable'}
            </h3>
            <p className="mt-1 text-[12px] leading-relaxed text-muted">
              {import.meta.env.DEV ? (
                <>
                  <code className="text-primary">VITE_VAPID_PUBLIC_KEY</code> is missing from this build. Run{' '}
                  <code className="text-primary">npm run vapid</code>, then add it to{' '}
                  <code className="text-primary">.env.local</code> and to your deployment’s environment variables.
                </>
              ) : (
                'Meridian cannot send notifications at the moment. Everything else works exactly as it does normally.'
              )}
            </p>
          </div>
        )}

        <PushStatePanel state={pushState} />

        <Toggle
          checked={settings.enabled && pushState === 'subscribed'}
          onChange={handleMaster}
          disabled={loading || !canEnable || !vapidConfigured()}
          busy={busy}
          label="Notifications on this device"
          detail={
            settings.enabled && pushState === 'subscribed'
              ? 'Times follow this device’s clock and time zone.'
              : 'Turning this on asks your browser for permission.'
          }
        />

        <div className="mt-3 space-y-2">
          {MODULE_TOGGLES.map((toggle) => (
            <Toggle
              key={toggle.key}
              checked={settings[toggle.key]}
              onChange={(next) => void handleModule(toggle.key, next)}
              disabled={loading || !settings.enabled}
              eyebrow={toggle.module}
              eyebrowColor={MODULE_ACCENT[toggle.module]}
              label={toggle.label}
              detail={toggle.detail}
            />
          ))}
        </div>

        <p className="mt-3 text-[11.5px] leading-relaxed text-muted">
          Aurum has no notifications, by design — money is something you go and look at, not something that should
          interrupt you.
        </p>

        {settings.enabled && pushState === 'subscribed' && (
          <button
            type="button"
            onClick={() => void handleTest()}
            disabled={testing}
            className="neu-raised mt-4 min-h-[46px] w-full rounded-card text-[13.5px] font-medium text-accent disabled:opacity-50 focus:outline-none focus-visible:ring-1 focus-visible:ring-accent"
          >
            {testing ? 'Sending…' : 'Send a test notification'}
          </button>
        )}
      </Section>
      )}

      <Section
        title="Walkthroughs"
        subtitle="Each app introduces itself the first time you open it. Show any of them again — Meridian’s runs here on the launcher, the rest run inside their own app."
      >
        <div className="space-y-2">
          {WALKTHROUGH_ORDER.map((module) => {
            const status = statuses[module]
            return (
              <div key={module} className="neu-raised flex items-center gap-3 rounded-card px-4 py-3">
                <span className="min-w-0 flex-1">
                  <span className="block text-[14px] font-medium text-primary">{WALKTHROUGHS[module].label}</span>
                  <span className="mt-0.5 block text-[11.5px] text-muted">
                    {status === 'completed'
                      ? `Seen · ${WALKTHROUGHS[module].steps.length} steps`
                      : status === 'skipped'
                        ? 'Skipped last time'
                        : 'Not seen yet'}
                  </span>
                </span>
                {status && (
                  <button
                    type="button"
                    onClick={() => void handleReset(module)}
                    className="min-h-[40px] rounded-full px-2.5 text-[12px] text-muted focus:outline-none focus-visible:ring-1 focus-visible:ring-accent"
                  >
                    Forget
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => handleReplay(module)}
                  className="neu-pressed min-h-[40px] flex-shrink-0 rounded-full px-4 text-[12.5px] font-medium text-accent focus:outline-none focus-visible:ring-1 focus-visible:ring-accent"
                >
                  Show
                </button>
              </div>
            )
          })}
        </div>
      </Section>

      {externalData && (
        <Section
          title="Your data"
          subtitle="Everything the six apps store is in a Supabase project you own. Meridian keeps only your sign-in."
        >
          <div className="space-y-2">
            <SettingsLink
              to="/settings/connection"
              label="Supabase connection"
              detail={projectRef ? `${projectRef}.supabase.co` : 'Not connected on this device'}
            />
            <SettingsLink
              to="/settings/help"
              label="Troubleshooting"
              detail="What to do when something is not loading."
            />
          </div>
        </Section>
      )}

      {!externalData && (
        <Section title="Help">
          <SettingsLink to="/settings/help" label="Troubleshooting" detail="Common problems, and what to do." />
        </Section>
      )}

      <button
        type="button"
        onClick={() => void handleSignOut()}
        className="neu-raised min-h-[46px] w-full rounded-card text-sm font-medium text-expense focus:outline-none focus-visible:ring-1 focus-visible:ring-accent"
      >
        Sign out
      </button>

      {/* Below Sign out, which is the last thing on this screen that does
          anything. Credits and the contact line are read, not used. */}
      <Credits contact />

      <Toast message={message} />
    </div>
  )
}
