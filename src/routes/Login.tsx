import { useState, type FormEvent } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'

interface LocationState { from?: { pathname?: string } }

export default function Login() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setBusy(true)
    const res = await login(email.trim().toLowerCase(), password)
    setBusy(false)
    if (res.ok) {
      const to = (location.state as LocationState | null)?.from?.pathname ?? '/'
      navigate(to, { replace: true })
    } else {
      setError(res.error ?? 'Chyba')
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-neutral-50">
      <form onSubmit={onSubmit} className="bg-white p-8 rounded-lg shadow-sm border border-neutral-200 w-full max-w-sm">
        <h1 className="text-xl font-semibold mb-6">Přihlášení</h1>
        <label className="block mb-3">
          <span className="block text-sm text-neutral-700 mb-1">Email</span>
          <input type="email" autoFocus required value={email}
            onChange={e => setEmail(e.target.value)}
            className="w-full border border-neutral-300 rounded px-3 py-2" />
        </label>
        <label className="block mb-4">
          <span className="block text-sm text-neutral-700 mb-1">Heslo</span>
          <input type="password" required value={password}
            onChange={e => setPassword(e.target.value)}
            className="w-full border border-neutral-300 rounded px-3 py-2" />
        </label>
        {error && <div className="text-sm text-red-600 mb-3">{error}</div>}
        <button type="submit" disabled={busy}
          className="w-full bg-primary text-white rounded py-2 hover:bg-primary-dark disabled:opacity-50">
          {busy ? 'Přihlašuji…' : 'Přihlásit'}
        </button>
      </form>
    </div>
  )
}
