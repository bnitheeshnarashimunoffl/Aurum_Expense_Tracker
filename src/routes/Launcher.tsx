import { Link } from 'react-router-dom'
import type { CSSProperties, ReactNode } from 'react'
import Horizon from '@/components/Horizon'
import IosInstallBanner, { useIosInstallGate } from '@/components/IosInstallBanner'
import AurumCard from '@/components/dashboard/AurumCard'
import KindleCard from '@/components/dashboard/KindleCard'
import VigilCard from '@/components/dashboard/VigilCard'
import LoomCard from '@/components/dashboard/LoomCard'
import ModuleWalkthrough from '@/onboarding/ModuleWalkthrough'
import { useNotificationSettings } from '@/hooks/useNotificationSettings'
import FlameIcon from '@/kindle/components/FlameIcon'
import HourglassIcon from '@/vigil/components/HourglassIcon'
import LoomIcon from '@/loom/components/LoomIcon'
import LaurelIcon from '@/virtus/components/LaurelIcon'
import QuillIcon from '@/chronicle/components/QuillIcon'

interface AppTile {
  id: string
  label: string
  to: string
  icon: ReactNode
}

// Miniature of the Aurum app icon's disc + brass ring motif (see public/icon-source.svg),
// so the launcher tile reads as the same brand rather than a new mark.
function AurumTileIcon() {
  return (
    <svg width="34" height="34" viewBox="0 0 34 34" fill="none" aria-hidden>
      <circle cx="17" cy="17" r="15" fill="var(--bg-base)" />
      <circle
        cx="17"
        cy="17"
        r="12"
        fill="none"
        stroke="var(--accent)"
        strokeWidth="2"
        strokeLinecap="round"
        strokeDasharray="56 75.5"
        transform="rotate(-90 17 17)"
      />
    </svg>
  )
}

// Add a tile here as each new module joins Meridian. Laid out three and three:
// two even rows read as a considered grid, where four-then-two read as a row that
// ran out.
const APPS: AppTile[] = [
  { id: 'aurum', label: 'Aurum', to: '/aurum', icon: <AurumTileIcon /> },
  { id: 'kindle', label: 'Kindle', to: '/kindle', icon: <FlameIcon size={30} /> },
  { id: 'vigil', label: 'Vigil', to: '/vigil', icon: <HourglassIcon size={30} /> },
  { id: 'loom', label: 'Loom', to: '/loom', icon: <LoomIcon size={30} /> },
  { id: 'virtus', label: 'Virtus', to: '/virtus', icon: <LaurelIcon size={30} /> },
  { id: 'chronicle', label: 'Chronicle', to: '/chronicle', icon: <QuillIcon size={30} /> },
]

function todayLabel(): string {
  return new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })
}

function GearIcon() {
  return (
    <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="1.7" strokeLinecap="round" aria-hidden>
      <path d="M4.5 8h15" />
      <circle cx="9.5" cy="8" r="2.4" />
      <path d="M4.5 16h15" />
      <circle cx="14.5" cy="16" r="2.4" />
    </svg>
  )
}

/**
 * The Meridian dashboard — the first screen of every session and the most-seen
 * surface in the whole platform.
 *
 * It is built in three bands, and the order is the argument: the six apps first
 * (this is a launcher, and the icon grid is what people came for), then today's
 * numbers, then the horizon that closes the page. Putting the cards above the
 * grid would have made a dashboard that happens to contain a launcher, which is
 * backwards — the cards exist so you DON'T have to open the apps, not instead of
 * them.
 *
 * Only four modules get a card. Virtus and Chronicle deliberately do not: a gym
 * log and a notes app have nothing that is true at a glance the way a balance or
 * a next class is, and four cards is already the point at which a dashboard stops
 * being scannable.
 */
export default function Launcher() {
  const { settings } = useNotificationSettings()
  const installGate = useIosInstallGate()

  // The banner is only an interruption when it is explaining something the user
  // has actually asked for: notifications are on for this account, but this
  // device is an iOS browser tab, where they will silently never arrive.
  const showInstallBanner = installGate.visible && settings.enabled

  return (
    <div className="relative mx-auto min-h-full max-w-lg px-5 pb-16 pt-safe-top">
      <header className="relative pt-10">
        <h1 className="font-display text-center text-sm font-semibold tracking-[0.35em] text-muted">MERIDIAN</h1>
        <p className="mt-1.5 text-center text-[12px] text-muted opacity-70">{todayLabel()}</p>

        <Link
          to="/settings"
          data-tour="meridian-settings"
          aria-label="Meridian settings"
          className="neu-raised absolute right-0 flex h-11 w-11 items-center justify-center rounded-full focus:outline-none focus-visible:ring-1 focus-visible:ring-accent"
          style={{ top: 'calc(2.5rem - 0.5rem)' } as CSSProperties}
        >
          <GearIcon />
        </Link>
      </header>

      <div data-tour="meridian-grid" className="mt-11 grid grid-cols-3 gap-x-4 gap-y-7">
        {APPS.map((app) => (
          <Link
            key={app.id}
            to={app.to}
            className="flex min-h-[44px] flex-col items-center gap-2 focus:outline-none focus-visible:ring-1 focus-visible:ring-accent"
          >
            <span className="neu-raised flex h-16 w-16 items-center justify-center rounded-[22px] transition-transform active:scale-95">
              {app.icon}
            </span>
            <span className="text-xs text-muted">{app.label}</span>
          </Link>
        ))}
      </div>

      {/* The band divider, drawn as a miniature of the horizon below rather than as
          a plain rule — the same line, quieter, doing a different job. */}
      <div className="mt-11 flex items-center gap-3" aria-hidden>
        <span className="text-[10px] font-semibold uppercase tracking-[0.28em] text-muted">Today</span>
        <span
          className="h-px flex-1"
          style={{ background: 'linear-gradient(90deg, var(--accent), transparent 85%)', opacity: 0.55 }}
        />
      </div>

      <div data-tour="meridian-cards" className="mt-4 space-y-3">
        <AurumCard />
        <KindleCard />
        <VigilCard />
        <LoomCard />
      </div>

      <Horizon variant="inline" />

      {showInstallBanner && <IosInstallBanner variant="floating" onDismiss={installGate.dismiss} />}

      <ModuleWalkthrough module="meridian" />
    </div>
  )
}
