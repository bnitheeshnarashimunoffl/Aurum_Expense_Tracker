// The words. Kept in one file, away from the scheduling logic, because a
// notification's copy is the whole product surface — it is the only part of
// Meridian most of these ever show anyone — and it deserves to be read and
// edited as writing rather than as string literals buried in a loop.
//
// Three rules everything below obeys:
//   1. Never generic. "Reminder!" and "Don't forget!" train a person to swipe.
//      Every line here says something specific about this day.
//   2. Never guilt. Vigil in particular is one bad sentence away from nagging;
//      it acknowledges what has been done before mentioning what has not.
//   3. Short enough to survive a lock screen, which truncates around 40-50
//      characters of title on iOS.

export interface NotificationCopy {
  title: string
  body: string
}

/** Rotates deterministically, so two checks an hour apart never read identically. */
function pick<T>(options: T[], seed: number): T {
  return options[((seed % options.length) + options.length) % options.length]
}

function duration(seconds: number): string {
  const total = Math.max(0, Math.round(seconds))
  const hours = Math.floor(total / 3600)
  const minutes = Math.round((total % 3600) / 60)
  if (hours === 0) return `${minutes}m`
  if (minutes === 0) return `${hours}h`
  return `${hours}h ${minutes}m`
}

/* -------------------------------------------------------------------------- */
/* Kindle — hourly water                                                       */
/* -------------------------------------------------------------------------- */

const WATER_LINES = [
  'Water. Now is as good a time as any.',
  'One glass, then back to whatever this is.',
  'Top up — sixty seconds, tops.',
  'Quick one: go drink something.',
  'Refill. Then log it and forget about it.',
  'A glass now beats four at midnight.',
  'Hydration check. Go on.',
  'Water break — you have earned the walk to the tap.',
]

/**
 * The title carries the nudge and the body carries the day's actual number, so
 * the notification is specific even at a glance. When there is no water habit to
 * count against, the body says something true instead of inventing a statistic.
 */
export function kindleWaterCopy(
  hourSeed: number,
  progress: { logged: number; target: number; unit: string } | null
): NotificationCopy {
  const title = pick(WATER_LINES, hourSeed)
  if (!progress || progress.target <= 0) {
    return { title, body: 'Kindle is one tap away when you have.' }
  }
  if (progress.logged >= progress.target) {
    return { title: 'Target hit — keep sipping anyway.', body: `${progress.logged}${progress.unit} logged today. Anything past this is free.` }
  }
  const left = progress.target - progress.logged
  return {
    title,
    body: `${progress.logged}${progress.unit} down, ${left}${progress.unit} to go today.`,
  }
}

/* -------------------------------------------------------------------------- */
/* Vigil — study progress, every two hours                                     */
/* -------------------------------------------------------------------------- */

/**
 * The fallback when a week has no target of its own — the number Vigil used for
 * everybody before the target became settable. The real one is read per week from
 * `vigil_targets` and passed in.
 */
export const DEFAULT_TARGET_SECONDS = 5 * 60 * 60

/**
 * Three bands, and a fourth that sends nothing at all.
 *
 * The band boundaries matter more than the wording: congratulating someone on
 * "good progress" at eleven minutes reads as sarcasm, and "final stretch" at two
 * hours reads as a lie.
 *
 * The boundaries are now FRACTIONS of the target rather than fixed clock times,
 * because the target is the user's to choose. 45 minutes into a five-hour day is
 * a false start; 45 minutes into a ninety-minute day is half done, and being told
 * "starting is the whole trick" at that point would be insulting. 15% and 70% are
 * where the original 45m and 3h30 sat against five hours, so a five-hour target
 * behaves exactly as it always did.
 */
export function vigilStudyCopy(
  studiedSeconds: number,
  hourSeed: number,
  targetSeconds: number = DEFAULT_TARGET_SECONDS
): NotificationCopy | null {
  const target = targetSeconds > 0 ? targetSeconds : DEFAULT_TARGET_SECONDS
  if (studiedSeconds >= target) return null // Target met — say nothing. Ever.

  const remaining = target - studiedSeconds
  const done = duration(studiedSeconds)
  const left = duration(remaining)

  const full = duration(target)

  if (studiedSeconds < target * 0.15) {
    const title = pick(
      [`${full}, whenever you are ready`, `Today’s ${full} is still ahead`, 'The clock is waiting'],
      hourSeed
    )
    const body =
      studiedSeconds === 0
        ? `Nothing on the clock yet — ${left} against today’s target. Starting is the whole trick.`
        : `${done} in, ${left} to go. Pick it back up when you can.`
    return { title, body }
  }

  if (studiedSeconds < target * 0.7) {
    const title = pick([`${done} on the clock`, 'That is real time logged', 'Good stretch behind you'], hourSeed)
    return { title, body: `${left} left against ${full}. No rush — the timer holds its place.` }
  }

  const title = pick([`Final stretch — ${left} left`, `${left} between you and done`, `Almost ${full}`], hourSeed)
  return { title, body: pick(['One more sitting closes it out.', 'This is the easy part now.', `${done} down already.`], hourSeed) }
}

/* -------------------------------------------------------------------------- */
/* Loom — 30 minutes before a class                                            */
/* -------------------------------------------------------------------------- */

export function loomClassCopy(className: string, startsAt: string, location: string): NotificationCopy {
  return {
    title: `${className} in 30 minutes`,
    body: location.trim() ? `${startsAt} · ${location.trim()}` : `Starts at ${startsAt}`,
  }
}

/* -------------------------------------------------------------------------- */
/* Virtus — 6pm, only when nothing has been logged                             */
/* -------------------------------------------------------------------------- */

/**
 * A check-in, not a command. The schedule's own suggestion goes in the body when
 * there is one, because "Push Day is what's on the schedule" is a far easier
 * thing to say yes to than "go to the gym".
 */
export function virtusGymCopy(scheduledSplitName: string | null, daySeed: number): NotificationCopy {
  const title = pick(['Training today?', 'Anything today?', 'Still time to train'], daySeed)
  const body = scheduledSplitName
    ? `Nothing logged yet — ${scheduledSplitName} is what the schedule has.`
    : 'Nothing logged yet. A short session still counts, and so does calling it a rest day.'
  return { title, body }
}

/* -------------------------------------------------------------------------- */
/* Chronicle — to-dos due today                                                */
/* -------------------------------------------------------------------------- */

function trim(title: string, max = 34): string {
  const clean = title.trim()
  return clean.length > max ? `${clean.slice(0, max - 1)}…` : clean
}

/**
 * Only ever called with at least one incomplete to-do due today — an empty
 * "you have 0 tasks" is the exact notification this system exists not to send.
 *
 * The late slot changes the framing rather than the facts: at 10pm "still open"
 * is the honest word, and "due today" has started to sound like an accusation.
 *
 * Secret Notes are not consulted here and are not consulted anywhere in this
 * system. Only chronicle_todos is read.
 */
export function chronicleTodosCopy(titles: string[], localHour: number): NotificationCopy {
  const count = titles.length
  const late = localHour >= 20

  if (count === 1) {
    return {
      title: late ? 'One still open today' : 'One thing due today',
      body: trim(titles[0], 60),
    }
  }

  const title = late ? `${count} still open today` : `${count} due today`
  const shown = titles.slice(0, 2).map((t) => trim(t))
  const body = count > 2 ? `${shown.join(' · ')} · +${count - 2} more` : shown.join(' · ')
  return { title, body }
}
