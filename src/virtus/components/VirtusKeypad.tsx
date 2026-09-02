interface VirtusKeypadProps {
  value: string
  onChange: (value: string) => void
  length?: number
  error?: boolean
}

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', '⌫']

/** 4-digit PIN entry, shared by Virtus's verify and setup sheets. */
export default function VirtusKeypad({ value, onChange, length = 4, error = false }: VirtusKeypadProps) {
  function press(key: string) {
    if (key === '') return
    if (key === '⌫') {
      onChange(value.slice(0, -1))
      return
    }
    if (value.length < length) onChange(value + key)
  }

  return (
    <div>
      <div className={`mb-6 flex justify-center gap-3 ${error ? 'animate-pulse' : ''}`}>
        {Array.from({ length }, (_, i) => (
          <span
            key={i}
            className={`h-3 w-3 rounded-full ${i < value.length ? '' : 'virtus-neu-pressed-sm'}`}
            style={i < value.length ? { background: error ? 'var(--ember-red)' : 'var(--bronze-primary)' } : undefined}
          />
        ))}
      </div>
      <div className="grid grid-cols-3 gap-3">
        {KEYS.map((key, i) =>
          key === '' ? (
            <div key={i} />
          ) : (
            <button
              key={i}
              type="button"
              onClick={() => press(key)}
              className="virtus-neu-raised flex min-h-[52px] items-center justify-center rounded-card text-lg font-medium tabular-nums text-inkCharcoal transition-transform focus:outline-none focus-visible:ring-2 focus-visible:ring-bronze active:scale-95"
            >
              {key}
            </button>
          )
        )}
      </div>
    </div>
  )
}
