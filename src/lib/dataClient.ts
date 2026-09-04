import { createClient, type Session, type SupabaseClient } from '@supabase/supabase-js'
import { AUTH_PROJECT_URL, authClient } from '@/lib/supabase'
import {
  classifyAnonKey,
  isOwnerIdentity,
  normaliseProjectUrl,
  projectRefFrom,
  readStoredConnection,
  type StoredConnection,
} from '@/lib/dataConnection'

/**
 * THE DATA CLIENT — the Supabase project that holds everything the six modules
 * store, which since the public release is a project the USER owns.
 *
 * Two clients, one app, and the reason is money and honesty in equal parts: auth
 * stays on the developer's project so signups are visible in their dashboard, and
 * data goes to a project the user created on the free tier, so a stranger's
 * expenses and notes never touch the developer's quota — or their database.
 *
 *
 * THE PART THAT IS NOT OBVIOUS: why there is a second sign-in.
 *
 * Every RLS policy in Meridian's schema is `auth.uid() = user_id`. `auth.uid()`
 * is read out of the JWT Postgres was handed, and a JWT is only trusted by the
 * project that signed it — the auth project's token means nothing to the user's
 * project, which would see an anonymous request and correctly refuse it. So the
 * app signs in a SECOND time, against the user's own project, and it is that
 * session's uid that owns their rows.
 *
 * The password for that second account is DERIVED, never stored: SHA-256 over the
 * Meridian user id and the project ref. That is what makes a second device work —
 * paste the same two values, and the same password falls out — while nothing
 * secret is ever written down or transmitted anywhere but the user's own project.
 *
 * For the OWNER, none of this happens: the data client IS the auth client, the
 * same object, and every row they have ever written is exactly where it was.
 */

/* -------------------------------------------------------------------------- */
/* State                                                                       */
/* -------------------------------------------------------------------------- */

export type DataStatus =
  /** No session yet, or the connection has not been attempted. */
  | 'idle'
  /** Working on it — signing in against the data project. */
  | 'connecting'
  /** The owner's account: data client === auth client, nothing to set up. */
  | 'owner'
  /** A user's own project, connected and usable. */
  | 'ready'
  /** No credentials stored on this device. The setup flow is the destination. */
  | 'unconfigured'
  /** Credentials are stored but the project cannot be reached or used. */
  | 'error'

/** Why a connection attempt ended in `error`. Drives which help the user is shown. */
export type DataFailure = 'schema' | 'auth' | 'network' | 'invalid' | null

export interface DataState {
  status: DataStatus
  /** The project host, for display only — never the key. */
  projectRef: string
  /**
   * The last failure, kept so the error screen can offer the right help rather
   * than the same paragraph for four different problems: a project that answered
   * but has no tables in it needs the setup script re-run, one that would not let
   * us sign in usually still has "Confirm email" switched on, and one that did
   * not answer at all is almost always paused.
   */
  failure: DataFailure
}

let state: DataState = { status: 'idle', projectRef: '', failure: null }
let client: SupabaseClient | null = null
let placeholder: SupabaseClient | null = null

const listeners = new Set<(next: DataState) => void>()

function setState(next: Partial<DataState>) {
  state = { ...state, ...next }
  for (const listener of listeners) listener(state)
}

export function getDataState(): DataState {
  return state
}

