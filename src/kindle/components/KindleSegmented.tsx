interface KindleSegmentedOption<T extends string> {
  value: T
  label: string
}

interface KindleSegmentedProps<T extends string> {
  value: T
  onChange: (value: T) => void
  options: KindleSegmentedOption<T>[]
  ariaLabel?: string
}

// Same treatment as Aurum's <Segmented>, but on kindle-neu-pressed — Aurum's version
// is hardcoded to Aurum's near-black surface token, which would look like a mismatched
// dark box floating on Kindle's blue/purple base.
export default function KindleSegmented<T extends string>({ value, onChange, options, ariaLabel }: KindleSegmentedProps<T>) {
  return (
    <div role="group" aria-label={ariaLabel} className="kindle-neu-pressed flex rounded-full p-1">
      {options.map((option) => (
        <button
          key={option.value}
          onClick={() => onChange(option.value)}
          aria-pressed={value === option.value}
          className={`min-h-[36px] flex-1 rounded-full px-3 text-xs font-medium transition-colors ${
            value === option.value ? 'bg-accent text-ink' : 'text-muted'
          }`}
        >
          {option.label}
        </button>
      ))}
    </div>
  )
}
