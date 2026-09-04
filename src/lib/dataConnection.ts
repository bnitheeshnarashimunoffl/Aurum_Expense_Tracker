/**
 * The stored "which Supabase project holds my data" credential, and everything
 * needed to sanity-check one before it is used.
 *
 * WHERE IT LIVES: localStorage on the user's own device, and nowhere else. It is
 * never written to the developer's project and never sent to any server the
 * developer controls — the only thing that ever receives these values is the
 * user's own Supabase project, which is where they came from. That also means
 * there is no cross-device sync: a new phone, or cleared browser data, means
 * pasting the two values again. The setup flow says so out loud rather than
 * letting someone discover it later.
 */

const STORAGE_KEY = 'meridian.dataConnection.v1'

export interface StoredConnection {
  url: string
  anonKey: string
  /**
   * The Meridian account that saved this. Load-bearing, not bookkeeping.
   *
   * A phone gets handed around. Without this, signing out and letting somebody
   * else sign in would leave THEIR session pointed at YOUR Supabase project —
   * their rows would land in your database, on your quota, visible to you in
   * your own dashboard. Row Level Security would keep the two accounts apart
   * inside that project, which is not the same thing as it being none of your
   * business. A connection that does not match the signed-in account is treated
   * as no connection at all, and the new person is sent to set up their own.
   */
  userId: string
  savedAt: string
}

/* -------------------------------------------------------------------------- */
/* Storage                                                                     */
/* -------------------------------------------------------------------------- */

export function readStoredConnection(): StoredConnection | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<StoredConnection>
    if (typeof parsed?.url !== 'string' || typeof parsed?.anonKey !== 'string') return null
    if (!parsed.url || !parsed.anonKey) return null
    return {
      url: parsed.url,
      anonKey: parsed.anonKey,
      userId: typeof parsed.userId === 'string' ? parsed.userId : '',
      savedAt: parsed.savedAt ?? '',
    }
  } catch {
    // Private browsing, or a storage quota error. Treated as "not set up on this
    // device", which routes into the setup flow rather than failing obscurely.
    return null
  }
}

export function writeStoredConnection(connection: Omit<StoredConnection, 'savedAt'>): boolean {
  try {
    const record: StoredConnection = { ...connection, savedAt: new Date().toISOString() }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(record))
    return true
  } catch {
    // Private browsing with storage blocked. The in-memory client still works for
    // this session, so the caller keeps going and warns rather than failing.
    return false
  }
}

export function clearStoredConnection(): void {
  try {
    localStorage.removeItem(STORAGE_KEY)
  } catch {
    /* nothing to clear */
  }
}

/* -------------------------------------------------------------------------- */
/* Validation                                                                  */
/* -------------------------------------------------------------------------- */

/**
 * Tidies a pasted project URL into the exact form supabase-js wants.
 *
 * People paste all sorts of things here: the dashboard address they were looking
 * at, a URL with a trailing slash, or the bare project ref on its own. Everything
 * recoverable is recovered; everything else returns null so the form can say so
 * before a single request is made.
 */
