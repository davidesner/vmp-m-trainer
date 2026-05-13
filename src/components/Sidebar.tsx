import { useEffect, useState } from 'react'
import { NavLink } from 'react-router-dom'

const items = [
  { to: '/',         label: '🏠 Přehled' },
  { to: '/practice', label: '📚 Procvičování' },
  { to: '/weak',     label: '🎯 Slabiny' },
  { to: '/stats',    label: '📊 Statistiky' },
  { to: '/settings', label: '⚙ Nastavení' },
]

function NavItems({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <>
      {items.map(i => (
        <NavLink
          key={i.to}
          to={i.to}
          end
          onClick={onNavigate}
          className={({ isActive }) =>
            `px-3 py-2 rounded text-sm ${isActive ? 'bg-primary-light text-primary-dark font-medium' : 'text-neutral-700 hover:bg-neutral-100'}`
          }
        >
          {i.label}
        </NavLink>
      ))}
    </>
  )
}

export default function Sidebar() {
  const [mobileOpen, setMobileOpen] = useState(false)

  useEffect(() => {
    document.body.style.overflow = mobileOpen ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [mobileOpen])

  return (
    <>
      {/* Mobile top bar */}
      <header className="md:hidden fixed top-0 inset-x-0 z-30 h-14 bg-white border-b border-neutral-200 flex items-center justify-between px-4">
        <div className="font-bold text-base">⚓ VMP M Trenažér</div>
        <button
          type="button"
          aria-label="Otevřít menu"
          aria-expanded={mobileOpen}
          onClick={() => setMobileOpen(true)}
          className="w-10 h-10 flex items-center justify-center rounded hover:bg-neutral-100 -mr-2"
        >
          <span className="block w-6 h-0.5 bg-neutral-900 relative before:content-[''] before:block before:w-6 before:h-0.5 before:bg-neutral-900 before:absolute before:-top-2 after:content-[''] after:block after:w-6 after:h-0.5 after:bg-neutral-900 after:absolute after:top-2" />
        </button>
      </header>

      {/* Mobile drawer + backdrop */}
      {mobileOpen && (
        <div
          className="md:hidden fixed inset-0 z-40 bg-black/50"
          onClick={() => setMobileOpen(false)}
          aria-hidden
        />
      )}
      <aside
        className={`md:hidden fixed top-0 left-0 z-50 h-full w-64 bg-white border-r border-neutral-200 p-4 flex flex-col gap-1 transform transition-transform duration-200 ease-out ${mobileOpen ? 'translate-x-0' : '-translate-x-full'}`}
      >
        <div className="flex items-center justify-between mb-4">
          <div className="font-bold text-base">⚓ VMP M Trenažér</div>
          <button
            type="button"
            aria-label="Zavřít menu"
            onClick={() => setMobileOpen(false)}
            className="w-9 h-9 flex items-center justify-center rounded hover:bg-neutral-100 text-xl leading-none text-neutral-600"
          >
            ✕
          </button>
        </div>
        <NavItems onNavigate={() => setMobileOpen(false)} />
      </aside>

      {/* Desktop sidebar */}
      <aside className="hidden md:flex w-56 shrink-0 bg-white border-r border-neutral-200 p-4 flex-col gap-1">
        <div className="font-bold text-base mb-4">⚓ VMP M Trenažér</div>
        <NavItems />
      </aside>
    </>
  )
}
