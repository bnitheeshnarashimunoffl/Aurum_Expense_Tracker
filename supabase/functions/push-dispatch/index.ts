// Meridian — scheduled push dispatcher (Supabase Edge Function, Deno).
//
// WHY THIS EXISTS: notifications have to fire at exact clock times with the app
// completely closed. That rules out every client-side timer — setTimeout dies
// with the tab, and Background Sync / Periodic Background Sync do not exist on
// iOS at all. The only mechanism that survives a closed app on both platforms is
// a server that decides, on its own schedule, to push. This is that server.
//
// HOW IT IS INVOKED: pg_cron calls it once a minute (supabase/notifications_cron.sql).
// Once a minute rather than once an hour so that "30 minutes before class" is
// exact for a class starting at any minute, and so a single missed tick is not a
// missed day. Duplicate sends are impossible regardless of how often it runs —
// see the claim() helper below.
//
// WHY THE SERVICE ROLE KEY: this function has no user. It is woken by a cron job
// and has to look at every enabled user's data to decide what to send, which is
// precisely what Row Level Security forbids an anon key from doing. That makes it
// the one privileged thing in this project, so it is kept narrow: it is gated on
// a shared secret, it only ever READS module data, and the only table it writes
// is the notification log (plus deleting subscriptions the push service has told
// us are dead). It never reads chronicle_notes — Secret Notes are not consulted
// by this system anywhere.
//
// EXTERNAL DATA — who this function will not send to, and why.
//
// Everyone except the owner keeps their module data in a Supabase project of
// their own. This server holds no credentials for those projects and never will:
// the credentials live on the user's device and are deliberately never sent
// anywhere the developer controls, which is the promise the whole setup flow is
// built on. Reading someone's habits or to-dos from here is therefore not
// something that was lost — it is something that must not happen.
//
// An earlier revision tried to send those accounts a DEGRADED set: the water
// reminder without the day's total, the study check-in without the hours, the
// gym question without knowing whether the gym had already happened. That was
// wrong. Every one of those notifications exists to say something specific about
// your day; stripped of the specifics they are the generic "Reminder!" this
// system was built to avoid, and two of the five could not be sent at all. Three
// visibly stupider reminders plus two silent absences reads as a broken app, not
// a considerate one.
//
// So: accounts marked external_data are excluded from dispatch entirely. The
// query below filters them out before anything else happens, which also means
// this function never spends a row read on them. The settings screen tells them
// plainly that reminders are not available for shared instances yet, which is
// honest and finishes the sentence.
//
// The owner is unaffected. Every reminder below still carries its real numbers.
//
// Deploy:  supabase functions deploy push-dispatch --no-verify-jwt
// Secrets: supabase secrets set VAPID_PUBLIC_KEY=... VAPID_PRIVATE_KEY=... VAPID_SUBJECT=mailto:you@example.com CRON_SECRET=...
//
// This file is Deno, not part of the Vite app: tsconfig.json only includes `src`,
// so `npm run build` neither type-checks nor bundles it.

// @ts-nocheck — Deno globals and the esm.sh import are resolved by the Supabase
// Edge runtime, not by this repo's TypeScript config.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4'
import { sendPush, vapidFromEnv, type PushSubscription } from '../_shared/webpush.ts'
import { localClock, hhmmToMinutes, formatClockTime, type LocalClock } from '../_shared/localtime.ts'
import {
  chronicleTodosCopy,
  kindleWaterCopy,
  loomClassCopy,
  vigilStudyCopy,
  virtusGymCopy,
  type NotificationCopy,
} from '../_shared/copy.ts'

/* -------------------------------------------------------------------------- */
/* Schedule constants — every one of these is in the USER'S local time.        */
/* -------------------------------------------------------------------------- */

/** Water reminders are silenced from midnight to 6am. Nobody wants 3am hydration. */
const WATER_HOURS = { from: 6, to: 23 }
/** Every two hours, across the part of the day someone might actually study. */
const VIGIL_HOURS = [8, 10, 12, 14, 16, 18, 20, 22]
const VIRTUS_HOUR = 18
const CHRONICLE_HOURS = [10, 14, 18, 22]
const CLASS_LEAD_MINUTES = 30

