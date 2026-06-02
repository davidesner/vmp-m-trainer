import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'

export default function Register() {
  const { register, signupEnabled } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [code, setCode] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    if (password.length < 8) { setError('Heslo musí mít aspoň 8 znaků'); return }
    if (password !== confirm) { setError('Hesla se neshodují'); return }
    setBusy(true)
    const res = await register(email.trim().toLowerCase(), password, code)
    setBusy(false)
    if (res.ok) navigate('/', { replace: true })
    else setError(res.error ?? 'Chyba')
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-neutral-50">
      <form onSubmit={onSubmit} className="bg-white p-8 rounded-lg shadow-sm border border-neutral-200 w-full max-w-sm">
        <h1 className="text-xl font-semibold mb-6">Vytvořit účet</h1>
        {!signupEnabled && (
          <div className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded px-3 py-2 mb-4">
            Registrace je momentálně vypnutá.
          </div>
        )}
        <label className="block mb-3">
          <span className="block text-sm text-neutral-700 mb-1">Email</span>
          <input type="email" autoFocus required value={email}
            onChange={e => setEmail(e.target.value)}
            className="w-full border border-neutral-300 rounded px-3 py-2" />
        </label>
        <label className="block mb-3">
          <span className="block text-sm text-neutral-700 mb-1">Heslo</span>
          <input type="password" required minLength={8} value={password}
            onChange={e => setPassword(e.target.value)}
            className="w-full border border-neutral-300 rounded px-3 py-2" />
        </label>
        <label className="block mb-3">
          <span className="block text-sm text-neutral-700 mb-1">Heslo znovu</span>
          <input type="password" required value={confirm}
            onChange={e => setConfirm(e.target.value)}
            className="w-full border border-neutral-300 rounded px-3 py-2" />
        </label>
        <label className="block mb-4">
          <span className="block text-sm text-neutral-700 mb-1">Registrační kód</span>
          <input type="text" required value={code}
            onChange={e => setCode(e.target.value)}
            className="w-full border border-neutral-300 rounded px-3 py-2" />
        </label>
        {error && <div className="text-sm text-red-600 mb-3">{error}</div>}
        <button type="submit" disabled={busy || !signupEnabled}
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
