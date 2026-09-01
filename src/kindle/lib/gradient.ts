import type { Habit } from './types'

// Shared keypoints for every generated gradient: muted red -> muted orange -> light
// sage -> the app's canonical "complete" green (var(--kindle-complete)), so stage
// max_stage always renders the exact same green everywhere, regardless of habit.
const RED = [201, 82, 77] as const
const ORANGE = [217, 138, 74] as const
const LIGHT_GREEN = [156, 192, 138] as const
const COMPLETE_GREEN = [111, 167, 135] as const // #6FA787 == var(--kindle-complete)
const KEYPOINTS: readonly (readonly [number, number, number])[] = [RED, ORANGE, LIGHT_GREEN, COMPLETE_GREEN]

const BATHS_PALETTE = ['#d6b24a', '#6fa787'] // 1 bath -> yellow, 2 baths -> green (kindle-complete)

function toHex([r, g, b]: readonly [number, number, number]): string {
  return `#${[r, g, b].map((c) => Math.round(c).toString(16).padStart(2, '0')).join('')}`
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t
}

function colorAt(t: number): string {
  const clamped = Math.min(1, Math.max(0, t))
  const segments = KEYPOINTS.length - 1
  const scaled = clamped * segments
  const i = Math.min(segments - 1, Math.floor(scaled))
  const localT = scaled - i
  const [r1, g1, b1] = KEYPOINTS[i]
  const [r2, g2, b2] = KEYPOINTS[i + 1]
  return toHex([lerp(r1, r2, localT), lerp(g1, g2, localT), lerp(b1, b2, localT)])
}

/**
 * Evenly-spaced N-step red -> orange -> light-green -> complete-green gradient.
 * Stage 1 is always the reddest point, stage maxStage always exactly
 * var(--kindle-complete) — every multi-stage habit (built-in or user-created)
 * converges on the same "done" green.
 */
export function generateStageGradient(maxStage: number): string[] {
  if (maxStage <= 1) return [toHex(COMPLETE_GREEN)]
  return Array.from({ length: maxStage }, (_, i) => colorAt(i / (maxStage - 1)))
}

/**
 * Resolves the fill color for a given habit at a given stage. Returns null for
 * "no color" (stage 0, or a binary habit not yet done) — callers should render
 * the plain neutral kindle-neu-raised surface in that case, per the spec's
 * explicit "match the existing unchecked surface, don't invent a new gray."
 */
export function resolveStageColor(habit: Pick<Habit, 'type' | 'max_stage' | 'palette_key'>, stage: number): string | null {
  if (stage <= 0) return null
  const clampedStage = Math.min(stage, habit.max_stage)

  if (habit.type === 'binary') {
    return clampedStage >= habit.max_stage ? toHex(COMPLETE_GREEN) : null
  }

  if (habit.palette_key === 'baths') {
    return BATHS_PALETTE[clampedStage - 1] ?? BATHS_PALETTE[BATHS_PALETTE.length - 1]
  }

  const gradient = generateStageGradient(habit.max_stage)
  return gradient[clampedStage - 1] ?? gradient[gradient.length - 1]
}

/**
 * Blends the raised (unchecked) and pressed-in (checked) neumorphic shadow pairs
 * proportionally to stage/max_stage, so a partial stage reads as "in between"
 * raised and pressed — not just a color swap. t=0 is exactly .kindle-neu-raised's
 * shadow, t=1 is exactly .kindle-cell-checked's.
 */
export function stageBoxShadow(t: number): string {
  const clamped = Math.min(1, Math.max(0, t))
  const raisedDark = 0.6 * (1 - clamped)
  const raisedLight = 0.06 * (1 - clamped)
  const pressedDark = 0.45 * clamped
  const pressedLight = 0.18 * clamped
  return [
    `8px 8px 16px rgba(4,5,16,${raisedDark.toFixed(3)})`,
    `-6px -6px 14px rgba(140,150,220,${raisedLight.toFixed(3)})`,
    `inset 4px 4px 8px rgba(18,46,33,${pressedDark.toFixed(3)})`,
    `inset -3px -3px 6px rgba(198,232,210,${pressedLight.toFixed(3)})`,
  ].join(', ')
}
