import { useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import LoginForm from '../components/LoginForm'

interface LocationState { from?: { pathname?: string } }

export default function Login() {
  const { loginAsGuest } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  function goBack() {
    const to = (location.state as LocationState | null)?.from?.pathname ?? '/app'
    navigate(to, { replace: true })
  }

  async function onGuest() {
    setError(null)
    setBusy(true)
    const res = await loginAsGuest()
    setBusy(false)
    if (res.ok) goBack()
    else setError(res.error ?? 'Chyba')
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-neutral-50">
      <div className="bg-white p-8 rounded-lg shadow-sm border border-neutral-200 w-full max-w-sm">
        <h1 className="text-xl font-semibold mb-6">Přihlášení</h1>
        <LoginForm onSuccess={goBack} autoFocus />
        <div className="mt-6 pt-4 border-t border-neutral-200">
          {error && <div className="text-sm text-red-600 mb-3">{error}</div>}
          <button type="button" onClick={() => void onGuest()} disabled={busy}
            className="w-full border border-neutral-300 rounded py-2 text-sm text-neutral-700 hover:bg-neutral-50 disabled:opacity-50">
            Pokračovat bez přihlášení
          </button>
        </div>
      </div>
    </div>
  )
}
