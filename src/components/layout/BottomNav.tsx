import { NavLink } from 'react-router-dom'
import type { ReactNode } from 'react'

// Hand-drawn 24px stroke icons in one weight, instead of mismatched text glyphs.
// The Budgets icon deliberately echoes the Balance Dial's ring + needle.
function NavIcon({ children }: { children: ReactNode }) {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      {children}
    </svg>
  )
}

const NAV_ITEMS = [
  {
    to: '/aurum',
    label: 'Home',
    icon: (
      <NavIcon>
        <path d="M4 11.2 12 4.8l8 6.4V19a1 1 0 0 1-1 1h-4.6v-5.2h-4.8V20H5a1 1 0 0 1-1-1v-7.8z" />
      </NavIcon>
    ),
  },
  {
    to: '/aurum/transactions',
    label: 'Activity',
    icon: (
      <NavIcon>
        <path d="M4.5 6.5h15" />
        <path d="M4.5 12h15" />
        <path d="M4.5 17.5h9" />
      </NavIcon>
    ),
  },
  {
    to: '/aurum/budgets',
    label: 'Budgets',
    icon: (
      <NavIcon>
        <circle cx="12" cy="12" r="8" />
        <path d="M12 12l3.6-4.6" />
      </NavIcon>
    ),
  },
  {
    to: '/aurum/settings',
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

export default function BottomNav({ onAddClick }: { onAddClick: () => void }) {
  const renderItem = (item: (typeof NAV_ITEMS)[number]) => (
    <NavLink
      key={item.to}
      to={item.to}
      // Anchors for Aurum's walkthrough — see src/onboarding/steps.ts.
      data-tour={item.to === '/aurum/budgets' ? 'aurum-budgets' : undefined}
      end={item.to === '/aurum'}
      className={({ isActive }) =>
        `flex min-h-[44px] min-w-[44px] flex-col items-center justify-center gap-1 px-3 pb-2 text-[11px] ${
          isActive ? 'text-accent' : 'text-muted'
        }`
      }
    >
      {item.icon}
      {item.label}
    </NavLink>
  )

  return (
    <nav className="glass fixed inset-x-0 bottom-0 z-30 flex items-center justify-around pb-safe-bottom pt-2">
      {NAV_ITEMS.slice(0, 2).map(renderItem)}

      <button
        onClick={onAddClick}
        data-tour="aurum-add"
        aria-label="Add transaction"
        className="neu-raised -mt-6 flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-full bg-accent text-ink"
      >
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
          <path d="M12 5v14" />
          <path d="M5 12h14" />
        </svg>
      </button>

      {NAV_ITEMS.slice(2).map(renderItem)}
    </nav>
  )
}
