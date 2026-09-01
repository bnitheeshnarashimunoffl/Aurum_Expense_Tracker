import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { generateSalt, hashPin } from '../lib/pin'

interface PinRow {
  pin_hash: string
  pin_salt: string
}

export function useKindlePin() {
  const [pinRow, setPinRow] = useState<PinRow | null | undefined>(undefined)

  const refresh = useCallback(async () => {
    const { data } = await supabase.from('kindle_pin').select('pin_hash, pin_salt').maybeSingle()
    setPinRow((data as PinRow | null) ?? null)
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  async function setPin(pin: string) {
    const { data: userData } = await supabase.auth.getUser()
    if (!userData.user) throw new Error('Not signed in')
    const salt = generateSalt()
    const hash = await hashPin(pin, salt)
    const { error } = await supabase
      .from('kindle_pin')
      .upsert({ user_id: userData.user.id, pin_hash: hash, pin_salt: salt })
    if (error) throw error
    await refresh()
  }

  async function verifyPin(pin: string): Promise<boolean> {
    if (!pinRow) return false
    const hash = await hashPin(pin, pinRow.pin_salt)
    return hash === pinRow.pin_hash
  }

  return { loading: pinRow === undefined, hasPin: Boolean(pinRow), setPin, verifyPin }
}
