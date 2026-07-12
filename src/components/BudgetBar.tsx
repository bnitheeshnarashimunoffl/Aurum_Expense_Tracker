import Amount from './Amount'
import CategoryColorDot from './CategoryColorDot'

interface BudgetBarProps {
  categoryName: string
  color: string
  spent: number
  limit: number
}

export default function BudgetBar({ categoryName, color, spent, limit }: BudgetBarProps) {
  const pct = limit > 0 ? Math.min(100, (spent / limit) * 100) : 0
  const over = spent > limit

  return (
    <div className="neu-raised rounded-card p-4">
      <div className="mb-2 flex items-center justify-between text-sm">
        <span className="flex items-center gap-2 font-medium text-primary">
          <CategoryColorDot color={color} />
          {categoryName}
        </span>
        <span className={over ? 'text-expense' : 'text-muted'}>
          <Amount value={spent} /> / <Amount value={limit} />
        </span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-black/40">
        <div
          className="h-full rounded-full transition-[width] duration-700"
          style={{ width: `${pct}%`, backgroundColor: over ? 'var(--expense)' : color }}
        />
      </div>
      {over && <p className="mt-1.5 text-xs text-expense">Over budget</p>}
    </div>
  )
}
