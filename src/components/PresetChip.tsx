import type { QuickAddPreset } from '@/lib/types'
import { formatCurrency } from '@/lib/format'

interface PresetChipProps {
  preset: QuickAddPreset
  active?: boolean
  onClick: () => void
}

export default function PresetChip({ preset, active, onClick }: PresetChipProps) {
  return (
    <button
      onClick={onClick}
      className={`min-h-[44px] flex-shrink-0 whitespace-nowrap rounded-full px-4 py-2 text-sm font-medium transition-colors ${
        active ? 'bg-accent text-ink' : 'glass text-primary'
      }`}
    >
      {preset.label} · {formatCurrency(preset.amount)}
    </button>
  )
}
