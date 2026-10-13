import { useState } from 'react'
import { Link } from 'react-router-dom'
import LoginForm from './LoginForm'
import { useAuth, type SsoProvider } from '../hooks/useAuth'

/**
 * Sign-in / sign-up entry points. Google and Seznam create the account on first
 * use, so the same buttons serve both new and returning users.
 * A provider's button works only when the server has its client credentials
 * (reported by /api/auth/config); otherwise it shows as coming soon.
 */
const SSO_PROVIDERS: Array<{ id: SsoProvider; name: string; href: string }> = [
  { id: 'google', name: 'Google', href: '/api/auth/oauth/google' },
  { id: 'seznam', name: 'Seznam', href: '/api/auth/oauth/seznam' },
]

function GoogleMark() {
  return (
    <svg aria-hidden="true" viewBox="0 0 48 48" className="w-5 h-5 shrink-0">
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
      <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
    </svg>
  )
}

// Official Seznam "S" (red variant) from https://vyvojari.seznam.cz/static/oauth/seznam-logo-esko.zip
function SeznamMark() {
  return (
    <svg aria-hidden="true" viewBox="0 0 36 36" className="w-5 h-5 shrink-0">
      <path fill="#C00" d="M1.787 36c6.484 0 32.915-3.09 32.915-11.363 0-5.04-6.752-7.444-9.526-8.25-5.286-1.533-9.574-3.115-9.574-4.502 0-1.386 3.004-1.677 6.229-2.39 4.295-.95 6.102-1.474 6.102-3.758 0-1.488-1.143-3.304-1.724-4.086C25.195.288 25.034 0 24.703 0c-.716 0-.15.927-8.231 2.29-5.119.863-11.932 3.168-11.932 7.836 0 4.667 6.092 6.833 12.192 9.041 6.286 2.275 11.542 3.106 11.542 6.735 0 5.788-24.84 9.441-26.45 9.709-.753.125-.63.389-.038.389z" />
    </svg>
  )
}

interface Props {
  onSuccess: () => void
  tone?: 'light' | 'dark'
}

export default function AuthOptions({ onSuccess, tone = 'light' }: Props) {
  const [emailOpen, setEmailOpen] = useState(false)
  const { sso } = useAuth()
  const dark = tone === 'dark'
  const providers = SSO_PROVIDERS.map(p => ({ ...p, ready: sso?.[p.id] === true }))
  // Wait for the config before calling anything "coming soon", so working buttons don't flash it.
  const pending = sso ? providers.filter(p => !p.ready).map(p => p.name) : []
  const muted = dark ? 'text-river-line' : 'text-neutral-600'
  const linkCls = dark ? 'text-white underline underline-offset-2 hover:no-underline' : 'text-accent hover:underline'

  return (
    <div>
      <div className="grid gap-3 grid-cols-[repeat(auto-fit,minmax(14rem,1fr))]">
        {providers.map(p => {
          const cls = `inline-flex items-center justify-center gap-3 px-5 py-3 rounded-md bg-white text-neutral-900 font-medium border ${
            dark ? 'border-transparent' : 'border-neutral-300'} hover:bg-neutral-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary transition-colors`
          const content = <>{p.id === 'google' ? <GoogleMark /> : <SeznamMark />}<span className="whitespace-nowrap">Pokračovat přes {p.name}</span></>
          return p.ready
            ? <a key={p.id} href={p.href} className={cls}>{content}</a>
            : <button key={p.id} type="button" disabled aria-describedby={pending.length ? 'sso-pending' : undefined} className={`${cls} disabled:opacity-60 disabled:cursor-not-allowed`}>{content}</button>
        })}
      </div>
      {pending.length > 0 && (
        <p id="sso-pending" className={`mt-2 text-xs ${muted}`}>Přihlášení přes {pending.join(' a ')} připravujeme.</p>
      )}

      <div className="mt-4">
        {!emailOpen ? (
          <button type="button" onClick={() => setEmailOpen(true)} aria-expanded={false}
            className={`text-sm font-medium ${linkCls}`}>
            Pokračovat emailem
          </button>
        ) : (
          <div className={`pt-4 border-t ${dark ? 'border-white/15' : 'border-neutral-200'}`}>
            <LoginForm tone={tone} inline={dark} autoFocus onSuccess={onSuccess} />
            <p className={`mt-3 text-sm ${muted}`}>
              Nemáš účet?{' '}
              <Link to="/register" className={linkCls}>Zaregistruj se</Link>
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
