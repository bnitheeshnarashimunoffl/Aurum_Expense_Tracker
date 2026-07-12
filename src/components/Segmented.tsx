interface SegmentedOption<T extends string> {
  value: T
  label: string
}

interface SegmentedProps<T extends string> {
  value: T
  onChange: (value: T) => void
  options: SegmentedOption<T>[]
  /** sm = filter rows on screens; md = primary toggles inside sheets */
  size?: 'sm' | 'md'
  className?: string
  ariaLabel?: string
}

/**
 * The app's single segmented-control treatment: a pressed neumorphic track with a
 * brass active pill. Every toggle row (scope, period, type, range…) goes through
 * this so they all read as one system instead of ad-hoc button rows.
 */
export default function Segmented<T extends string>({
  value,
  onChange,
  options,
  size = 'sm',
  className = '',
  ariaLabel,
}: SegmentedProps<T>) {
  const sizing = size === 'md' ? 'min-h-[44px] text-sm' : 'min-h-[36px] text-xs'
  return (
    <div role="group" aria-label={ariaLabel} className={`neu-pressed flex rounded-full p-1 ${className}`}>
      {options.map((option) => (
        <button
          key={option.value}
          onClick={() => onChange(option.value)}
          aria-pressed={value === option.value}
          className={`${sizing} flex-1 rounded-full px-3 font-medium transition-colors ${
            value === option.value ? 'bg-accent text-ink' : 'text-muted'
          }`}
        >
          {option.label}
        </button>
      ))}
    </div>
  )
}
