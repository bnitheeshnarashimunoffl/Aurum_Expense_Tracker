import { useCallback, useEffect, useRef, useState } from 'react'
import { db as supabase } from '@/lib/dataClient'
import { subscribe, notify } from '@/lib/sync'
import type { VigilDay } from '../lib/types'

/** Day rows in a date range, newest state first-class: the caller owns the range. */
export function useVigilDays(range: { from: string; to: string }) {
  const [days, setDays] = useState<VigilDay[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const loadedOnce = useRef(false)

  const refresh = useCallback(async () => {
    // Only the first fetch shows a spinner; later refetches land under an already
    // correct optimistic view, and blinking the chart away mid-tick looks broken.
    if (!loadedOnce.current) setLoading(true)
    const { data, error: queryError } = await supabase
      .from('vigil_days')
      .select('*')
      .gte('date', range.from)
      .lte('date', range.to)
    if (!queryError && data) {
      setDays(data as VigilDay[])
      setError(null)
    } else if (queryError) {
      setError(queryError.message)
    }
    loadedOnce.current = true
    setLoading(false)
  }, [range.from, range.to])

  useEffect(() => {
    loadedOnce.current = false
    refresh()
    return subscribe('vigil_days', refresh)
  }, [refresh])

  /** Local patch so the chart and dial move on the same frame as the tap. */
  const patchLocal = useCallback((date: string, patch: Partial<VigilDay>) => {
    setDays((prev) => {
      const i = prev.findIndex((d) => d.date === date)
      if (i === -1) {
        return [
          ...prev,
          {
            id: `optimistic:${date}`,
            user_id: '',
            date,
            accumulated_seconds: 0,
            running_since: null,
            edited_after_the_fact: false,
            created_at: '',
            updated_at: '',
            ...patch,
          } as VigilDay,
        ]
      }
      const next = prev.slice()
      next[i] = { ...next[i], ...patch }
      return next
    })
  }, [])

  /** Upsert on (user_id, date) — one row per day, created lazily on first use. */
  const writeDay = useCallback(
    async (date: string, patch: Partial<VigilDay>) => {
      patchLocal(date, patch)
      const { data: userData } = await supabase.auth.getUser()
      if (!userData.user) {
        await refresh()
        throw new Error('Not signed in')
      }
      const { error: upsertError } = await supabase.from('vigil_days').upsert(
        { user_id: userData.user.id, date, ...patch, updated_at: new Date().toISOString() },
        { onConflict: 'user_id,date' }
      )
      if (upsertError) {
        await refresh()
        throw upsertError
      }
      notify('vigil_days')
    },
    [patchLocal, refresh]
  )

  return { days, loading, error, refresh, writeDay, patchLocal }
}
