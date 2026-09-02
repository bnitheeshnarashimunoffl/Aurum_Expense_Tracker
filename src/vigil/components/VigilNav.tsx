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
    to: '/vigil',
    label: 'Today',
    icon: (
      <NavIcon>
        <path d="M6 3h12" />
        <path d="M6 21h12" />
        <path d="M7 3c0 4 5 6 5 9s-5 5-5 9" />
        <path d="M17 3c0 4-5 6-5 9s5 5 5 9" />
      </NavIcon>
    ),
  },
  {
    to: '/vigil/topics',
    label: 'Topics',
    icon: (
      <NavIcon>
        <path d="M5 5h5" />
        <path d="M5 5v14h5" />
        <path d="M5 12h5" />
        <path d="M14 3.5h5.5v3H14z" />
        <path d="M14 10.5h5.5v3H14z" />
        <path d="M14 17.5h5.5v3H14z" />
      </NavIcon>
    ),
  },
  {
    to: '/vigil/settings',
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

export default function VigilNav() {
  return (
    <nav className="vigil-glass fixed inset-x-0 bottom-0 z-30 mx-auto flex max-w-lg items-center justify-around pb-safe-bottom pt-2">
      {NAV_ITEMS.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          end={item.to === '/vigil'}
          className={({ isActive }) =>
            `flex min-h-[44px] min-w-[44px] flex-col items-center justify-center gap-1 px-3 pb-2 text-[11px] ${
              isActive ? 'text-vigilGold' : 'text-vigilInkSoft'
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
