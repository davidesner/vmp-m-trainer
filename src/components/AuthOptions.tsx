import { useState } from 'react'
import { Link } from 'react-router-dom'
import LoginForm from './LoginForm'

/**
 * Sign-in / sign-up entry points. Google and Seznam create the account on first
 * use, so the same buttons serve both new and returning users.
 * SSO is UI-only for now: flip `ready` and point `href` at the OAuth start
 * endpoint once the backend exists.
 */
const SSO_PROVIDERS: Array<{ id: 'google' | 'seznam'; label: string; href: string; ready: boolean }> = [
  { id: 'google', label: 'Pokračovat přes Google', href: '/api/auth/oauth/google', ready: false },
  { id: 'seznam', label: 'Pokračovat přes Seznam', href: '/api/auth/oauth/seznam', ready: false },
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

// Placeholder mark; swap for the official asset from Seznam's sign-in button guidelines.
function SeznamMark() {
  return (
    <span aria-hidden="true" className="w-5 h-5 shrink-0 rounded-full bg-[#cc0000] text-white text-xs font-bold flex items-center justify-center">S</span>
  )
}

interface Props {
  onSuccess: () => void
  tone?: 'light' | 'dark'
}

export default function AuthOptions({ onSuccess, tone = 'light' }: Props) {
  const [emailOpen, setEmailOpen] = useState(false)
  const dark = tone === 'dark'
  const anyPending = SSO_PROVIDERS.some(p => !p.ready)
  const muted = dark ? 'text-river-line' : 'text-neutral-600'
  const linkCls = dark ? 'text-white underline underline-offset-2 hover:no-underline' : 'text-accent hover:underline'

  return (
    <div>
      <div className="grid gap-3 grid-cols-[repeat(auto-fit,minmax(14rem,1fr))]">
        {SSO_PROVIDERS.map(p => {
          const cls = `inline-flex items-center justify-center gap-3 px-5 py-3 rounded-md bg-white text-neutral-900 font-medium border ${
            dark ? 'border-transparent' : 'border-neutral-300'} hover:bg-neutral-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary transition-colors`
          const content = <>{p.id === 'google' ? <GoogleMark /> : <SeznamMark />}<span className="whitespace-nowrap">{p.label}</span></>
          return p.ready
            ? <a key={p.id} href={p.href} className={cls}>{content}</a>
            : <button key={p.id} type="button" disabled aria-describedby="sso-pending" className={`${cls} disabled:opacity-60 disabled:cursor-not-allowed`}>{content}</button>
        })}
      </div>
      {anyPending && (
        <p id="sso-pending" className={`mt-2 text-xs ${muted}`}>Přihlášení přes Google a Seznam připravujeme.</p>
      )}

      <div className="mt-4">
        {!emailOpen ? (
          <button type="button" onClick={() => setEmailOpen(true)} aria-expanded={false}
            className={`text-sm font-medium ${linkCls}`}>
            Přihlásit se emailem
          </button>
        ) : (
          <div className={`pt-4 border-t ${dark ? 'border-white/15' : 'border-neutral-200'}`}>
            <LoginForm tone={tone} inline={dark} autoFocus onSuccess={onSuccess} />
          </div>
        )}
        <p className={`mt-3 text-sm ${muted}`}>
          Nemáš účet?{' '}
          <Link to="/register" className={linkCls}>Zaregistruj se emailem</Link>
        </p>
      </div>
    </div>
  )
}
