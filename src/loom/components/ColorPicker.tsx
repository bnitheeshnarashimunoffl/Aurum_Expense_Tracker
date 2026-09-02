import { CLASS_COLORS, onColor } from '../lib/colors'

interface ColorPickerProps {
  value: string
  onChange: (color: string) => void
}

/**
 * The eight validated defaults as swatches, plus a native colour input for
 * anything else — the spec requires the colour to be user-editable, and a full
 * custom picker is one control rather than a bespoke wheel.
 */
export default function ColorPicker({ value, onChange }: ColorPickerProps) {
  const isCustom = !CLASS_COLORS.includes(value as (typeof CLASS_COLORS)[number])

  return (
    <div>
      <div className="mb-2 grid grid-cols-8 gap-2">
        {CLASS_COLORS.map((color) => {
          const selected = value.toLowerCase() === color.toLowerCase()
          return (
            <button
              key={color}
              type="button"
              onClick={() => onChange(color)}
              aria-label={`Use colour ${color}`}
              aria-pressed={selected}
              className="flex aspect-square w-full items-center justify-center rounded-lg transition-transform active:scale-90"
              style={{ background: color, boxShadow: selected ? '0 0 0 2px var(--loom-bg-surface), 0 0 0 4px var(--loom-gold)' : 'none' }}
            >
              {selected && (
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={onColor(color)} strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <path d="M4 12.5 L9.5 18 L20 6.5" />
                </svg>
              )}
            </button>
          )
        })}
      </div>

      <label className="flex items-center gap-2.5 text-xs text-loomMuted">
        <input
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          aria-label="Custom class colour"
          className="loom-color-input h-8 w-11 cursor-pointer rounded-[10px]"
        />
        {isCustom ? `Custom ${value}` : 'Or pick a custom colour'}
      </label>
    </div>
  )
}
