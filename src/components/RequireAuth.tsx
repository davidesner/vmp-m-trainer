import type { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'

export default function RequireAuth({ children }: { children: ReactNode }) {
  const { user, loading, signedOutPath } = useAuth()
  const location = useLocation()
  if (loading) return <div className="p-8 text-sm text-neutral-500">Načítám…</div>
  if (!user) {
    return signedOutPath === '/login'
      ? <Navigate to="/login" state={{ from: location }} replace />
      : <Navigate to={signedOutPath} replace />
  }
  return <>{children}</>
}
