import { useMemo, useState } from 'react'
import { usePinTable } from '@/hooks/usePinTable'
import { formatDate, todayISO } from '@/lib/format'
import { shiftWeeks, mondayOf, weekDates } from '@/lib/date'
import { useToast } from '@/hooks/useToast'
import { useVigilDays } from '../hooks/useVigilDays'
import { useVigilTarget } from '../hooks/useVigilTarget'
import { studiedSeconds } from '../lib/time'
import { formatDuration, formatTarget } from '../lib/time'
import { MAX_TARGET_SECONDS, MIN_TARGET_SECONDS, type VigilDay } from '../lib/types'
import VigilSheet from '../components/VigilSheet'
import VigilKeypad from '../components/VigilKeypad'
import VigilToast from '../components/VigilToast'

/** Two weeks back is enough to fix a day you forgot to log without turning this into a browser. */
const EDITABLE_DAYS = 14

/**
 * The targets offered as one tap. Deliberately not a slider: a slider invites
 * fiddling, and this is a decision that has to be made once and stood by.
 * Anything not in this list goes through Custom.
 */
const PRESETS = [1, 2, 3, 4, 5, 6].map((hours) => hours * 3600)

function LockIcon({ size = 15 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="var(--vigil-gold)"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <rect x="4.5" y="10.5" width="15" height="10" rx="2.5" />
      <path d="M8.5 10.5V7.75a3.5 3.5 0 0 1 7 0v2.75" />
    </svg>
  )
}

