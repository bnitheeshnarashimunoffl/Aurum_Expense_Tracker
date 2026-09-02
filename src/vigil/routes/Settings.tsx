import { useMemo, useState } from 'react'
import { usePinTable } from '@/hooks/usePinTable'
import { formatDate, todayISO } from '@/lib/format'
import { shiftWeeks, mondayOf, weekDates } from '@/lib/date'
import { useToast } from '@/hooks/useToast'
import { useVigilDays } from '../hooks/useVigilDays'
import { studiedSeconds } from '../lib/time'
import { formatDuration } from '../lib/time'
import { DAILY_TARGET_SECONDS, type VigilDay } from '../lib/types'
import VigilSheet from '../components/VigilSheet'
import VigilKeypad from '../components/VigilKeypad'
import VigilToast from '../components/VigilToast'

/** Two weeks back is enough to fix a day you forgot to log without turning this into a browser. */
const EDITABLE_DAYS = 14

export default function Settings() {
  const { loading: pinLoading, hasPin, setPin, verifyPin } = usePinTable('vigil_pin')
  const { message, showToast } = useToast()

  const today = todayISO()
  const range = useMemo(() => {
    const start = weekDates(shiftWeeks(mondayOf(), -2))[0]
    return { from: start, to: today }
  }, [today])
  const { days, writeDay } = useVigilDays(range)

  const [unlocked, setUnlocked] = useState(false)
  const [gate, setGate] = useState<'closed' | 'setup' | 'verify'>('closed')
  const [pinValue, setPinValue] = useState('')
  const [firstPin, setFirstPin] = useState('')
  const [pinStage, setPinStage] = useState<'create' | 'confirm'>('create')
  const [pinError, setPinError] = useState(false)

  const [editing, setEditing] = useState<{ date: string; hours: string; minutes: string } | null>(null)

  // Past days only — today is still the timer's to own, and future days don't exist.
  const editableDates = useMemo(() => {
    const out: string[] = []
    const cursor = new Date(`${today}T00:00:00`)
    for (let i = 1; i <= EDITABLE_DAYS; i++) {
      cursor.setDate(cursor.getDate() - 1)
      out.push(
        `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, '0')}-${String(cursor.getDate()).padStart(2, '0')}`
      )
    }
    return out
  }, [today])

  function openGate() {
    setPinValue('')
    setFirstPin('')
    setPinStage('create')
    setPinError(false)
    setGate(hasPin ? 'verify' : 'setup')
  }

  async function handlePinInput(next: string) {
    setPinError(false)
    setPinValue(next)
    if (next.length !== 4) return

    if (gate === 'setup') {
      if (pinStage === 'create') {
        setFirstPin(next)
        setPinValue('')
        setPinStage('confirm')
        return
      }
      if (next === firstPin) {
        await setPin(next)
        setGate('closed')
        setUnlocked(true)
      } else {
        setPinError(true)
        setPinValue('')
        setFirstPin('')
        setPinStage('create')
      }
      return
    }

    if (await verifyPin(next)) {
      setGate('closed')
      setUnlocked(true)
    } else {
      setPinError(true)
      setPinValue('')
    }
  }

  function dayFor(date: string): VigilDay | null {
    return days.find((d) => d.date === date) ?? null
  }

  function beginEdit(date: string) {
    const seconds = Math.round(studiedSeconds(dayFor(date), Date.now()))
    setEditing({
      date,
      hours: String(Math.floor(seconds / 3600)),
      minutes: String(Math.floor((seconds % 3600) / 60)),
    })
  }

  async function saveEdit() {
    if (!editing) return
    const hours = Math.max(0, Number(editing.hours) || 0)
    const minutes = Math.min(59, Math.max(0, Number(editing.minutes) || 0))
    const total = Math.round(hours * 3600 + minutes * 60)
    try {
      await writeDay(editing.date, {
        accumulated_seconds: total,
        running_since: null,
        edited_after_the_fact: true,
      })
      showToast(`${formatDate(editing.date)} set to ${formatDuration(total)}`)
      setEditing(null)
    } catch {
      showToast("Couldn't save that edit")
    }
  }

  return (
    <div className="px-4 pt-4">
      <h1 className="font-display mb-1 text-2xl font-bold text-vigilInk">Vigil Settings</h1>
      <p className="mb-5 text-xs text-vigilInkSoft">
        Past days lock at midnight. Correcting one needs your PIN — the topic tree never does.
      </p>

      <section className="mb-6">
        <div className="mb-2.5 flex items-center justify-between">
          <h2 className="font-display text-sm font-semibold text-vigilInk">Past days</h2>
          {unlocked ? (
            <button onClick={() => setUnlocked(false)} className="text-xs text-vigilInkSoft">
              Lock
            </button>
          ) : (
            <button
              onClick={openGate}
              disabled={pinLoading}
              className="vigil-neu-raised-sm min-h-[36px] rounded-full px-3 text-xs font-medium text-vigilGold disabled:opacity-50"
            >
              Unlock editing
            </button>
          )}
        </div>

        <div className="space-y-2">
          {editableDates.map((date) => {
            const day = dayFor(date)
            const seconds = Math.round(studiedSeconds(day, Date.now()))
            const met = seconds >= DAILY_TARGET_SECONDS
            return (
              <div key={date} className="vigil-neu-raised flex items-center justify-between rounded-card px-4 py-3">
                <div className="min-w-0">
                  <span className="block truncate text-sm text-vigilInk">{formatDate(date)}</span>
                  <span className="block text-xs text-vigilInkSoft">
                    {formatDuration(seconds)}
                    {met ? ' · target met' : ''}
                    {day?.edited_after_the_fact ? ' · edited' : ''}
                  </span>
                </div>
                {unlocked && (
                  <button
                    onClick={() => beginEdit(date)}
                    className="vigil-neu-raised-sm min-h-[34px] flex-shrink-0 rounded-full px-3 text-xs font-medium text-vigilGold"
                  >
                    Edit
                  </button>
                )}
              </div>
            )
          })}
        </div>
      </section>

      <VigilSheet
        open={gate !== 'closed'}
        onClose={() => setGate('closed')}
        title={gate === 'setup' ? 'Set your Vigil PIN' : 'Enter PIN'}
      >
        <p className="mb-5 text-sm text-vigilInkSoft">
          {pinError
            ? gate === 'setup'
              ? "Those didn't match — set a 4-digit PIN again."
              : 'Incorrect PIN — try again.'
            : gate === 'setup'
              ? pinStage === 'create'
                ? 'Choose a 4-digit PIN. It gates edits to days that have already closed.'
                : 'Enter it once more to confirm.'
              : 'This action needs your Vigil PIN.'}
        </p>
        <VigilKeypad value={pinValue} onChange={handlePinInput} error={pinError} />
      </VigilSheet>

      <VigilSheet open={editing !== null} onClose={() => setEditing(null)} title="Edit studied time">
        {editing && (
          <>
            <p className="mb-4 text-sm text-vigilInkSoft">{formatDate(editing.date)}</p>
            <div className="mb-5 flex gap-3">
              <label className="flex-1">
                <span className="mb-1.5 block text-xs text-vigilInkSoft">Hours</span>
                <input
                  type="number"
                  min={0}
                  max={23}
                  inputMode="numeric"
                  value={editing.hours}
                  onChange={(e) => setEditing({ ...editing, hours: e.target.value })}
                  className="vigil-neu-pressed w-full rounded-card border-none bg-transparent px-4 py-3 text-vigilInk outline-none focus:ring-1 focus:ring-vigilGold"
                />
              </label>
              <label className="flex-1">
                <span className="mb-1.5 block text-xs text-vigilInkSoft">Minutes</span>
                <input
                  type="number"
                  min={0}
                  max={59}
                  inputMode="numeric"
                  value={editing.minutes}
                  onChange={(e) => setEditing({ ...editing, minutes: e.target.value })}
                  className="vigil-neu-pressed w-full rounded-card border-none bg-transparent px-4 py-3 text-vigilInk outline-none focus:ring-1 focus:ring-vigilGold"
                />
              </label>
            </div>
            <button
              onClick={saveEdit}
              className="vigil-neu-raised min-h-[46px] w-full rounded-card text-sm font-semibold text-vigilGold"
            >
              Save
            </button>
          </>
        )}
      </VigilSheet>

      <VigilToast message={message} />
    </div>
  )
}
