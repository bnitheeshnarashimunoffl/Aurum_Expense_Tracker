/**
 * The default class palette: eight hues that stay distinguishable from each other
 * AND legible on Loom's gunmetal surface. Validated as a categorical set against
 * #272c33 — every slot sits in the dark-mode lightness band, clears the chroma
 * floor, keeps adjacent-pair colour-blind separation at or above the target, and
 * clears 3:1 contrast against the surface.
 *
 * A pastel set was tried first and failed badly (adjacent pairs at deltaE 1.6 —
 * indistinguishable), which is why these are mid-tone and saturated rather than
 * literally pale. They are used as a tint + edge marker rather than a flat fill,
 * so the grid stays calm; see <ClassBlock>.
 */
export const CLASS_COLORS = [
  '#3987e5', // blue
  '#d95926', // orange
  '#199e70', // aqua
  '#c98500', // yellow
  '#d55181', // magenta
  '#3d9a3d', // green
  '#9085e9', // violet
  '#e66767', // red
] as const

export const DEFAULT_CLASS_COLOR: string = CLASS_COLORS[0]

/**
 * Next colour for a new class. Assigns down the fixed order so the first eight
 * classes are all mutually distinguishable; past eight it wraps, and the user is
 * expected to override — the picker always allows any colour.
 */
export function nextClassColor(usedColors: string[]): string {
  const unused = CLASS_COLORS.find((c) => !usedColors.includes(c))
  return unused ?? CLASS_COLORS[usedColors.length % CLASS_COLORS.length]
}

/** Relative luminance, for deciding whether text on a colour should be ink or white. */
function luminance(hex: string): number {
  const n = parseInt(hex.replace('#', ''), 16)
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((c) => {
    const s = c / 255
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

/** Text colour that clears contrast on a filled swatch of the given colour. */
export function onColor(hex: string): string {
  return luminance(hex) > 0.42 ? '#1e2227' : '#ffffff'
}

/** A translucent wash of the class colour, for block backgrounds on gunmetal. */
export function tint(hex: string, percent: number): string {
  return `color-mix(in srgb, ${hex} ${percent}%, transparent)`
}
