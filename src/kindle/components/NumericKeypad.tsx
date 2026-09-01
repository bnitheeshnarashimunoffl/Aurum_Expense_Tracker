interface NumericKeypadProps {
  value: string
  onChange: (value: string) => void
  length?: number
  error?: boolean
}

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', '⌫']

/** Shared 4-digit PIN entry UI for both PinPad (verify) and PinSetupSheet (set). */
export default function NumericKeypad({ value, onChange, length = 4, error = false }: NumericKeypadProps) {
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
            className={`h-3 w-3 rounded-full ${
              i < value.length ? (error ? 'bg-expense' : 'bg-kindleComplete') : 'kindle-neu-pressed'
            }`}
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
              className="kindle-neu-raised flex min-h-[52px] items-center justify-center rounded-card text-lg font-medium text-primary transition-transform active:scale-95"
            >
              {key}
            </button>
          )
        )}
      </div>
    </div>
  )
}
