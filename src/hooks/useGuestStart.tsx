import { useState, type ReactNode } from 'react'
import { useAuth } from './useAuth'
import Turnstile from '../components/Turnstile'

/**
 * "Continue without an account": creates a guest session, behind a Cloudflare Turnstile check when the server
 * has one configured. The widget (and Cloudflare's script) only loads after the click, in interaction-only mode,
 * so most people never see it. Render `captcha` near the button; it is null until the check is running.
 */
export function useGuestStart(onSuccess: () => void): {
  start: () => void
  busy: boolean
  error: string | null
  captcha: ReactNode
} {
  const { loginAsGuest, captchaSiteKey } = useAuth()
  const [busy, setBusy] = useState(false)
  const [verifying, setVerifying] = useState(false)
  const [round, setRound] = useState(0)
  const [error, setError] = useState<string | null>(null)

  async function finish(token?: string) {
    const res = await loginAsGuest(token)
    setBusy(false)
    setVerifying(false)
    if (res.ok) onSuccess()
    else {
      setError(res.error ?? 'Nepodařilo se spustit trenažér')
      setRound(r => r + 1)  // tokens are single-use; the next attempt needs a fresh widget
    }
  }

  function start() {
    if (busy) return
    setError(null)
    setBusy(true)
    if (captchaSiteKey) setVerifying(true)
    else void finish()
  }

  const captcha = verifying && captchaSiteKey
    ? (
      <div className="mt-3">
        <Turnstile key={round} siteKey={captchaSiteKey} appearance="interaction-only"
          onToken={token => { if (token) void finish(token) }} />
      </div>
    )
    : null

  return { start, busy, error, captcha }
}
