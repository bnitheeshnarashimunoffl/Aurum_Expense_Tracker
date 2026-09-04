import { createClient } from '@supabase/supabase-js'

/**
 * THE AUTH CLIENT — Meridian's own Supabase project, fixed at build time.
 *
 * Since the public release, Meridian talks to TWO Supabase projects and the split
 * is the single most important thing to understand about this codebase:
 *
 *   • This client (the "auth project") holds identity and nothing else: sign-up,
 *     sign-in, sessions, password reset, plus the three small platform tables the
 *     push server has to be able to read across all users (push subscriptions,
 *     notification settings, the send log) and the walkthrough state. It is the
 *     developer's project, and it is what makes real signup counts visible in
 *     their dashboard.
 *
 *   • The DATA client (src/lib/dataClient.ts) holds everything else — every table
 *     of all six modules — and points at a Supabase project the USER owns and
 *     pays nothing for. See that file for how it is built.
 *
 * Rule of thumb for which to import:
 *   auth, sessions, notifications, walkthroughs, Edge Functions  ->  this file
 *   anything a module stores                                     ->  dataClient
 */

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

if (!url || !anonKey) {
  // Dev-only: on a deployed build this would be noise in a stranger's console,
  // and it names internals that a visitor has no use for.
  if (import.meta.env.DEV) {
    console.warn(
      'Missing VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY — copy .env.local.example to .env.local and fill in your project values.'
    )
  }
}

/** The auth project's URL, exported so the data client can tell "same project" apart. */
export const AUTH_PROJECT_URL = (url || '').replace(/\/+$/, '')

// Falls back to a syntactically valid placeholder so the client can construct (and the app
// shell can render) before a real Supabase project is configured — real calls will just fail.
export const supabase = createClient(url || 'https://placeholder.supabase.co', anonKey || 'placeholder-anon-key')

/** Explicit alias, for call sites where "which client is this?" should be unmissable. */
export const authClient = supabase
