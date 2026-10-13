import { useState, type FormEvent } from 'react'
import { useAuth } from '../hooks/useAuth'

interface Props {
  onSuccess: () => void
  /** 'dark' renders on the landing page's dark hero, 'light' on a white card. */
  tone?: 'light' | 'dark'
  autoFocus?: boolean
  /** Lays email and password side by side from the sm breakpoint up. */
  inline?: boolean
}

export default function LoginForm({ onSuccess, tone = 'light', autoFocus = false, inline = false }: Props) {
  const { login } = useAuth()
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
    if (res.ok) onSuccess()
    else setError(res.error ?? 'Chyba')
  }

  const dark = tone === 'dark'
  const labelCls = `block text-sm mb-1 ${dark ? 'text-river-line' : 'text-neutral-700'}`
  const inputCls = `w-full rounded px-3 py-2 text-neutral-900 bg-white border ${dark ? 'border-transparent focus:outline focus:outline-2 focus:outline-primary' : 'border-neutral-300'}`

  return (
    <form onSubmit={onSubmit} aria-label="Přihlášení">
      <div className={inline ? 'grid sm:grid-cols-2 gap-3 mb-4' : 'mb-4 flex flex-col gap-3'}>
        <label className="block">
          <span className={labelCls}>Email</span>
          <input type="email" name="email" autoComplete="email" autoFocus={autoFocus} required value={email}
            onChange={e => setEmail(e.target.value)} className={inputCls} />
        </label>
        <label className="block">
          <span className={labelCls}>Heslo</span>
          <input type="password" name="password" autoComplete="current-password" required value={password}
            onChange={e => setPassword(e.target.value)} className={inputCls} />
        </label>
      </div>
      {error && <div role="alert" className={`text-sm mb-3 ${dark ? 'text-red-300' : 'text-red-600'}`}>{error}</div>}
      <div>
        <button type="submit" disabled={busy}
          className={dark
            ? 'px-6 py-2.5 rounded-md border border-white/40 text-white font-medium hover:bg-white/10 disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary transition-colors'
            : 'w-full bg-primary text-white rounded py-2 hover:bg-primary-dark disabled:opacity-50'}>
          {busy ? 'Přihlašuji…' : 'Přihlásit se'}
        </button>
      </div>
    </form>
  )
}
