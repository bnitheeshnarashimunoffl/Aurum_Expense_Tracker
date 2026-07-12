import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts'
import Amount from './Amount'
import CategoryColorDot from './CategoryColorDot'

export interface DonutSlice {
  id: string
  name: string
  value: number
  color: string
}

interface DonutChartProps {
  title: string
  slices: DonutSlice[]
  emptyLabel?: string
}

export default function DonutChart({ title, slices, emptyLabel = 'No data yet' }: DonutChartProps) {
  const total = slices.reduce((sum, s) => sum + s.value, 0)
  const nonZero = slices.filter((s) => s.value > 0)

  return (
    <div className="neu-raised rounded-card p-4">
      <h3 className="font-display mb-2 text-sm font-medium text-primary">{title}</h3>
      {nonZero.length === 0 ? (
        <div className="flex h-40 items-center justify-center text-sm text-muted">{emptyLabel}</div>
      ) : (
        <>
          <div style={{ width: '100%', height: 160 }}>
            <ResponsiveContainer>
              <PieChart>
                <Pie
                  data={nonZero}
                  dataKey="value"
                  nameKey="name"
                  innerRadius={48}
                  outerRadius={72}
                  paddingAngle={2}
                  strokeWidth={0}
                  isAnimationActive={!window.matchMedia('(prefers-reduced-motion: reduce)').matches}
                >
                  {nonZero.map((slice) => (
                    <Cell key={slice.id} fill={slice.color} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    background: 'rgba(20,23,27,0.9)',
                    border: '1px solid rgba(255,255,255,0.08)',
                    borderRadius: 12,
                    color: '#EDEDE9',
                  }}
                  formatter={(value: number) => [`₹${value.toFixed(2)}`, '']}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <ul className="mt-3 space-y-1.5">
            {nonZero
              .sort((a, b) => b.value - a.value)
              .map((slice) => (
                <li key={slice.id} className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-2 text-primary">
                    <CategoryColorDot color={slice.color} />
                    {slice.name}
                  </span>
                  <span className="flex items-center gap-2 text-muted">
                    <Amount value={slice.value} />
                    <span className="w-10 text-right">{total > 0 ? Math.round((slice.value / total) * 100) : 0}%</span>
                  </span>
                </li>
              ))}
          </ul>
        </>
      )}
    </div>
  )
}
