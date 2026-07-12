import { NavLink } from 'react-router-dom'

const NAV_ITEMS = [
  { to: '/', label: 'Home', icon: '◐' },
  { to: '/transactions', label: 'Activity', icon: '≡' },
  { to: '/budgets', label: 'Budgets', icon: '◔' },
  { to: '/settings', label: 'Settings', icon: '⚙' },
]

export default function BottomNav({ onAddClick }: { onAddClick: () => void }) {
  return (
    <nav className="glass fixed inset-x-0 bottom-0 z-30 flex items-center justify-around pb-safe-bottom pt-2">
      {NAV_ITEMS.slice(0, 2).map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          end={item.to === '/'}
          className={({ isActive }) =>
            `flex min-h-[44px] min-w-[44px] flex-col items-center justify-center gap-0.5 px-3 pb-2 text-xs ${
              isActive ? 'text-accent' : 'text-muted'
            }`
          }
        >
          <span className="text-lg leading-none">{item.icon}</span>
          {item.label}
        </NavLink>
      ))}

      <button
        onClick={onAddClick}
        aria-label="Add transaction"
        className="neu-raised -mt-6 flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-full bg-accent text-2xl"
        style={{ color: '#0B0D10' }}
      >
        +
      </button>

      {NAV_ITEMS.slice(2).map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          className={({ isActive }) =>
            `flex min-h-[44px] min-w-[44px] flex-col items-center justify-center gap-0.5 px-3 pb-2 text-xs ${
              isActive ? 'text-accent' : 'text-muted'
            }`
          }
        >
          <span className="text-lg leading-none">{item.icon}</span>
          {item.label}
        </NavLink>
      ))}
    </nav>
  )
}
