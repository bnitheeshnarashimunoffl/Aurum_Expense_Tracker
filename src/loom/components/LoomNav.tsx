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
    to: '/loom',
    label: 'Timetable',
    icon: (
      <NavIcon>
        <rect x="3.5" y="4.5" width="17" height="15" rx="2" />
        <path d="M3.5 9h17" />
        <path d="M9 9v10.5" />
        <path d="M14.5 9v10.5" />
      </NavIcon>
    ),
  },
  {
    to: '/loom/classes',
    label: 'Classes',
    icon: (
      <NavIcon>
        <path d="M4 5.5h16" />
        <path d="M4 12h16" />
        <path d="M4 18.5h16" />
        <circle cx="7.5" cy="5.5" r="1.6" fill="currentColor" stroke="none" />
        <circle cx="13" cy="12" r="1.6" fill="currentColor" stroke="none" />
        <circle cx="9.5" cy="18.5" r="1.6" fill="currentColor" stroke="none" />
      </NavIcon>
    ),
  },
  {
    to: '/loom/terms',
    label: 'Terms',
    icon: (
      <NavIcon>
        <rect x="3.5" y="5" width="17" height="15" rx="2" />
        <path d="M8 3v4" />
        <path d="M16 3v4" />
        <path d="M8 13h8" />
      </NavIcon>
    ),
  },
]

export default function LoomNav() {
  return (
    <nav className="loom-glass fixed inset-x-0 bottom-0 z-30 mx-auto flex max-w-lg items-center justify-around pb-safe-bottom pt-2">
      {NAV_ITEMS.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          end={item.to === '/loom'}
          className={({ isActive }) =>
            `flex min-h-[44px] min-w-[44px] flex-col items-center justify-center gap-1 px-3 pb-2 text-[11px] ${
              isActive ? 'text-loomGold' : 'text-loomMuted'
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
