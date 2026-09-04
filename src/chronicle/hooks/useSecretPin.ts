import { useCallback, useEffect, useState } from 'react'
import { db as supabase } from '@/lib/dataClient'
import { notify, subscribe } from '@/lib/sync'
import { generateSalt, hashPin } from '@/lib/pin'
import { currentUserId } from '../lib/media'

const CHANNEL = 'chronicle_secret_pin'

/**
 * The Secret Notes PIN.
 *
 * Deliberately NOT built on src/hooks/usePinTable.ts, which Kindle, Vigil and
 * Virtus share. Those gate "are you sure you meant to edit history" and are
 * four digits entered on a keypad. This one gates a section whose existence is
 * itself meant to be unadvertised, and it is typed into the search field — where
 * a four-digit code would be reached by accident the first time you searched for
 * a year or an amount. So it is a free-form passphrase with its own table.
 *
 * It does share the salted-SHA-256 helpers in src/lib/pin.ts, and it inherits
 * their honest limitation: the notes are hidden, not encrypted. RLS scopes them
 * to the account, so anyone already holding this signed-in session could read
 * them out of the table directly. This locks the door on the section; it does
 * not put the notes in a safe.
 */

export const MIN_PIN_LENGTH = 4

/**
 * The bootstrap problem: the PIN is set from inside the section, and the section
 * is reached by typing the PIN. Before one exists there has to be some other way
 * in, so this word opens the setup screen — and ONLY while no PIN is set. Once
 * one exists, typing it is an ordinary search again.
 */
export const BOOTSTRAP_PHRASE = 'secret'

interface PinRow {
  pin_hash: string
  pin_salt: string
}

export function useSecretPin() {
  const [row, setRow] = useState<PinRow | null | undefined>(undefined)

  const refresh = useCallback(async () => {
    const { data } = await supabase
      .from('chronicle_secret_pin')
      .select('pin_hash, pin_salt')
      .maybeSingle()
    setRow((data as PinRow | null) ?? null)
  }, [])

  /**
   * On the shared sync bus like every other hook in Meridian, and it matters more
   * here than anywhere: TWO instances of this hook are alive whenever the section
   * is open — the one on the home screen that watches the search field for the PIN,
   * and the one inside the section that sets and changes it. Without this, setting a
   * PIN for the first time would update the section's copy and leave the home
   * screen's copy empty, so typing the brand-new PIN into the search field would do
   * nothing at all until a reload.
   */
  useEffect(() => {
    refresh()
    return subscribe(CHANNEL, refresh)
  }, [refresh])

  const hasPin = Boolean(row)
  const loading = row === undefined

  const verify = useCallback(
    async (candidate: string): Promise<boolean> => {
      if (!row || candidate.length < MIN_PIN_LENGTH) return false
      return (await hashPin(candidate, row.pin_salt)) === row.pin_hash
    },
    [row]
  )

  /** True for the phrase that opens first-time setup — only while no PIN is set. */
  const isBootstrap = useCallback(
    (candidate: string): boolean => !hasPin && candidate.trim().toLowerCase() === BOOTSTRAP_PHRASE,
    [hasPin]
  )

  async function setPin(pin: string) {
    if (pin.length < MIN_PIN_LENGTH) throw new Error(`Use at least ${MIN_PIN_LENGTH} characters`)
    const user_id = await currentUserId()
    const salt = generateSalt()
    const pin_hash = await hashPin(pin, salt)
    const { error } = await supabase
      .from('chronicle_secret_pin')
      .upsert({ user_id, pin_hash, pin_salt: salt, updated_at: new Date().toISOString() })
    if (error) throw error
    await refresh()
    notify(CHANNEL)
  }

  /** Changing it requires the current one, so an unlocked-and-walked-away session
   *  cannot be used to lock the owner out of their own notes. */
  async function changePin(current: string, next: string) {
    if (!(await verify(current))) throw new Error('Current PIN is not right')
    await setPin(next)
  }

  return { loading, hasPin, verify, isBootstrap, setPin, changePin, refresh }
}

/**
 * Re-locks the secret section whenever the app stops being in front of the user.
 * The brief requires exiting, navigating away or backgrounding to all re-lock, and
 * backgrounding is the one that is easy to miss: on a phone this module is left
 * open and put in a pocket far more often than it is deliberately closed.
 *
 * Nothing about "unlocked" is ever persisted, so a reload starts locked too.
 */
export function useAutoLock(unlocked: boolean, lock: () => void) {
  useEffect(() => {
    if (!unlocked) return
    const onHidden = () => {
      if (document.visibilityState === 'hidden') lock()
    }
    document.addEventListener('visibilitychange', onHidden)
    window.addEventListener('pagehide', lock)
    return () => {
      document.removeEventListener('visibilitychange', onHidden)
      window.removeEventListener('pagehide', lock)
    }
  }, [unlocked, lock])
}