export function normaliseProjectUrl(raw: string): string | null {
  let value = raw.trim()
  if (!value) return null

  // A bare project ref is unambiguous, so accept it.
  if (/^[a-z0-9]{16,32}$/.test(value)) return 'https://' + value + '.supabase.co'

  if (!/^https?:\/\//i.test(value)) value = 'https://' + value

  let parsed: URL
  try {
    parsed = new URL(value)
  } catch {
    return null
  }

  // The dashboard address is the single most common wrong paste. It carries the
  // project ref in its path, so it can be turned into the right answer instead of
  // being rejected.
  if (/(^|\.)supabase\.(com|green)$/i.test(parsed.hostname)) {
    const ref = parsed.pathname
      .split('/')
      .filter(Boolean)
      .find((part) => /^[a-z0-9]{16,32}$/.test(part))
    return ref ? 'https://' + ref + '.supabase.co' : null
  }

  if (!/^[a-z0-9-]+\.supabase\.(co|in)$/i.test(parsed.hostname)) return null
  // https only: the key is an authorization credential and must never travel in
  // the clear, whatever was pasted.
  return 'https://' + parsed.hostname.toLowerCase()
}

export function projectRefFrom(url: string): string {
  const match = /^https:\/\/([a-z0-9-]+)\./i.exec(url)
  return match ? match[1].toLowerCase() : ''
}

export type KeyVerdict =
  | { ok: true }
  | { ok: false; kind: 'service-role' | 'secret' | 'malformed'; reason: string }

/**
 * Checks that what was pasted into the key box is a publishable key, and — much
 * more importantly — that it is not a service_role key.
 *
 * This is the one genuinely dangerous mistake available in the whole setup flow.
 * A service_role key bypasses Row Level Security entirely, and pasting one into a
 * browser app would leave every row in that project readable by anyone who ever
 * got hold of the device. The legacy form of both keys is a JWT whose payload
 * names the role in plain text, so the wrong one can be caught here rather than
 * six months later.
 */
export function classifyAnonKey(raw: string): KeyVerdict {
  const value = raw.trim()
  if (!value) return { ok: false, kind: 'malformed', reason: 'Paste the anon public key.' }

  // Newer projects issue sb_publishable_… / sb_secret_… instead of JWTs.
  if (value.startsWith('sb_secret_')) {
    return {
      ok: false,
      kind: 'secret',
      reason: 'That is the secret key. Meridian needs the publishable one — the key labelled anon or public.',
    }
  }
  if (value.startsWith('sb_publishable_')) return { ok: true }

  const parts = value.split('.')
  if (parts.length !== 3 || !value.startsWith('eyJ')) {
    return { ok: false, kind: 'malformed', reason: 'That does not look like a Supabase key. Copy the whole thing.' }
  }

  let role = ''
  try {
    const padded = parts[1].replace(/-/g, '+').replace(/_/g, '/')
    const json = JSON.parse(atob(padded + '='.repeat((4 - (padded.length % 4)) % 4))) as { role?: string }
    role = String(json.role ?? '')
  } catch {
    // Undecodable payload: not something to guess at, and not proof of a
    // service_role key either. Let the connection test be the judge.
    return { ok: true }
  }

  if (role === 'service_role') {
    return {
      ok: false,
      kind: 'service-role',
      reason:
        'That is the service_role key. It would let anyone holding this device read everything in your project — use the anon public key instead.',
    }
  }
  return { ok: true }
}

/* -------------------------------------------------------------------------- */
/* Owner bypass                                                                */
/* -------------------------------------------------------------------------- */

/**
 * The developer's own account keeps using the auth project for data too, exactly
 * as it did before this split existed — no setup screen, no pasted credentials,
 * and every row they have ever written still exactly where it was.
 *
 * Identified by email (and/or user id) from a build-time variable rather than by
 * anything the browser can assert, so it cannot be claimed by a visitor: the
 * email on a session is issued by Supabase Auth and addresses are unique within a
 * project. Set VITE_OWNER_EMAIL in .env.local and in Vercel.
 */
function splitList(value: string | undefined): string[] {
  return (value ?? '')
    .split(',')
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean)
}

const OWNER_EMAILS = splitList(import.meta.env.VITE_OWNER_EMAIL as string | undefined)
const OWNER_USER_IDS = splitList(import.meta.env.VITE_OWNER_USER_ID as string | undefined)

export function isOwnerIdentity(identity: { id?: string | null; email?: string | null } | null | undefined): boolean {
  if (!identity) return false
  const email = (identity.email ?? '').trim().toLowerCase()
  const id = (identity.id ?? '').trim().toLowerCase()
  if (email && OWNER_EMAILS.includes(email)) return true
  if (id && OWNER_USER_IDS.includes(id)) return true
  return false
}

/** True when this build has been told who the owner is at all. */
export const ownerConfigured = OWNER_EMAILS.length > 0 || OWNER_USER_IDS.length > 0
