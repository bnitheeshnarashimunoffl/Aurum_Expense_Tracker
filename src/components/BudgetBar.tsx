import Amount from './Amount'
import CategoryColorDot from './CategoryColorDot'

interface BudgetBarProps {
  categoryName: string
  color: string
  spent: number
  /** 0 means no budget has been set for this category yet. */
  limit: number
}

export default function BudgetBar({ categoryName, color, spent, limit }: BudgetBarProps) {
  const hasBudget = limit > 0
  const pct = hasBudget ? Math.min(100, (spent / limit) * 100) : 0
  const over = hasBudget && spent > limit

  return (
    <div className="neu-raised rounded-card p-4">
      <div className="mb-2 flex items-center justify-between text-sm">
        <span className="flex items-center gap-2 font-medium text-primary">
          <CategoryColorDot color={color} />
          {categoryName}
        </span>
        {hasBudget ? (
          <span className={over ? 'text-expense' : 'text-muted'}>
            <Amount value={spent} /> / <Amount value={limit} />
          </span>
        ) : (
          <span className="text-muted">
            <Amount value={spent} /> spent
          </span>
        )}
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-black/40">
        <div
          className="h-full rounded-full transition-[width] duration-700"
          style={{ width: `${pct}%`, backgroundColor: over ? 'var(--expense)' : color }}
        />
      </div>
      {over ? (
        <p className="mt-1.5 text-xs text-expense">Over budget</p>
      ) : !hasBudget ? (
        <p className="mt-1.5 text-xs text-muted">No budget set — tap to add one</p>
      ) : null}
    </div>
  )
}
