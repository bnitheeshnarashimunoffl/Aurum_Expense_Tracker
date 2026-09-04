import type { ModuleKey, WalkthroughDefinition } from './types'

/**
 * Every walkthrough in Meridian, as content.
 *
 * The editorial rule for all of them: a step has to teach something a person
 * would not otherwise find. "This is the grid" is a caption. "Past days are
 * behind a PIN and ask for a reason" is a reason to trust the grid. Anything that
 * failed that test was cut.
 *
 * VIRTUS AND LOOM ARE DELIBERATE EXCEPTIONS to the "keep it short" rule the other
 * five obey, and the reason is that both have a setup chain rather than a feature.
 *
 * Virtus cannot log a single set until three things exist in order — an exercise
 * library, split days built from it, and a weekly schedule pointing at those. Miss
 * that and the app appears to do nothing at all, which is not a tour's failure to
 * be brief, it is a tour's failure to work. Loom has the same shape (a term and
 * its time slots come before anything else can exist) plus semester versioning,
 * which is the classic feature nobody discovers until the week they need it and
 * cannot find it.
 *
 * Both therefore run long, and both open with the shape of the thing before any
 * individual screen. Steps with no `anchor` are the ones doing that work: they
 * centre themselves and explain, rather than pointing at a control that will not
 * exist yet on a brand-new account.
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
        // Deliberately NOT about notifications any more. This used to promise
        // water reminders and class nudges, which are unavailable to shared
        // instances — and a walkthrough that opens by offering something the
        // account will never get is the worst possible first impression. Settings
        // is described by what is actually in it for everybody.
        anchor: 'meridian-settings',
        title: 'Settings, and where your data lives',
        body: 'Replay any of these introductions, see which Supabase project Meridian is reading from, and find help if something ever stops loading.',
        radius: 999,
      },
    ],
  },

  aurum: {
    key: 'aurum',
    label: 'Aurum — finance',
    steps: [
      {
        // First, because on a new account it is the only thing that can be done:
        // nothing can be logged until a category exists. The walkthrough runs on
        // the empty first-run screen as well as the real dashboard, so the step
        // that unblocks the module has to come before the ones describing it.
        anchor: 'aurum-settings',
        title: 'Your categories, not a stock list',
        body: 'Aurum starts with none on purpose — a list of somebody else’s spending habits is worse than none at all. Make the handful you actually use in Settings; the first one takes about ten seconds.',
      },
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
        title: 'Your week, one row per habit',
        body: 'One cell per habit per day. Colour runs from red to green as you get closer to that day’s target, so a bad week is obvious without reading a number.',
      },
      {
        anchor: 'kindle-pills',
        title: 'Tap a pill to log today',
        body: 'Some habits are done-or-not. Others step through stages — an hour at a time, say — so a partial day still counts for something instead of being nothing. Hold a pill to reset it to zero.',
      },
      {
        anchor: 'kindle-settings',
        title: 'Those three are only examples',
        body: 'Gym, Sleep and Study are here so the grid has something in it — one all-or-nothing habit and two that count up, to show both kinds. Rename them, change their targets, delete them, add your own: all of it is in Settings.',
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
        title: 'A timetable, built in three passes',
        body: 'A term to hold it, a library of your classes, then the week itself. It sounds like a lot; it is about ten minutes once, and then the timetable is just there every morning.',
      },
      {
        anchor: 'loom-terms',
        title: 'Start with the term',
        body: 'A term is the semester itself — a name and the dates it runs between. Its period times live here too, and they are yours to define: Loom never assumes your day is built out of one-hour blocks.',
      },
      {
        title: 'Classes are saved once, used everywhere',
        body: 'A class carries its name, room, faculty and colour, and every slot holding it points at that one copy. Change the room in March and every Tuesday morning for the rest of term changes with it.',
      },
      {
        anchor: 'loom-grid',
        title: 'Then fill the week in',
        body: 'Tap any empty slot and pick a class from the library. Tap a filled one to swap or clear it. Nothing here is typed twice.',
      },
      {
        anchor: 'loom-view',
        title: 'Saturday does its own thing',
        body: 'Switch to Day, pick Saturday, and copy any weekday into it as a starting point. What you get is a snapshot you can then edit freely — it keeps no link to the day it came from.',
        radius: 999,
      },
      {
        title: 'When the timetable changes mid-term',
        body: 'It always does. Rather than overwriting the week and losing what it used to be, add a new version and give it the date it takes effect from. Loom shows whichever version is in force today, and the old one stays exactly as it was.',
      },
      {
        anchor: 'loom-terms',
        title: 'Both of those live under Terms',
        body: 'New versions, new semesters, and the period times. Next semester can start as a copy of this one, so the class library and the timings carry over and only the week itself is empty.',
      },
      {
        title: 'It works with no signal',
        body: 'Loom keeps its own copy on this device, so it opens in a basement or on a train exactly as fast as anywhere else. Changes sync back up on their own once you have a connection again.',
      },
    ],
  },

  virtus: {
    key: 'virtus',
    label: 'Virtus — gym',
    steps: [
      {
        title: 'Three things, in this order',
        body: 'Virtus cannot log a set until it knows what you lift, how those lifts group into workout days, and which day is which. That is the whole setup, it happens once, and until it is done the app will look like it does nothing.',
      },
      {
        anchor: 'virtus-settings',
        title: 'All of it is in Settings',
        body: 'Three tabs in there, in the order you need them: Library, Split days, Schedule. Work left to right and each one is built from the one before it.',
      },
      {
        title: 'One — the library',
        body: 'Every exercise you do, sorted into muscle groups you name yourself. This is the only place a lift is ever written down; everything after this points back at it. Removing one later keeps all the sets you already logged under it.',
      },
      {
        title: 'Two — split days',
        body: 'A split day is a named workout — Push, Pull, Legs, whatever you call yours — built by picking exercises out of the library. Rename a lift afterwards and every split day holding it updates, because they hold the exercise itself and not a copy of its name.',
      },
      {
        title: 'Three — the week',
        body: 'Point each weekday at a split day, or mark it as rest. That is what lets Virtus open already knowing what today is, instead of asking.',
      },
      {
        anchor: 'virtus-today',
        title: 'After that, it is one tap',
        body: 'Virtus opens on whatever the schedule says you are training. Sets go in as you do them — weight, reps, add. You can train something else instead on any given day without touching the schedule.',
      },
      {
        title: 'Rest is a thing you log',
        body: 'Mark a rest day and it is recorded as one. That matters more than it sounds: it keeps "I rested" and "I forgot" from looking identical a month later, which is the difference between a record and a guess.',
      },
      {
        title: 'Last session stays on screen',
        body: 'While you are logging a lift, what you did with it last time sits right above the inputs — and the boxes come pre-filled with those numbers. Beating it is a matter of changing one digit rather than remembering anything.',
      },
      {
        anchor: 'virtus-grid',
        title: 'Darker means a harder day than usual',
        body: 'Each day is ranked on total volume — weight × reps across the session — against the average of your last six of that same split day. So a leg day is only ever compared with your other leg days, never with a shoulder day. Rest sits off the scale entirely.',
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