/**
 * Tolerance for a cron tick that did not land exactly on the minute. Each
 * notification is allowed to fire across a three-minute window; the log's unique
 * key means only the first of those minutes can ever send, so this buys
 * resilience against a skipped tick with no risk of a double nudge.
 */
const MINUTE_TOLERANCE = 2

/**
 * Minutes past the hour each module aims for, and the reason this is not all
 * zero: at 6pm, Kindle (hourly), Vigil (two-hourly), Virtus (6pm) and Chronicle
 * (6pm) can all come due in the same instant. Four notifications arriving
 * together is how a person learns to swipe them all away and then turn the whole
 * feature off — the exact failure this system is meant to avoid.
 *
 * Staggering them a few minutes apart costs nothing against the spec (a nudge at
 * 18:06 is "6pm" to anybody) and turns a pile-up into a sequence. Kindle keeps
 * :00 because "every hour, on the hour" is what it is.
 */
const MINUTE_OFFSET = {
  kindle_water: 0,
  vigil_study: 3,
  virtus_gym: 6,
  chronicle_todos: 9,
} as const

const DAILY_TARGET_SECONDS = 5 * 60 * 60

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-cron-secret',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } })
}

/* -------------------------------------------------------------------------- */

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })

  const cronSecret = Deno.env.get('CRON_SECRET')
  if (!cronSecret) {
    return json(
      { error: 'CRON_SECRET is not set on this Supabase project. Run: supabase secrets set CRON_SECRET=your_random_string' },
      500
    )
  }
  // Deployed with --no-verify-jwt (pg_cron has no user session to present), so
  // this header is the whole door. Without it, anyone who found the function URL
  // could make it send.
  if (req.headers.get('x-cron-secret') !== cronSecret) {
    return json({ error: 'Forbidden' }, 403)
  }

  let vapid
  try {
    vapid = vapidFromEnv((key) => Deno.env.get(key))
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : String(err) }, 500)
  }

  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
    auth: { persistSession: false },
  })

  const now = new Date()
  const report = { checked: 0, sent: 0, skipped: 0, pruned: 0, errors: [] as string[] }

  const { data: settingsRows, error: settingsError } = await supabase
    .from('meridian_notification_settings')
    .select('*')
    .eq('enabled', true)
    // The whole of the public-release change to this function. Accounts whose
    // module data lives in a Supabase project this server cannot read are
    // excluded here, at the source, rather than being sent something vaguer.
    // See the header comment for why degraded reminders were rejected.
    .eq('external_data', false)
  if (settingsError) return json({ error: `Could not read settings: ${settingsError.message}` }, 500)
  if (!settingsRows || settingsRows.length === 0) return json({ ...report, note: 'No users have notifications enabled.' })

  const userIds = settingsRows.map((s) => s.user_id)
  const { data: subRows, error: subsError } = await supabase
    .from('meridian_push_subscriptions')
    .select('*')
    .in('user_id', userIds)
  if (subsError) return json({ error: `Could not read subscriptions: ${subsError.message}` }, 500)

  const subsByUser = new Map<string, PushSubscription[]>()
  for (const row of subRows ?? []) {
    const list = subsByUser.get(row.user_id) ?? []
    list.push({ endpoint: row.endpoint, p256dh: row.p256dh, auth: row.auth })
    subsByUser.set(row.user_id, list)
  }

  /**
   * Claims the right to send one notification, and returns false if somebody
   * already has. The insert IS the lock: the unique (user_id, kind, dedupe_key)
   * constraint means two overlapping runs cannot both succeed, so this is safe
   * without any transaction or advisory lock.
   */
  async function claim(userId: string, kind: string, dedupeKey: string): Promise<boolean> {
    const { data, error } = await supabase
      .from('meridian_notification_log')
      .upsert({ user_id: userId, kind, dedupe_key: dedupeKey }, { onConflict: 'user_id,kind,dedupe_key', ignoreDuplicates: true })
      .select('id')
    if (error) {
      report.errors.push(`claim ${kind}: ${error.message}`)
      return false
    }
    return (data?.length ?? 0) > 0
  }

  /** Fans one notification out to every device the user has enabled, cleaning up dead ones. */
  async function deliver(userId: string, copy: NotificationCopy, url: string, tag: string) {
    const subscriptions = subsByUser.get(userId) ?? []
    for (const subscription of subscriptions) {
      const result = await sendPush(subscription, { ...copy, url, tag }, vapid)
      if (result.ok) {
        report.sent++
        continue
      }
      if (result.gone) {
        // The push service says this browser is gone for good — uninstalled,
        // permission revoked, or the subscription rotated. Deleting it here is the
        // entire expired-subscription cleanup story, because this is the only
        // place that ever finds out.
        await supabase.from('meridian_push_subscriptions').delete().eq('endpoint', subscription.endpoint)
        report.pruned++
      } else {
        report.errors.push(`send ${result.status}: ${result.detail ?? 'unknown'}`)
      }
    }
  }

  /** True when the local clock is inside one of these hours' send windows. */
  function inWindow(clock: LocalClock, hours: number[], offset: number): boolean {
    return hours.includes(clock.hour) && clock.minute >= offset && clock.minute <= offset + MINUTE_TOLERANCE
  }

  for (const settings of settingsRows) {
    const userId = settings.user_id
    if ((subsByUser.get(userId) ?? []).length === 0) continue
    report.checked++

    let clock: LocalClock
    try {
      clock = localClock(now, settings.timezone)
    } catch {
      report.errors.push(`Unknown timezone "${settings.timezone}" for user ${userId}`)
      continue
    }

    /* ---------------------------------------------------------------- Kindle */
    const waterHour = clock.hour >= WATER_HOURS.from && clock.hour <= WATER_HOURS.to
    if (settings.kindle_water && waterHour && clock.minute <= MINUTE_OFFSET.kindle_water + MINUTE_TOLERANCE) {
      const copy = kindleWaterCopy(clock.hour, await waterProgress(supabase, userId, clock.date))
      if (await claim(userId, 'kindle_water', `${clock.date}:${clock.hour}`)) {
        await deliver(userId, copy, '/kindle', 'kindle-water')
      } else report.skipped++
    }

    /* ----------------------------------------------------------------- Vigil */
    if (settings.vigil_study && inWindow(clock, VIGIL_HOURS, MINUTE_OFFSET.vigil_study)) {
      const studied = await studiedSecondsToday(supabase, userId, clock.date, now)
      const copy = vigilStudyCopy(studied, clock.hour)
      // Target met — vigilStudyCopy returns null and nothing is sent or claimed.
      if (copy) {
        if (await claim(userId, 'vigil_study', `${clock.date}:${clock.hour}`)) {
          await deliver(userId, copy, '/vigil', 'vigil-study')
        } else report.skipped++
      }
    }

    /* ------------------------------------------------------------------ Loom */
    if (settings.loom_classes) {
      for (const upcoming of await classesStartingSoon(supabase, userId, clock)) {
        const copy = loomClassCopy(upcoming.title, upcoming.startsAt, upcoming.location)
        if (await claim(userId, 'loom_class', `${clock.date}:${upcoming.slotId}`)) {
          await deliver(userId, copy, '/loom', `loom-${upcoming.slotId}`)
        } else report.skipped++
      }
    }

    /* ---------------------------------------------------------------- Virtus */
    if (settings.virtus_gym && inWindow(clock, [VIRTUS_HOUR], MINUTE_OFFSET.virtus_gym)) {
      const check = await virtusCheck(supabase, userId, clock)
      if (check.shouldAsk) {
        const copy = virtusGymCopy(check.scheduledSplitName, Number(clock.date.slice(-2)))
        if (await claim(userId, 'virtus_gym', clock.date)) {
          await deliver(userId, copy, '/virtus', 'virtus-gym')
        } else report.skipped++
      }
    }

    /* ------------------------------------------------------------- Chronicle */
    if (settings.chronicle_todos && inWindow(clock, CHRONICLE_HOURS, MINUTE_OFFSET.chronicle_todos)) {
      const titles = await todosDueToday(supabase, userId, clock.date)
      // Never an empty "you have 0 tasks" — no rows means no notification.
      if (titles.length > 0) {
        const copy = chronicleTodosCopy(titles, clock.hour)
        if (await claim(userId, 'chronicle_todos', `${clock.date}:${clock.hour}`)) {
          await deliver(userId, copy, '/chronicle', 'chronicle-todos')
        } else report.skipped++
      }
    }
  }

  return json(report)
})

