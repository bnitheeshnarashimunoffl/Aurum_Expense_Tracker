import type { ModuleKey } from './types'

/**
 * The walkthrough borrows each module's own material rather than shipping one
 * generic overlay. A cream card on Vigil and a charcoal card on Chronicle are the
 * same component with different tokens — which is what stops this reading as a
 * third-party onboarding library dropped into six unrelated apps.
 *
 * Every value here already exists in src/index.css; nothing new is invented, so a
 * palette change inside a module reaches its walkthrough for free.
 *
 * CONTRAST, measured rather than eyeballed. Two pairings that looked obvious do
 * not survive measurement, which is why `action` is a separate token from
 * `accent` instead of the same colour doing both jobs:
 *
 *   Vigil    cream on --vigil-gold ............ 2.56  ✗   (accent as a button fill)
 *            --vigil-ink on --vigil-gold ...... 4.77  ✓   (what `action` uses)
 *   Virtus   marble on --bronze-primary ....... 3.59  ✗
 *            marble on --bronze-deep .......... 6.09  ✓   (what `action` uses)
 *   Meridian --bg-base on --accent ............ 8.31  ✓
 *   Kindle   --kindle-bg-base on --accent ..... 8.24  ✓
 *   Loom     --loom-bg-base on --loom-gold .... 6.83  ✓
 *   Chronicle charcoal on --gold-primary ...... 6.85  ✓   (as index.css already records)
 *
 * `accent` keeps the brighter colour, because the spotlight ring and the progress
 * sun are marks rather than text and want to be as visible as possible.
 */
export interface WalkthroughTone {
  /** The module's raised neumorphic surface class — the card's material. */
  surface: string
  /** The module's colour, for the spotlight ring and the progress sun. Never a text background. */
  accent: string
  /** Background of the primary button — the accent where that is legible, a deeper tone where it is not. */
  action: string
  /** Text on `action`, measured above. */
  actionInk: string
  /** The card's own surface colour, so a focus ring's offset matches what it sits on. */
  offset: string
  /** Headline and body text. Body sets it back with opacity rather than switching to a dimmer token. */
  text: string
  /** Non-text only: the dashed arc behind the progress sun. */
  muted: string
  /**
   * The dim behind the spotlight. Dark modules take a near-black scrim; the two
   * light modules (Vigil, Virtus) take a WARM one instead, because pure black
   * over cream reads as a rendering fault rather than as focus.
   */
  scrim: string
}

const DARK_SCRIM = 'rgba(6, 7, 9, 0.84)'

export const TONES: Record<ModuleKey, WalkthroughTone> = {
  meridian: {
    surface: 'neu-raised',
    accent: 'var(--accent)',
    action: 'var(--accent)',
    actionInk: 'var(--bg-base)',
    offset: 'var(--bg-surface)',
    text: 'var(--text-primary)',
    muted: 'var(--text-muted)',
    scrim: DARK_SCRIM,
  },
  aurum: {
    surface: 'neu-raised',
    accent: 'var(--accent)',
    action: 'var(--accent)',
    actionInk: 'var(--bg-base)',
    offset: 'var(--bg-surface)',
    text: 'var(--text-primary)',
    muted: 'var(--text-muted)',
    scrim: DARK_SCRIM,
  },
  kindle: {
    surface: 'kindle-neu-raised',
    accent: 'var(--accent)',
    action: 'var(--accent)',
    actionInk: 'var(--kindle-bg-base)',
    offset: 'var(--kindle-bg-surface)',
    text: 'var(--text-primary)',
    muted: 'var(--text-muted)',
    scrim: 'rgba(7, 8, 22, 0.86)',
  },
  vigil: {
    surface: 'vigil-neu-raised',
    accent: 'var(--vigil-gold)',
    action: 'var(--vigil-gold)',
    // Cream on this gold is 2.56 and unusable; the module's own ink is 4.77.
    actionInk: 'var(--vigil-ink)',
    offset: 'var(--vigil-bg-surface)',
    text: 'var(--vigil-ink)',
    muted: 'var(--vigil-ink-soft)',
    // Warm, and lighter than the dark modules' — cream needs less dimming before
    // the cutout reads as the brightest thing on screen.
    scrim: 'rgba(58, 46, 30, 0.62)',
  },
  loom: {
    surface: 'loom-neu-raised',
    accent: 'var(--loom-gold)',
    action: 'var(--loom-gold)',
    actionInk: 'var(--loom-bg-base)',
    offset: 'var(--loom-bg-surface)',
    text: 'var(--loom-ink)',
    muted: 'var(--loom-muted)',
    scrim: 'rgba(9, 11, 14, 0.86)',
  },
  virtus: {
    surface: 'virtus-neu-raised',
    accent: 'var(--bronze-primary)',
    // The deep bronze rather than the primary one: marble on --bronze-primary is
    // 3.59, which is fine for Virtus's own large button label and not for this
    // one at 13.5px.
    action: 'var(--bronze-deep)',
    actionInk: 'var(--marble-surface)',
    offset: 'var(--marble-surface)',
    text: 'var(--ink-charcoal)',
    muted: 'var(--ink-soft)',
    scrim: 'rgba(43, 38, 32, 0.6)',
  },
  chronicle: {
    surface: 'chr-neu-raised',
    accent: 'var(--gold-primary)',
    action: 'var(--gold-primary)',
    actionInk: 'var(--ink-charcoal-bg)',
    offset: 'var(--ink-charcoal-bg)',
    text: 'var(--ivory)',
    muted: 'var(--ivory-dim)',
    scrim: 'rgba(11, 13, 14, 0.87)',
  },
}

/** Chronicle and Virtus set their headings in a display face; the rest use Space Grotesk. */
export const TITLE_FONT: Partial<Record<ModuleKey, string>> = {
  virtus: 'font-inscribe',
  chronicle: 'font-chronicle',
}
