import { NavLink } from 'react-router-dom'

const items = [
  { to: '/',         label: '▶ Ostrý test',   highlight: true },
  { to: '/practice', label: '📚 Procvičování' },
  { to: '/weak',     label: '🎯 Slabiny' },
  { to: '/stats',    label: '📊 Statistiky' },
  { to: '/settings', label: '⚙ Nastavení' },
]

export default function Sidebar() {
  return (
    <aside className="w-56 shrink-0 bg-white border-r border-neutral-200 p-4 flex flex-col gap-1">
      <div className="font-bold text-base mb-4">⚓ VMP M Trenažér</div>
      {items.map(i => (
        <NavLink key={i.to} to={i.to} end className={({ isActive }) => `px-3 py-2 rounded text-sm ${isActive ? 'bg-primary-light text-primary-dark font-medium' : 'text-neutral-700 hover:bg-neutral-100'}`}>
          {i.label}
        </NavLink>
      ))}
    </aside>
  )
}
