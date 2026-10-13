import { Link } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'

const MESSAGE = 'Přihlas se a uvidíš odhad úspěchu, slabiny a historii testů'

/** `compact` renders a one-line banner placed above a preview with empty values. */
export default function LockedFeature({ compact = false }: { compact?: boolean }) {
  const { signupEnabled } = useAuth()
  if (compact) return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 bg-amber-50 border border-amber-200 rounded px-3 py-2 text-sm text-neutral-700">
      <span aria-hidden>🔒</span>
      <span className="flex-1 min-w-0">{MESSAGE}</span>
      <Link to="/login" className="font-semibold text-accent hover:underline whitespace-nowrap">Přihlásit se</Link>
      {signupEnabled && (
        <Link to="/register" className="text-accent hover:underline whitespace-nowrap">Vytvořit účet</Link>
      )}
    </div>
  )
  return (
    <div className="bg-white border border-neutral-200 rounded-lg p-5 md:p-6">
      <div className="flex items-start gap-3">
        <span className="text-2xl leading-none" aria-hidden>🔒</span>
        <div>
          <p className="text-sm text-neutral-700">{MESSAGE}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Link to="/login" className="px-4 py-2 bg-primary hover:bg-primary-dark text-white rounded text-sm font-semibold">
              Přihlásit se
            </Link>
            {signupEnabled && (
              <Link to="/register" className="px-4 py-2 border border-neutral-300 rounded text-sm hover:bg-neutral-50">
                Vytvořit účet
              </Link>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
