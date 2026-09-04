import { useCallback, useEffect, useState } from 'react'
import { db as supabase } from '@/lib/dataClient'
import { generateSalt, hashPin } from '@/lib/pin'

interface PinRow {
  pin_hash: string
  pin_salt: string
}

/**
 * Load / set / verify a module's 4-digit PIN. The storage shape is identical across
 * modules (user_id + salted SHA-256), so only the table name differs — Kindle passes
 * 'kindle_pin', Vigil passes 'vigil_pin'. Each module keeps its own row, so the two
 * PINs can differ; the logic is shared rather than copied.
 *
 * As in Kindle: a 4-digit PIN is deliberate UI friction against accidental edits,
 * not the security boundary. Supabase auth + RLS are.
 */
export function usePinTable(table: string) {
  const [pinRow, setPinRow] = useState<PinRow | null | undefined>(undefined)

  const refresh = useCallback(async () => {
    const { data } = await supabase.from(table).select('pin_hash, pin_salt').maybeSingle()
    setPinRow((data as PinRow | null) ?? null)
  }, [table])

  useEffect(() => {
    refresh()
  }, [refresh])

  async function setPin(pin: string) {
    const { data: userData } = await supabase.auth.getUser()
    if (!userData.user) throw new Error('Not signed in')
    const salt = generateSalt()
    const hash = await hashPin(pin, salt)
    const { error } = await supabase.from(table).upsert({ user_id: userData.user.id, pin_hash: hash, pin_salt: salt })
    if (error) throw error
    await refresh()
  }

  async function verifyPin(pin: string): Promise<boolean> {
    if (!pinRow) return false
    return (await hashPin(pin, pinRow.pin_salt)) === pinRow.pin_hash
  }

  return { loading: pinRow === undefined, hasPin: Boolean(pinRow), setPin, verifyPin }
}
