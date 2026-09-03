import { NavLink } from 'react-router-dom'
import type { ReactNode } from 'react'

function NavIcon({ children }: { children: ReactNode }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      {children}
    </svg>
  )
}

const NAV_ITEMS = [
  {
    to: '/virtus',
    label: 'Week',
    end: true,
    icon: (
      <NavIcon>
        <rect x="3" y="5" width="18" height="15" rx="2" />
        <path d="M3 10h18" />
        <path d="M9 5V3" />
        <path d="M15 5V3" />
      </NavIcon>
    ),
  },
  {
    to: '/virtus/train',
    label: 'Train',
    end: false,
    // A dumbbell, drawn as one bar with a plate at each end.
    icon: (
      <NavIcon>
        <path d="M9 12h6" />
        <path d="M6.5 8.5v7" />
        <path d="M17.5 8.5v7" />
        <path d="M4 10.5v3" />
        <path d="M20 10.5v3" />
      </NavIcon>
    ),
  },
  {
    to: '/virtus/settings',
    label: 'Settings',
    end: false,
    icon: (
      <NavIcon>
        <path d="M4.5 8h15" />
        <circle cx="9.5" cy="8" r="2.4" />
        <path d="M4.5 16h15" />
        <circle cx="14.5" cy="16" r="2.4" />
      </NavIcon>
    ),
  },
]

export default function VirtusNav() {
  return (
    <nav className="virtus-glass fixed inset-x-0 bottom-0 z-30 mx-auto flex max-w-lg items-center justify-around pb-safe-bottom pt-2">
      {NAV_ITEMS.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          // Anchor for Virtus's walkthrough — see src/onboarding/steps.ts.
          data-tour={item.to === '/virtus/settings' ? 'virtus-settings' : undefined}
          end={item.end}
          className={({ isActive }) =>
            `flex min-h-[44px] min-w-[44px] flex-col items-center justify-center gap-1 px-3 pb-2 text-[11px] focus:outline-none focus-visible:ring-2 focus-visible:ring-bronze ${
              isActive ? 'text-bronzeDeep' : 'text-inkSoft'
            }`
          }
        >
          {item.icon}
          {item.label}
        </NavLink>
      ))}
    </nav>
  )
}