export default function Settings() {
  const { loading: pinLoading, hasPin, setPin, verifyPin } = usePinTable('vigil_pin')
  const { message, showToast } = useToast()

  const today = todayISO()
  const range = useMemo(() => {
    const start = weekDates(shiftWeeks(mondayOf(), -2))[0]
    return { from: start, to: today }
  }, [today])
  const { days, writeDay } = useVigilDays(range)
  const {
    current: target,
    targetFor,
    locked,
    unlocksOn,
    loading: targetLoading,
    setTarget,
  } = useVigilTarget()

  const [unlocked, setUnlocked] = useState(false)
  const [gate, setGate] = useState<'closed' | 'setup' | 'verify'>('closed')
  const [pinValue, setPinValue] = useState('')
  const [firstPin, setFirstPin] = useState('')
  const [pinStage, setPinStage] = useState<'create' | 'confirm'>('create')
  const [pinError, setPinError] = useState(false)

  const [editing, setEditing] = useState<{ date: string; hours: string; minutes: string } | null>(null)

  /* ---- Target selection ------------------------------------------------- */
  const [choice, setChoice] = useState<number | null>(null)
  const [customOpen, setCustomOpen] = useState(false)
  const [custom, setCustom] = useState({ hours: '', minutes: '' })
  // Non-null while the confirmation sheet is up. The value being confirmed is
  // carried here rather than read back out of `choice`, so nothing can change
  // underneath the sentence the user is agreeing to.
  const [confirming, setConfirming] = useState<number | null>(null)
  const [saving, setSaving] = useState(false)

  function applyCustom(next: { hours: string; minutes: string }) {
    setCustom(next)
    const seconds = (Number(next.hours) || 0) * 3600 + (Number(next.minutes) || 0) * 60
    setChoice(seconds > 0 ? seconds : null)
  }

  const choiceValid = choice !== null && choice >= MIN_TARGET_SECONDS && choice <= MAX_TARGET_SECONDS

  async function confirmTarget() {
    if (confirming === null) return
    setSaving(true)
    try {
      await setTarget(confirming)
      showToast(`Target set to ${formatTarget(confirming)} a day for this week`, 3600)
      setConfirming(null)
      setChoice(null)
      setCustomOpen(false)
      setCustom({ hours: '', minutes: '' })
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Could not set that target', 5000)
      setConfirming(null)
    } finally {
      setSaving(false)
    }
  }

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
        Your daily target is set once a week. Past days lock at midnight, and correcting one needs your PIN — the topic
        tree never does.
      </p>

      {/* ---- Daily target ------------------------------------------------- */}
      <section className="mb-6">
        <h2 className="font-display mb-2.5 text-sm font-semibold text-vigilInk">Daily target</h2>

        {targetLoading ? (
          <div className="vigil-neu-raised rounded-card px-4 py-5">
            <span className="text-xs text-vigilInkSoft">Checking this week’s target…</span>
          </div>
        ) : locked ? (
          /* ---- Already chosen. Say so, say when it lifts, say why. -------- */
          <div className="vigil-neu-raised rounded-card px-4 py-4">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <span className="block text-xs text-vigilInkSoft">This week</span>
                <span className="font-display block text-[26px] font-bold leading-tight text-vigilInk">
                  {formatTarget(target)}
                  <span className="ml-1.5 text-sm font-medium text-vigilInkSoft">a day</span>
                </span>
              </div>
              <span className="vigil-neu-pressed flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full">
                <LockIcon />
              </span>
            </div>

            <div className="mt-3.5 border-t pt-3" style={{ borderColor: 'var(--vigil-line)' }}>
              <p className="text-[12.5px] font-medium text-vigilInk">
                Locked until Monday, {formatDate(unlocksOn)}
              </p>
              <p className="mt-1 text-[12px] leading-relaxed text-vigilInkSoft">
                A target you can lower on a bad Thursday isn’t a target. Vigil holds it for the whole week on purpose —
                you can set a different one the moment the next week starts.
              </p>
            </div>
          </div>
        ) : (
          /* ---- Not chosen yet. Choose, then confirm. --------------------- */
          <div className="vigil-neu-raised rounded-card px-4 py-4">
            <p className="text-[12.5px] leading-relaxed text-vigilInkSoft">
              Vigil counts down from this every day. Five hours is only the starting suggestion — pick the number you
              will actually keep.
            </p>

            <div className="mt-3.5 flex flex-wrap gap-2">
              {PRESETS.map((seconds) => {
                const active = !customOpen && choice === seconds
                return (
                  <button
                    key={seconds}
                    type="button"
                    aria-pressed={active}
                    onClick={() => {
                      setCustomOpen(false)
                      setChoice(seconds)
                    }}
                    className={`min-h-[40px] rounded-full px-4 text-[13px] font-medium ${
                      active ? 'vigil-neu-pressed text-vigilGold' : 'vigil-neu-raised-sm text-vigilInk'
                    }`}
                  >
                    {formatTarget(seconds)}
                  </button>
                )
              })}
              <button
                type="button"
                aria-pressed={customOpen}
                onClick={() => {
                  setCustomOpen((open) => !open)
                  setChoice(null)
                  setCustom({ hours: '', minutes: '' })
                }}
                className={`min-h-[40px] rounded-full px-4 text-[13px] font-medium ${
                  customOpen ? 'vigil-neu-pressed text-vigilGold' : 'vigil-neu-raised-sm text-vigilInk'
                }`}
              >
                Custom
              </button>
            </div>

            {customOpen && (
              <div className="mt-3.5 flex gap-3">
                <label className="flex-1">
                  <span className="mb-1.5 block text-xs text-vigilInkSoft">Hours</span>
                  <input
                    type="number"
                    min={0}
                    max={12}
                    inputMode="numeric"
                    value={custom.hours}
                    onChange={(e) => applyCustom({ ...custom, hours: e.target.value })}
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
                    value={custom.minutes}
                    onChange={(e) => applyCustom({ ...custom, minutes: e.target.value })}
                    className="vigil-neu-pressed w-full rounded-card border-none bg-transparent px-4 py-3 text-vigilInk outline-none focus:ring-1 focus:ring-vigilGold"
                  />
                </label>
              </div>
            )}

            {/* The warning sits ABOVE the button, not in a toast afterwards. It is
                the whole condition of pressing it. */}
            <div
              className="vigil-neu-pressed mt-4 flex items-start gap-2.5 rounded-card px-3.5 py-3"
              role="note"
            >
              <span className="mt-px flex-shrink-0">
                <LockIcon size={14} />
              </span>
              <p className="text-[12px] leading-relaxed text-vigilInkSoft">
                <span className="font-medium text-vigilInk">This locks for the rest of the week.</span> Once set, it
                cannot be changed, lowered or cleared until Monday, {formatDate(unlocksOn)}.
              </p>
            </div>

            <button
              type="button"
              disabled={!choiceValid}
              onClick={() => setConfirming(choice)}
              className="vigil-neu-raised mt-3 min-h-[46px] w-full rounded-card text-sm font-semibold text-vigilGold disabled:opacity-45"
            >
              {choiceValid ? `Set ${formatTarget(choice!)} a day` : 'Choose a target'}
            </button>

            {customOpen && choice !== null && !choiceValid && (
              <p className="mt-2 text-center text-[11.5px] text-vigilInkSoft">
                Pick something between 30 minutes and 12 hours.
              </p>
            )}
          </div>
        )}
      </section>

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
            // Judged against the target its OWN week was set to, never today's —
            // a day in a 3h week stays a hit even if this week is 6h.
            const met = seconds >= targetFor(date)
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

      {/* ---- Confirming the target ---------------------------------------- */}
      <VigilSheet
        open={confirming !== null}
        onClose={() => (saving ? undefined : setConfirming(null))}
        title="Set this week’s target"
      >
        {confirming !== null && (
          <>
            <p className="mb-1 text-sm text-vigilInkSoft">Vigil will count down from</p>
            <p className="font-display mb-4 text-[32px] font-bold leading-none text-vigilInk">
              {formatTarget(confirming)}
              <span className="ml-2 text-base font-medium text-vigilInkSoft">a day</span>
            </p>

            <div className="vigil-neu-pressed mb-5 rounded-card px-4 py-3.5">
              <p className="text-[13px] leading-relaxed text-vigilInk">
                This is fixed until <span className="font-semibold">Monday, {formatDate(unlocksOn)}</span>.
              </p>
              <p className="mt-1.5 text-[12.5px] leading-relaxed text-vigilInkSoft">
                It cannot be raised, lowered or removed before then — not from here, and not from another device. That
                is the point: a target you can move mid-week is one the week always meets.
              </p>
            </div>

            <button
              type="button"
              onClick={() => void confirmTarget()}
              disabled={saving}
              className="vigil-neu-raised min-h-[46px] w-full rounded-card text-sm font-semibold text-vigilGold disabled:opacity-50"
            >
              {saving ? 'Setting…' : `Lock in ${formatTarget(confirming)}`}
            </button>
            <button
              type="button"
              onClick={() => setConfirming(null)}
              disabled={saving}
              className="mt-2 min-h-[42px] w-full rounded-card text-[13px] text-vigilInkSoft disabled:opacity-50"
            >
              Not yet
            </button>
          </>
        )}
      </VigilSheet>

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
