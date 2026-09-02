import { Link } from 'react-router-dom'
import type { ReactNode } from 'react'
import Horizon from '@/components/Horizon'
import FlameIcon from '@/kindle/components/FlameIcon'
import HourglassIcon from '@/vigil/components/HourglassIcon'
import LoomIcon from '@/loom/components/LoomIcon'
import LaurelIcon from '@/virtus/components/LaurelIcon'

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

// Add a tile here as each new module joins Meridian — the grid and horizon
// don't need to change shape to accommodate more entries.
const APPS: AppTile[] = [
  { id: 'aurum', label: 'Aurum', to: '/aurum', icon: <AurumTileIcon /> },
  { id: 'kindle', label: 'Kindle', to: '/kindle', icon: <FlameIcon size={30} /> },
  { id: 'vigil', label: 'Vigil', to: '/vigil', icon: <HourglassIcon size={30} /> },
  { id: 'loom', label: 'Loom', to: '/loom', icon: <LoomIcon size={30} /> },
  { id: 'virtus', label: 'Virtus', to: '/virtus', icon: <LaurelIcon size={30} /> },
]

export default function Launcher() {
  return (
    <div className="relative flex min-h-full flex-col px-6 pb-40 pt-safe-top">
      <header className="pt-10 text-center">
        <h1 className="font-display text-sm font-semibold tracking-[0.35em] text-muted">MERIDIAN</h1>
      </header>

      <div className="relative z-10 flex flex-1 items-start justify-center pt-16">
        <div className="grid grid-cols-4 gap-x-4 gap-y-6">
          {APPS.map((app) => (
            <Link
              key={app.id}
              to={app.to}
              className="flex min-h-[44px] flex-col items-center gap-2 focus:outline-none focus-visible:ring-1 focus-visible:ring-accent"
            >
              <span className="neu-raised flex h-16 w-16 items-center justify-center rounded-[22px]">{app.icon}</span>
              <span className="text-xs text-muted">{app.label}</span>
            </Link>
          ))}
        </div>
      </div>

      <Horizon />
    </div>
  )
}
