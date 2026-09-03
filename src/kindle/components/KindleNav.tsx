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
    to: '/kindle',
    label: 'Grid',
    icon: (
      <NavIcon>
        <rect x="4" y="4" width="16" height="16" rx="2" />
        <path d="M4 10h16" />
        <path d="M10 4v16" />
      </NavIcon>
    ),
  },
  {
    to: '/kindle/history',
    label: 'History',
    icon: (
      <NavIcon>
        <circle cx="12" cy="12" r="8" />
        <path d="M12 8v4l3 2" />
      </NavIcon>
    ),
  },
  {
    to: '/kindle/settings',
    label: 'Settings',
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

export default function KindleNav() {
  return (
    <nav className="kindle-glass fixed inset-x-0 bottom-0 z-30 flex items-center justify-around pb-safe-bottom pt-2">
      {NAV_ITEMS.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          // Anchor for Kindle's walkthrough — see src/onboarding/steps.ts.
          data-tour={item.to === '/kindle/history' ? 'kindle-history' : undefined}
          end={item.to === '/kindle'}
          className={({ isActive }) =>
            `flex min-h-[44px] min-w-[44px] flex-col items-center justify-center gap-1 px-3 pb-2 text-[11px] ${
              isActive ? 'text-accent' : 'text-muted'
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