export function subscribeToDataState(listener: (next: DataState) => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

/** True while the signed-in account is the developer's own. */
export function isOwnerMode(): boolean {
  return state.status === 'owner'
}

/* -------------------------------------------------------------------------- */
/* The client itself                                                           */
/* -------------------------------------------------------------------------- */

/**
 * A client pointed at nowhere, used only in the window before a real one exists.
 * Route guards mean module code should never reach it, but a hook that fires one
 * render early should get a failed request rather than a thrown TypeError.
 */
function deadClient(): SupabaseClient {
  if (!placeholder) {
    placeholder = createClient('https://placeholder.supabase.co', 'placeholder-anon-key', {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    })
  }
  return placeholder
}

function activeClient(): SupabaseClient {
  return client ?? deadClient()
}

/**
 * The handle every module imports. A Proxy rather than a mutable `let` export
 * because the target changes at runtime — it is the auth client for the owner, a
 * per-user client for everyone else, and neither exists at module-evaluation
 * time. Methods are bound to the live client on the way out, since supabase-js
 * relies on `this` internally and an unbound `from` would break.
 */
export const db: SupabaseClient = new Proxy({} as SupabaseClient, {
  get(_target, property, _receiver) {
    const target = activeClient() as unknown as Record<string | symbol, unknown>
    const value = target[property]
    return typeof value === 'function' ? (value as (...args: unknown[]) => unknown).bind(target) : value
  },
  has(_target, property) {
    return property in (activeClient() as unknown as object)
  },
})

/* -------------------------------------------------------------------------- */
/* Deriving the data-project account                                           */
/* -------------------------------------------------------------------------- */

function base64url(bytes: ArrayBuffer): string {
  let binary = ''
  for (const byte of new Uint8Array(bytes)) binary += String.fromCharCode(byte)
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

/**
 * The password for the user's account inside their OWN project.
 *
 * Deterministic on purpose. A random password would have to be stored somewhere,
 * and the only somewhere available is this device — which would mean a second
 * phone could never sign in, and clearing browser data would lock a user out of
 * their own database permanently. Deriving it from the Meridian user id means it
 * can always be recomputed after a login, and never has to be kept.
 *
 * It protects data inside a project the user already owns, against an attacker who
 * would need both their Meridian user id and their project ref. Anyone holding the
 * signed-in session could reach the data anyway, so this adds no new exposure.
 */
async function derivePassword(authUserId: string, projectRef: string): Promise<string> {
  const material = 'meridian-data-account:v1:' + authUserId + ':' + projectRef
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(material))
  // The trailing characters guarantee the mixed-case/digit/symbol shape some
  // projects require, whatever the digest happened to produce.
  return base64url(digest) + '.mA1!'
}

function deriveEmail(session: Session): string {
  const email = session.user.email?.trim().toLowerCase()
  if (email) return email
  // Phone-only accounts have no address; a stable synthetic one keeps the derived
  // credentials reproducible across devices just the same.
  return 'meridian-' + session.user.id + '@users.meridian.invalid'
}

/* -------------------------------------------------------------------------- */
/* Connecting                                                                  */
/* -------------------------------------------------------------------------- */

export type ConnectOutcome =
  | { ok: true; owner: boolean }
  | { ok: false; reason: 'unconfigured' | 'schema' | 'auth' | 'network' | 'invalid' }

/**
 * @param ephemeral for the connection tester, which must not touch the stored
 *        session at all — a throwaway client that signed out of the shared
 *        storage key would log the live one out from under a working app.
 */
function buildClient(connection: { url: string; anonKey: string }, ephemeral = false): SupabaseClient {
  return createClient(connection.url, connection.anonKey, {
    auth: {
      // Its own storage slot, so the data project's session can never overwrite
      // the Meridian session that is holding the app open.
      storageKey: ephemeral ? 'meridian-data-auth-probe' : 'meridian-data-auth',
      persistSession: !ephemeral,
      autoRefreshToken: !ephemeral,
      // Critical: only the AUTH client may consume tokens out of the URL. A
      // password-reset link belongs to Meridian's project, and letting this one
      // race for it would swallow the recovery token.
      detectSessionInUrl: false,
    },
  })
}

/**
 * Confirms the schema is there before anything else touches the project.
 *
 * An anon request against a table that exists but is RLS-protected returns zero
 * rows and no error; a table that does not exist returns an error. That is a
 * clean, cheap "has the setup script been run?" and it runs before sign-up, so a
 * user who pasted their keys early is told to go back rather than ending up with
 * an account in a project that has nowhere to put their data.
 */
async function schemaPresent(candidate: SupabaseClient): Promise<boolean> {
  const { error } = await candidate.from('meridian_connection_check').select('user_id', { head: true, count: 'exact' })
  return !error
}

/**
 * Signs in to the user's own project, creating the account the first time.
 *
 * The retry through `meridian_confirm_signup` is the safety net for the one
 * setup step people skip: if "Confirm email" was left on in their project,
 * sign-up succeeds but hands back no session. That function (installed by the
 * setup script) marks a just-created, still-unconfirmed account as confirmed, so
 * the flow completes instead of dead-ending on an email that was never sent.
 */
/**
 * Reuses the session already in storage where there is one, and only signs in
 * when there is not.
 *
 * Without this, every single launch would spend a fresh sign-in round trip
 * against the user's project — slower on a phone, and steadily eating into
 * Supabase's auth rate limits for no benefit, since the session that came back
 * would be indistinguishable from the one already sitting there.
 *
 * The email check is the important half. A stored session belonging to a
 * different account — the project was switched, or the phone changed hands — must
 * never be adopted just because it happens to be under the same storage key.
 */
async function ensureSignedIn(candidate: SupabaseClient, email: string, password: string): Promise<boolean> {
  const { data } = await candidate.auth.getSession()
  if (data.session) {
    if ((data.session.user.email ?? '').toLowerCase() === email.toLowerCase()) return true
    await candidate.auth.signOut({ scope: 'local' })
  }
  return signInToDataProject(candidate, email, password)
}

async function signInToDataProject(candidate: SupabaseClient, email: string, password: string): Promise<boolean> {
  const first = await candidate.auth.signInWithPassword({ email, password })
  if (first.data.session) return true

  const created = await candidate.auth.signUp({ email, password })
  if (created.data.session) return true

  try {
    await candidate.rpc('meridian_confirm_signup', { target_email: email })
  } catch {
    /* Best effort. If it is not there, the retry below simply fails. */
  }

  const second = await candidate.auth.signInWithPassword({ email, password })
  return Boolean(second.data.session)
}

/**
 * Brings the data client up for this session. Idempotent and safe to call again
 * after a credential change — it always rebuilds from what is stored right now.
 */
export async function connectData(session: Session | null): Promise<ConnectOutcome> {
  if (!session) {
    client = null
    setState({ status: 'idle', projectRef: '', failure: null })
    return { ok: false, reason: 'unconfigured' }
  }

  // ---- the owner --------------------------------------------------------
  if (isOwnerIdentity(session.user)) {
    client = authClient
    setState({ status: 'owner', projectRef: projectRefFrom(AUTH_PROJECT_URL), failure: null })
    return { ok: true, owner: true }
  }

  const stored = readStoredConnection()
  // A connection saved by somebody else on this device is not this account's to
  // use — see the note on StoredConnection.userId. Sent to setup, not to an
  // error: from where they are standing there simply isn't one yet.
  if (!stored || stored.userId !== session.user.id) {
    client = null
    setState({ status: 'unconfigured', projectRef: '', failure: null })
    return { ok: false, reason: 'unconfigured' }
  }

  const url = normaliseProjectUrl(stored.url)
  if (!url || !classifyAnonKey(stored.anonKey).ok) {
    client = null
    setState({ status: 'error', projectRef: '', failure: 'invalid' })
    return { ok: false, reason: 'invalid' }
  }

  setState({ status: 'connecting', projectRef: projectRefFrom(url), failure: null })

  const candidate = buildClient({ url, anonKey: stored.anonKey })

  try {
    if (!(await schemaPresent(candidate))) {
      client = null
      setState({ status: 'error', failure: 'schema' })
      return { ok: false, reason: 'schema' }
    }

    const password = await derivePassword(session.user.id, projectRefFrom(url))
    const signedIn = await ensureSignedIn(candidate, deriveEmail(session), password)
    if (!signedIn) {
      client = null
      setState({ status: 'error', failure: 'auth' })
      return { ok: false, reason: 'auth' }
    }
  } catch {
    client = null
    setState({ status: 'error', failure: 'network' })
    return { ok: false, reason: 'network' }
  }

  client = candidate
  setState({ status: 'ready', failure: null })
  return { ok: true, owner: false }
}

/**
 * Drops the service worker's cached Supabase responses.
 *
 * The runtime cache in vite.config.ts is NetworkFirst over /rest/v1 and
 * /storage/v1 so already-loaded data can still be read with no signal. That is a
 * feature while you are signed in and a small leak once you are not — a shared
 * phone would otherwise keep a readable copy of the last account's rows. Leaving
 * is exactly the moment to throw it away.
 */
async function purgeDataCaches(): Promise<void> {
  if (typeof caches === 'undefined') return
  try {
    for (const name of await caches.keys()) {
      if (name.includes('supabase')) await caches.delete(name)
    }
  } catch {
    /* No Cache Storage here (private mode, or an older browser). Nothing cached. */
  }
}

/** Tears the data client down — on sign-out, and before switching projects. */
export async function resetDataClient(): Promise<void> {
  const previous = client
  client = null
  setState({ status: 'idle', projectRef: '', failure: null })
  await purgeDataCaches()
  // Never sign the OWNER out of their own session as a side effect: for them the
  // data client and the auth client are the same object.
  if (previous && previous !== authClient) {
    try {
      // Local scope only: a global sign-out would revoke this user's refresh
      // tokens on their OTHER devices, which is not what leaving a page means.
      await previous.auth.signOut({ scope: 'local' })
    } catch {
      /* Already gone, or offline. Dropping the reference is what mattered. */
    }
  }
}

/* -------------------------------------------------------------------------- */
/* Test Connection                                                             */
/* -------------------------------------------------------------------------- */

export type ConnectionTest = { ok: true } | { ok: false; message: string }

/**
 * The setup flow's "Test Connection" button: a real round trip against the
 * project the user just pasted — schema present, sign-in works, and a write
 * followed by a read of that same row comes back.
 *
 * Pass or fail, deliberately. Interpreting Postgres error codes for someone who
 * has never seen Supabase before would produce a wall of text where the correct
 * advice is always the same sentence: go back and check the steps.
 */
export async function testConnection(
  rawUrl: string,
  rawKey: string,
  session: Session | null
): Promise<ConnectionTest> {
  const failed = 'Could not connect. Go back and check the steps above, then try again.'

  if (!session) return { ok: false, message: 'You are signed out. Sign in again and retry.' }

  const url = normaliseProjectUrl(rawUrl)
  if (!url) return { ok: false, message: failed }
  const verdict = classifyAnonKey(rawKey)
  if (!verdict.ok) return { ok: false, message: verdict.reason }

  const candidate = buildClient({ url, anonKey: rawKey.trim() }, true)

  try {
    if (!(await schemaPresent(candidate))) return { ok: false, message: failed }

    const password = await derivePassword(session.user.id, projectRefFrom(url))
    if (!(await signInToDataProject(candidate, deriveEmail(session), password))) {
      return { ok: false, message: failed }
    }

    const { data: who } = await candidate.auth.getUser()
    if (!who.user) return { ok: false, message: failed }

    const write = await candidate
      .from('meridian_connection_check')
      .upsert({ user_id: who.user.id, checked_at: new Date().toISOString() }, { onConflict: 'user_id' })
    if (write.error) return { ok: false, message: failed }

    const read = await candidate.from('meridian_connection_check').select('user_id').eq('user_id', who.user.id).limit(1)
    if (read.error || !read.data || read.data.length === 0) return { ok: false, message: failed }

    return { ok: true }
  } catch {
    return { ok: false, message: failed }
  } finally {
    // The tester is throwaway. Leaving its session behind would leave a second
    // token in storage under the same key the real client uses.
    try {
      await candidate.auth.signOut({ scope: 'local' })
    } catch {
      /* nothing held */
    }
  }
}

export type { StoredConnection }
