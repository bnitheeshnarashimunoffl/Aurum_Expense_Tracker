import type { ModuleKey, WalkthroughDefinition } from './types'

/**
 * Every walkthrough in Meridian, as content.
 *
 * The editorial rule for all of them: a step has to teach something a person
 * would not otherwise find. "This is the grid" is a caption. "Past days are
 * behind a PIN and ask for a reason" is a reason to trust the grid. Anything that
 * failed that test was cut, which is why none of these runs past five steps.
 *
 * Chronicle's Secret Notes are not mentioned anywhere here, deliberately. Its
 * entire value is that it is not advertised.
 */

export const WALKTHROUGHS: Record<ModuleKey, WalkthroughDefinition> = {
  meridian: {
    key: 'meridian',
    label: 'Meridian',
    steps: [
      {
        title: 'Six apps, one day',
        body: 'Money, habits, study, classes, training, and everything you meant to write down — all under one login, all in one place.',
      },
      {
        anchor: 'meridian-grid',
        title: 'Everything lives behind these six',
        body: 'Aurum for money. Kindle for habits. Vigil for study. Loom for classes. Virtus for the gym. Chronicle for notes and to-dos.',
      },
      {
        anchor: 'meridian-cards',
        title: 'The numbers come to you',
        body: 'Today’s balance, habits, study time and next class, without opening anything. Tap a card to go straight into that app.',
      },
      {
        title: 'One tap back out',
        body: 'Inside any app, the small sun at the top right sets behind the horizon and returns you here. It replaces the back button entirely.',
      },
      {
        anchor: 'meridian-settings',
        title: 'Meridian can nudge you',
        body: 'Water through the day, a class half an hour before it starts, the gym at six if nothing’s logged. Turn each one on or off in here.',
        radius: 999,
      },
    ],
  },

  aurum: {
    key: 'aurum',
    label: 'Aurum — finance',
    steps: [
      {
        anchor: 'aurum-dial',
        title: 'Two balances, one dial',
        body: 'This month’s net is what you see first. Swipe the dial sideways for your all-time balance — the same swipe works on Aurum’s card back on the launcher.',
      },
      {
        anchor: 'aurum-add',
        title: 'Logging takes about four seconds',
        body: 'The brass + opens the add sheet. Anything you log often, save as a quick-add preset — it becomes a one-tap chip next time.',
        radius: 999,
      },
      {
        anchor: 'aurum-budgets',
        title: 'Budgets fill the ring',
        body: 'Set a monthly limit on any category and the ring around the dial fills as you spend it, so overspending is visible before it is a problem.',
      },
    ],
  },

  kindle: {
    key: 'kindle',
    label: 'Kindle — habits',
    steps: [
      {
        anchor: 'kindle-grid',
        title: 'Your week, eight habits across',
        body: 'One cell per habit per day. Colour runs from red to green as you get closer to that day’s target, so a bad week is obvious without reading a number.',
      },
      {
        anchor: 'kindle-pills',
        title: 'Tap a pill to log today',
        body: 'Habits like water step through stages — 1L, 2L, 3L — instead of being all-or-nothing, so a partial day still counts for something. Hold a pill to reset it to zero.',
      },
      {
        anchor: 'kindle-history',
        title: 'Yesterday is edited from History',
        body: 'Past days sit behind a PIN and ask for a reason. That is on purpose: it keeps the grid an honest record rather than something you tidy up afterwards.',
      },
    ],
  },

  vigil: {
    key: 'vigil',
    label: 'Vigil — study',
    steps: [
      {
        anchor: 'vigil-timer',
        title: 'Five hours, counting down',
        body: 'Tap once to start, once to pause, as many times as the day needs. It keeps time with the app closed, so you can put the phone down mid-session.',
      },
      {
        anchor: 'vigil-chart',
        title: 'Past five is bonus, not wasted',
        body: 'The countdown reaches zero and keeps going. Anything beyond the target shows as bonus time on the week rather than a bar that just stops.',
      },
      {
        anchor: 'vigil-topics',
        title: 'The syllabus, as a tree',
        body: 'Categories hold subjects, subjects hold subtopics. Tick the subtopics and everything above them fills in by itself — there is nothing to keep in sync.',
      },
    ],
  },

  loom: {
    key: 'loom',
    label: 'Loom — timetable',
    steps: [
      {
        anchor: 'loom-grid',
        title: 'Tap an empty slot to fill it',
        body: 'A class is saved once — name, room, faculty, colour — and reused everywhere it appears. Edit that one class and every slot holding it updates.',
      },
      {
        anchor: 'loom-view',
        title: 'Saturday does its own thing',
        body: 'Switch to Day, pick Saturday, and copy any weekday into it as a starting point. What you get is a snapshot you can then edit freely — it keeps no link to the day it came from.',
        radius: 999,
      },
      {
        anchor: 'loom-terms',
        title: 'One timetable per stretch of term',
        body: 'When the schedule changes mid-semester, add a new version with the date it takes effect. Loom shows whichever one is in force today and keeps the rest.',
      },
    ],
  },

  virtus: {
    key: 'virtus',
    label: 'Virtus — gym',
    steps: [
      {
        anchor: 'virtus-today',
        title: 'Today’s session, one tap in',
        body: 'Virtus opens on whatever your split says you are training. Sets go in as you do them — weight, reps, add — so there is nothing to plan beforehand.',
      },
      {
        anchor: 'virtus-grid',
        title: 'Darker means heavier',
        body: 'Every day is coloured by total volume — weight × reps across the whole session. Easy days stay pale, hard days go dark, and rest days sit off the scale entirely.',
      },
      {
        anchor: 'virtus-settings',
        title: 'Build the library once',
        body: 'Exercises, muscle groups and split days live in Settings. Each exercise carries last session’s numbers into the next one, so you always know what to beat.',
      },
    ],
  },

  chronicle: {
    key: 'chronicle',
    label: 'Chronicle — notes & to-dos',
    steps: [
      {
        anchor: 'chronicle-tabs',
        title: 'To-dos, notes, voice',
        body: 'Three sections over one shared set of tags, so a tag means the same thing wherever you use it.',
      },
      {
        anchor: 'chronicle-capture',
        title: 'One button that knows where it is',
        body: 'In Voice it starts recording straight away and transcribes it for you afterwards. Any note or recording can be attached to a to-do as its reference material.',
        radius: 999,
      },
      {
        anchor: 'chronicle-search',
        title: 'Search reaches inside everything',
        body: 'Titles, the body of every note, and the text of every recording — all of it, from this one field.',
      },
    ],
  },
}

/** The replay list in Settings, in launcher order with Meridian first. */
export const WALKTHROUGH_ORDER: ModuleKey[] = ['meridian', 'aurum', 'kindle', 'vigil', 'loom', 'virtus', 'chronicle']
