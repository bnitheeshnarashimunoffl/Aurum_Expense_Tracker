export const MODULE_KEYS = ['meridian', 'aurum', 'kindle', 'vigil', 'loom', 'virtus', 'chronicle'] as const
export type ModuleKey = (typeof MODULE_KEYS)[number]

export interface WalkthroughStep {
  /**
   * The `data-tour` value of the element this step is about. Omit it for a step
   * that has nothing to point at — the opening and closing beats — and the card
   * centres itself with no cutout.
   */
  anchor?: string
  title: string
  body: string
  /** Corner radius of the spotlight cutout. Match the element: 999 for a pill or circle. */
  radius?: number
  /** Force the card above or below the cutout when the automatic choice reads badly. */
  place?: 'above' | 'below'
}

/**
 * Every module's walkthrough, and the one for Meridian itself. Deliberately
 * short — a tour nobody finishes teaches nothing — but each step has to be a
 * genuine "oh, that's useful", not a caption for something already obvious.
 */
export interface WalkthroughDefinition {
  key: ModuleKey
  /** How it is named in the replay list. */
  label: string
  steps: WalkthroughStep[]
}

export type WalkthroughStatus = 'completed' | 'skipped'
