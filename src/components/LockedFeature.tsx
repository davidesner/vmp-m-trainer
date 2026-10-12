import { Link } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'

export default function LockedFeature({ title }: { title?: string }) {
  const { signupEnabled } = useAuth()
  return (
    <div className="bg-white border border-neutral-200 rounded-lg p-5 md:p-6">
      {title && <div className="text-xs uppercase tracking-wide text-neutral-500 mb-2">{title}</div>}
      <div className="flex items-start gap-3">
        <span className="text-2xl leading-none" aria-hidden>🔒</span>
        <div>
          <p className="text-sm text-neutral-700">Přihlas se a uvidíš odhad úspěchu, slabiny a historii testů</p>
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
