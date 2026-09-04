/// <reference types="vite/client" />

/**
 * Everything the browser bundle is allowed to know.
 *
 * The VITE_ prefix is the whole safety mechanism: Vite refuses to expose any
 * other variable to client code, which is why GROQ_API_KEY, VAPID_PRIVATE_KEY and
 * CRON_SECRET are deliberately unprefixed and are absent from this list. Nothing
 * secret belongs here — every value below ships to every visitor.
 */
interface ImportMetaEnv {
  /** Meridian's own Supabase project — auth only. Public by design. */
  readonly VITE_SUPABASE_URL: string
  readonly VITE_SUPABASE_ANON_KEY: string
  /**
   * The public half of the Web Push key pair. Shipping this is how Web Push
   * works; the private half never leaves the Supabase project's secrets.
   */
  readonly VITE_VAPID_PUBLIC_KEY?: string
  /**
   * Who skips the bring-your-own-Supabase setup and keeps using the auth project
   * for data. Comma-separated. Not a secret — knowing the address grants nothing,
   * since the match is against an email Supabase Auth issued, which no visitor
   * can claim.
   */
  readonly VITE_OWNER_EMAIL?: string
  /** The same bypass keyed by Supabase user id, for accounts without an address. */
  readonly VITE_OWNER_USER_ID?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