/* -------------------------------------------------------------------------- */
/* Per-module data lookups. Each one mirrors the derivation the module's own UI */
/* does, so a notification can never disagree with the screen it links to.      */
/* -------------------------------------------------------------------------- */

/**
 * Today's water habit progress, expressed in the real-world quantity the habit
 * is configured with rather than a raw stage number — "2L down, 2L to go" is the
 * same arithmetic Kindle's log sheet shows (src/kindle/lib/quantity.ts).
 *
 * The water habit is found by label rather than by a hardcoded id because habits
 * are user-owned rows that can be renamed or recreated; returning null when there
 * is no such habit is a supported outcome, not a failure.
 */
async function waterProgress(supabase, userId: string, date: string) {
  const { data: habits } = await supabase
    .from('kindle_habits')
    .select('id, label, max_stage, target_value, target_unit')
    .eq('user_id', userId)
    .eq('active', true)
  const water = (habits ?? []).find((h) => h.label.toLowerCase().includes('water'))
  if (!water || !water.target_value || water.max_stage <= 0) return null

  const { data: logs } = await supabase
    .from('kindle_habit_logs')
    .select('stage')
    .eq('user_id', userId)
    .eq('habit_id', water.id)
    .eq('date', date)
  const stage = logs?.[0]?.stage ?? 0

  const unitRaw = (water.target_unit ?? '').trim().toLowerCase()
  const unit = unitRaw.startsWith('l') ? 'L' : unitRaw.startsWith('ml') ? 'ml' : unitRaw ? ` ${unitRaw}` : ''
  const scale = (n: number) => Math.round(((water.target_value * n) / water.max_stage) * 10) / 10

  return { logged: scale(stage), target: scale(water.max_stage), unit }
}

