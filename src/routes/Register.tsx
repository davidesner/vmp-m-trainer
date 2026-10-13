import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import Turnstile from '../components/Turnstile'

export default function Register() {
  const { register, captchaSiteKey } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [captchaToken, setCaptchaToken] = useState<string | null>(null)
  // Tokens are single-use, so every failed attempt remounts the widget for a fresh one.
  const [captchaRound, setCaptchaRound] = useState(0)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    if (password.length < 8) { setError('Heslo musí mít aspoň 8 znaků'); return }
    if (!captchaToken) { setError('Počkej na ověření, že nejsi robot'); return }
    setBusy(true)
    const res = await register(email.trim().toLowerCase(), password, captchaToken)
    setBusy(false)
    if (res.ok) { navigate('/app', { replace: true }); return }
    setError(res.error ?? 'Chyba')
    setCaptchaToken(null)
    setCaptchaRound(r => r + 1)
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-neutral-50">
      <form onSubmit={onSubmit} className="bg-white p-8 rounded-lg shadow-sm border border-neutral-200 w-full max-w-sm">
        <h1 className="text-xl font-semibold mb-6">Vytvořit účet</h1>
        <label className="block mb-3">
          <span className="block text-sm text-neutral-700 mb-1">Email</span>
          <input type="email" autoFocus required value={email}
            onChange={e => setEmail(e.target.value)}
            className="w-full border border-neutral-300 rounded px-3 py-2" />
        </label>
        <label className="block mb-3">
          <span className="block text-sm text-neutral-700 mb-1">Heslo <span className="text-neutral-500">(aspoň 8 znaků)</span></span>
          <input type="password" autoComplete="new-password" required minLength={8} value={password}
            onChange={e => setPassword(e.target.value)}
            className="w-full border border-neutral-300 rounded px-3 py-2" />
        </label>
        <div className="mb-4 min-h-[65px]">
          {captchaSiteKey && <Turnstile key={captchaRound} siteKey={captchaSiteKey} onToken={setCaptchaToken} />}
          {captchaSiteKey === null && (
            <p className="text-sm text-neutral-600">Registrace teď není dostupná.</p>
          )}
        </div>
        {error && <div className="text-sm text-red-600 mb-3">{error}</div>}
        <button type="submit" disabled={busy || !captchaToken}
          className="w-full bg-primary text-white rounded py-2 hover:bg-primary-dark disabled:opacity-50">
          {busy ? 'Zakládám…' : 'Vytvořit účet'}
        </button>
        <p className="text-sm text-neutral-600 mt-4 text-center">
          Už máš účet?{' '}
          <Link to="/login" className="text-primary hover:underline">Přihlásit</Link>
        </p>
      </form>
    </div>
  )
}
