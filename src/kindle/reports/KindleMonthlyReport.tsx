import { forwardRef } from 'react'
import { formatDate } from '@/lib/format'
import { resolveStageColor } from '../lib/gradient'
import type { Habit, HabitLog } from '../lib/types'

export interface KindleMonthlyReportProps {
  monthLabel: string
  habits: Habit[]
  days: string[]
  logs: HabitLog[]
  generatedOn: string
}

/**
 * Print-friendly landscape monthly grid, snapshotted by html2canvas via html2pdf —
 * light/white like Aurum's ExportReport, deliberately not the app's dark neumorphic UI.
 * Edit reasons are surfaced ONLY here, never in the live grid.
 */
const KindleMonthlyReport = forwardRef<HTMLDivElement, KindleMonthlyReportProps>(function KindleMonthlyReport(
  { monthLabel, habits, days, logs, generatedOn },
  ref
) {
  const logByKey = new Map(logs.map((l) => [`${l.habit_id}_${l.date}`, l]))
  const notes = logs
    .filter((l) => l.edited_after_the_fact && l.edit_reason)
    .map((l) => ({
      date: l.date,
      habit: habits.find((h) => h.id === l.habit_id)?.label ?? 'Unknown habit',
      reason: l.edit_reason as string,
    }))
    .sort((a, b) => a.date.localeCompare(b.date))

  const cellSize = 22
  const labelWidth = 160

  return (
    <div
      ref={ref}
      style={{
        width: `${labelWidth + days.length * (cellSize + 4) + 112}px`,
        padding: '48px',
        background: '#ffffff',
        color: '#1a1a1a',
        fontFamily: 'Georgia, "Times New Roman", serif',
      }}
    >
      <div style={{ borderBottom: '2px solid #1a1a1a', paddingBottom: 16, marginBottom: 24 }}>
        <h1 style={{ fontSize: 26, margin: 0, letterSpacing: 0.5 }}>Kindle — {monthLabel}</h1>
        <p style={{ margin: '6px 0 0', fontSize: 12, color: '#555' }}>generated {generatedOn}</p>
      </div>

      <table style={{ borderCollapse: 'collapse', fontSize: 10 }}>
        <thead>
          <tr>
            <th style={{ width: labelWidth, textAlign: 'left', padding: '4px 8px', borderBottom: '1px solid #999' }} />
            {days.map((date) => (
              <th key={date} style={{ width: cellSize, padding: '2px', borderBottom: '1px solid #999', fontWeight: 'normal', color: '#666' }}>
                {Number(date.slice(-2))}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {habits.map((habit) => (
            <tr key={habit.id}>
              <td style={{ padding: '4px 8px', borderBottom: '1px solid #eee', whiteSpace: 'nowrap' }}>{habit.label}</td>
              {days.map((date) => {
                const stage = logByKey.get(`${habit.id}_${date}`)?.stage ?? 0
                const color = resolveStageColor(habit, stage)
                return (
                  <td key={date} style={{ textAlign: 'center', padding: '2px', borderBottom: '1px solid #eee' }}>
                    <span
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        width: 14,
                        height: 14,
                        borderRadius: 3,
                        background: color ?? 'transparent',
                        border: color ? 'none' : '1px solid #ccc',
                        fontSize: 8,
                        color: '#12142b',
                      }}
                    >
                      {habit.type === 'multi_stage' && stage > 0 ? stage : ''}
                    </span>
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>

      {notes.length > 0 && (
        <div style={{ marginTop: 32 }}>
          <h2 style={{ fontSize: 14, borderBottom: '1px solid #ccc', paddingBottom: 6, marginBottom: 10 }}>
            Edit notes
          </h2>
          {notes.map((note, i) => (
            <div key={i} style={{ display: 'flex', gap: 12, fontSize: 11, padding: '4px 0', borderBottom: '1px solid #f0f0f0' }}>
              <span style={{ width: 90, color: '#666' }}>{formatDate(note.date)}</span>
              <span style={{ width: 160 }}>{note.habit}</span>
              <span style={{ flex: 1, color: '#333' }}>{note.reason}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
})

export default KindleMonthlyReport
