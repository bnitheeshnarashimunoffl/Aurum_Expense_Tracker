import { supabase } from '@/lib/supabase'

/**
 * Google sign-in, and the small amount of URL handling it drags in with it.
 *
 * This is the AUTH project only. How somebody proved who they are has no bearing
 * on where their data lives: the data client still derives its own account inside
 * the user's own Supabase project from the Meridian user id, exactly as it does
 * for an email/password account (src/lib/dataClient.ts). Nothing here touches it.
 */

const ERROR_KEY = 'meridian.oauthError'

/**
 * Where Google sends the browser back to.
 *
 * The app root, deliberately, rather than a dedicated /auth/callback route. The
 * gates already downstream of `/` — RequireAuth, then RequireDataConnection — are
 * the same ones an email/password sign-in lands on, so an OAuth user is sorted
 * into "straight to the launcher" or "you still need to connect a database" by
 * exactly the logic that has always made that decision. A bespoke callback route
 * would be a second, parallel copy of it, waiting to disagree.
 */
function redirectTarget(): string {
  return `${window.location.origin}/`
}

/**
 * Hands off to Google. On success this call never returns — the browser is gone
 * before the promise settles — so only the failure path is worth handling.
 *
 * The session comes back in the URL fragment and is consumed by the auth client
 * itself: it is built with supabase-js's default `detectSessionInUrl: true`, and
 * is the only client in the app allowed to read tokens out of the URL (the data
 * client explicitly opts out, so it cannot race for them).
 */
export async function signInWithGoogle(): Promise<{ error: string | null }> {
  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: redirectTarget(),
      // Lets somebody who is signed into several Google accounts pick, instead
      // of being silently returned as whichever one Google considers current.
      queryParams: { prompt: 'select_account' },
    },
  })
  return { error: error ? error.message : null }
}

/**
 * Lifts an OAuth failure out of the URL and puts it somewhere the login screen
 * can find it.
 *
 * Needed because a refused or cancelled sign-in comes back to `/` carrying
 * `?error=…` (or `#error=…`) and no session, at which point RequireAuth quite
 * correctly bounces to /login — a plain redirect, which drops the query string
 * and the fragment with it. Without this the whole failure is invisible and the
 * user is looking at a login form that has silently forgotten they just tried.
 *
 * Called once from main.tsx, synchronously, before React mounts. It strips only
 * the error keys, never `access_token` or `code`, so a SUCCESSFUL callback is
 * left exactly as the auth client expects to find it.
 */
export function captureOAuthError(): void {
  if (typeof window === 'undefined') return

  try {
    const url = new URL(window.location.href)
    // Errors arrive in the query string or the fragment depending on where the
    // request failed — Google's own refusals in one, Supabase's callback in the
    // other — so both are checked.
    const hash = new URLSearchParams(url.hash.startsWith('#') ? url.hash.slice(1) : url.hash)
    const description =
      url.searchParams.get('error_description') ?? hash.get('error_description')
    const code = url.searchParams.get('error') ?? hash.get('error')
    if (!description && !code) return

    sessionStorage.setItem(ERROR_KEY, friendly(description, code))

    for (const key of ['error', 'error_code', 'error_description']) {
      url.searchParams.delete(key)
      hash.delete(key)
    }
    const rest = hash.toString()
    url.hash = rest ? `#${rest}` : ''
    window.history.replaceState({}, '', url.toString())
  } catch {
    /* A URL we cannot parse is not worth breaking startup over. */
  }
}

/** Reads the stored failure and clears it, so it shows once and not on every visit. */
export function consumeOAuthError(): string | null {
  try {
    const message = sessionStorage.getItem(ERROR_KEY)
    if (message) sessionStorage.removeItem(ERROR_KEY)
    return message
  } catch {
    return null
  }
}

/**
 * Google's own wording is written for whoever built the OAuth client, not for
 * whoever just pressed a button. The two cases that are actually common get a
 * sentence each; everything else is passed through rather than guessed at.
 */
function friendly(description: string | null, code: string | null): string {
  const raw = (description ?? '').replace(/\+/g, ' ').trim()
  if (code === 'access_denied') return 'Google sign-in was cancelled.'
  if (code === 'server_error' || !raw) {
    return 'Google sign-in could not be completed. Try again, or use your email and password.'
  }
  return raw
}