/**
 * Studied seconds today, including a session that is running RIGHT NOW.
 *
 * This has to recompute `accumulated_seconds + (now - running_since)` exactly the
 * way src/vigil/lib/time.ts does, or a notification would tell someone with a
 * three-hour session in progress that they have not started.
 */
async function studiedSecondsToday(supabase, userId: string, date: string, now: Date): Promise<number> {
  const { data } = await supabase
    .from('vigil_days')
    .select('accumulated_seconds, running_since')
    .eq('user_id', userId)
    .eq('date', date)
  const day = data?.[0]
  if (!day) return 0
  const live = day.running_since ? Math.max(0, (now.getTime() - new Date(day.running_since).getTime()) / 1000) : 0
  return Math.max(0, day.accumulated_seconds + live)
}

interface UpcomingClass {
  slotId: string
  title: string
  location: string
  startsAt: string
}

/**
 * Classes starting in ~30 minutes, resolved through Loom's real semester logic:
 * the active term, whether today falls inside it, and the schedule BLOCK in
 * effect today (the latest block whose effective_from is on or before today).
 * Saturday is day index 5 and is read from the block's assignments like any other
 * day, which is exactly what makes its independently-edited schedule correct here.
 *
 * Reads the Supabase mirror rather than IndexedDB, which is the only copy a
 * server can see. A term edited offline and never synced therefore cannot produce
 * reminders — see SETUP.md, where that is called out.
 */
