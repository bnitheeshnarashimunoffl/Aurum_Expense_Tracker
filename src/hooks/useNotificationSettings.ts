import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useDataConnection } from '@/context/DataContext'
import { subscribe, notify } from '@/lib/sync'

const CHANNEL = 'meridian_notification_settings'

/**
 * The per-module switches. Aurum is absent because Aurum has no notifications —
 * that is a design decision, not an oversight, and leaving it out of the type is
 * what stops a future toggle being added for it by accident.
 */
export interface NotificationSettings {
  enabled: boolean
  kindle_water: boolean
  vigil_study: boolean
  loom_classes: boolean
  virtus_gym: boolean
  chronicle_todos: boolean
  timezone: string
  /**
   * True when this account's module data lives in a Supabase project the push
   * server cannot read — which since the public release is everyone but the
   * owner. The dispatcher branches on it: some reminders lose their numbers, and
   * the two that ARE their data (Loom's classes, Chronicle's due list) are not
   * sent at all. Written by the client on every save rather than guessed at
   * server-side, because the client is the only thing that knows.
   */
  external_data: boolean
}

export type ModuleToggle = Exclude<keyof NotificationSettings, 'enabled' | 'timezone' | 'external_data'>

/**
 * Only ever rendered for an account whose data the dispatcher can actually read —
 * which since the public release means the owner's.
 *
 * There used to be a second "externalDetail" copy on each of these, describing
 * what the reminder became when the server could not see the data behind it. That
 * whole idea is gone: shared instances get no notifications rather than vaguer
 * ones, and the settings screen says so in one panel instead of five hedged
 * switches. See the header of supabase/functions/push-dispatch/index.ts.
 */
export const MODULE_TOGGLES: { key: ModuleToggle; module: string; label: string; detail: string }[] = [
  { key: 'kindle_water', module: 'Kindle', label: 'Water reminders', detail: 'Hourly, 6am to 11pm. Silent overnight.' },
  { key: 'vigil_study', module: 'Vigil', label: 'Study check-ins', detail: 'Every two hours, and nothing once the day’s target is met.' },
  { key: 'loom_classes', module: 'Loom', label: 'Class reminders', detail: '30 minutes before each class, with its room.' },
  { key: 'virtus_gym', module: 'Virtus', label: 'Gym check', detail: '6pm, only if nothing is logged for the day.' },
  { key: 'chronicle_todos', module: 'Chronicle', label: 'To-dos due today', detail: '10am, 2pm, 6pm and 10pm — only when something is actually due.' },
]

const DEFAULTS: NotificationSettings = {
  enabled: false,
  kindle_water: true,
  vigil_study: true,
  loom_classes: true,
  virtus_gym: true,
  chronicle_todos: true,
  timezone: 'Asia/Kolkata',
  external_data: false,
}

function currentTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || DEFAULTS.timezone
  } catch {
    return DEFAULTS.timezone
  }
}

/**
 * Reads and writes the row the DISPATCHER consults. Everything here is enforced
 * server-side: turning Kindle off means the cron never sends that notification,
 * rather than the notification arriving and being hidden. That is the difference
 * between a setting and a lie.
 *
 * The row is created lazily, on the first write — a user who never opens this
 * screen has no row, and the dispatcher's `where enabled = true` skips them,
 * which is the correct default for someone who has not asked for notifications.
 */
export function useNotificationSettings() {
  const [settings, setSettings] = useState<NotificationSettings>(DEFAULTS)
  const [exists, setExists] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const { status: dataStatus } = useDataConnection()

  const refresh = useCallback(async () => {
    const { data, error: queryError } = await supabase.from('meridian_notification_settings').select('*').limit(1)
    if (queryError) {
      setError(queryError.message)
    } else {
      const row = data?.[0]
      setExists(Boolean(row))
      setSettings(row ? { ...DEFAULTS, ...(row as NotificationSettings) } : DEFAULTS)
      setError(null)
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    refresh()
    return subscribe(CHANNEL, refresh)
  }, [refresh])

  /**
   * Every write carries the device's current IANA timezone. The dispatcher has no
   * other way to know what "6pm" means, and refreshing it on each save means
   * moving between zones fixes itself rather than needing a settings visit.
   */
  const save = useCallback(
    async (patch: Partial<NotificationSettings>) => {
      const { data: userData } = await supabase.auth.getUser()
      if (!userData.user) throw new Error('Not signed in')

      // external_data describes where the data IS, not something the user chose,
      // so it is stamped from the live connection rather than taken from the form.
      // Only once that connection has actually settled, though: writing it while
      // the client is still opening would mark the owner's own row as external
      // and quietly strip the numbers out of their notifications.
      const settled = dataStatus !== 'idle' && dataStatus !== 'connecting'
      const next = {
        ...settings,
        ...patch,
        timezone: currentTimeZone(),
        ...(settled ? { external_data: dataStatus !== 'owner' } : {}),
      }
      setSettings(next) // Optimistic: a toggle that lags behind the thumb feels broken.

      const { error: upsertError } = await supabase.from('meridian_notification_settings').upsert(
        { user_id: userData.user.id, ...next, updated_at: new Date().toISOString() },
        { onConflict: 'user_id' }
      )
      if (upsertError) {
        await refresh()
        throw upsertError
      }
      setExists(true)
      notify(CHANNEL)
    },
    [settings, refresh, dataStatus]
  )

  return { settings, exists, loading, error, save, refresh, deviceTimeZone: currentTimeZone() }
}