async function classesStartingSoon(supabase, userId: string, clock: LocalClock): Promise<UpcomingClass[]> {
  // Loom has no Sunday column at all — it is a class timetable, not a calendar.
  if (clock.weekdayMon0 > 5) return []

  const { data: terms } = await supabase
    .from('loom_terms')
    .select('id, start_date, end_date, is_active, deleted')
    .eq('user_id', userId)
    .eq('is_active', true)
    .eq('deleted', false)
  const term = terms?.[0]
  if (!term) return []
  if (clock.date < term.start_date || clock.date > term.end_date) return []

  const [{ data: slots }, { data: blocks }, { data: presets }] = await Promise.all([
    supabase.from('loom_time_slots').select('id, start_time, deleted').eq('user_id', userId).eq('term_id', term.id).eq('deleted', false),
    supabase
      .from('loom_schedule_blocks')
      .select('id, effective_from, assignments, deleted')
      .eq('user_id', userId)
      .eq('term_id', term.id)
      .eq('deleted', false),
    supabase.from('loom_class_presets').select('id, title, location, deleted').eq('user_id', userId).eq('term_id', term.id).eq('deleted', false),
  ])

  // Same rule as src/loom/lib/schedule.ts blockInEffect(): the latest block that
  // has already started, falling back to the earliest one before term begins.
  const ordered = [...(blocks ?? [])].sort((a, b) => a.effective_from.localeCompare(b.effective_from))
  if (ordered.length === 0) return []
  let block = ordered[0]
  for (const candidate of ordered) {
    if (candidate.effective_from <= clock.date) block = candidate
    else break
  }

  const dayAssignments = (block.assignments ?? {})[String(clock.weekdayMon0)] ?? {}
  const presetById = new Map((presets ?? []).map((p) => [p.id, p]))

  const out: UpcomingClass[] = []
  for (const slot of slots ?? []) {
    const presetId = dayAssignments[slot.id]
    if (!presetId) continue
    const preset = presetById.get(presetId)
    if (!preset) continue

    const startMinutes = hhmmToMinutes(slot.start_time)
    if (startMinutes === null) continue
    const lead = startMinutes - clock.minutesOfDay
    // Fires at exactly 30 minutes out, with 29 and 28 as catch-ups for a cron
    // tick that was skipped. Never early — a reminder ahead of its own lead time
    // is worse than one a minute late.
    if (lead > CLASS_LEAD_MINUTES || lead < CLASS_LEAD_MINUTES - MINUTE_TOLERANCE) continue

    out.push({
      slotId: slot.id,
      title: preset.title,
      location: preset.location ?? '',
      startsAt: formatClockTime(slot.start_time),
    })
  }
  return out
}

/**
 * Whether to ask about the gym at all, and what the schedule suggests if so.
 * A session that exists — training OR an explicitly logged rest day — means the
 * question has already been answered, and nothing is sent.
 */
async function virtusCheck(supabase, userId: string, clock: LocalClock) {
  const { data: sessions } = await supabase
    .from('virtus_sessions')
    .select('id, is_rest_day')
    .eq('user_id', userId)
    .eq('date', clock.date)
  if ((sessions?.length ?? 0) > 0) return { shouldAsk: false, scheduledSplitName: null }

  const { data: schedule } = await supabase
    .from('virtus_schedule')
    .select('day_of_week, split_day_id')
    .eq('user_id', userId)
    .eq('day_of_week', clock.weekdayMon0)
  const entry = schedule?.[0]
  // A scheduled rest day is not a day to nag about training.
  if (entry && entry.split_day_id === null) return { shouldAsk: false, scheduledSplitName: null }
  if (!entry?.split_day_id) return { shouldAsk: true, scheduledSplitName: null }

  const { data: splitDays } = await supabase.from('virtus_split_days').select('name').eq('id', entry.split_day_id)
  return { shouldAsk: true, scheduledSplitName: splitDays?.[0]?.name ?? null }
}

/**
 * Incomplete to-dos due today. Only chronicle_todos is touched — chronicle_notes
 * is never read by this function, so a Secret Note cannot reach a notification
 * even by accident.
 */
async function todosDueToday(supabase, userId: string, date: string): Promise<string[]> {
  const { data } = await supabase
    .from('chronicle_todos')
    .select('title, priority')
    .eq('user_id', userId)
    .eq('due_date', date)
    .eq('is_complete', false)
  const rank = { HIGH: 0, MEDIUM: 1, LOW: 2 }
  // Highest priority first, so the two titles that fit in the body are the two
  // that matter most.
  return [...(data ?? [])].sort((a, b) => rank[a.priority] - rank[b.priority]).map((t) => t.title)
}
