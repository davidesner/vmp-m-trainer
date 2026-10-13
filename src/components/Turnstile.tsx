import { useEffect, useRef, useState } from 'react'

const SCRIPT_URL = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'

interface TurnstileApi {
  render: (el: HTMLElement, opts: Record<string, unknown>) => string
  remove: (widgetId: string) => void
}

declare global {
  interface Window { turnstile?: TurnstileApi }
}

let scriptPromise: Promise<TurnstileApi> | null = null

/** Loads the Cloudflare script once per page; a failed load can be retried by remounting. */
function loadTurnstile(): Promise<TurnstileApi> {
  if (window.turnstile) return Promise.resolve(window.turnstile)
  scriptPromise ??= new Promise<TurnstileApi>((resolve, reject) => {
    const script = document.createElement('script')
    script.src = SCRIPT_URL
    script.async = true
    script.onload = () => (window.turnstile ? resolve(window.turnstile) : reject(new Error('turnstile missing')))
    script.onerror = () => reject(new Error('turnstile script failed to load'))
    document.head.appendChild(script)
  }).catch(err => {
    scriptPromise = null
    throw err
  })
  return scriptPromise
}

/**
 * Cloudflare Turnstile widget. Reports a fresh token via `onToken`, or null once it
 * expires or fails. Tokens are single-use: remount (change `key`) to get a new one.
 */
export default function Turnstile({ siteKey, onToken }: { siteKey: string; onToken: (token: string | null) => void }) {
  const containerRef = useRef<HTMLDivElement>(null)
  const onTokenRef = useRef(onToken)
  const [failed, setFailed] = useState(false)

  useEffect(() => { onTokenRef.current = onToken })

  useEffect(() => {
    let widgetId: string | null = null
    let cancelled = false
    loadTurnstile().then(api => {
      if (cancelled || !containerRef.current) return
      widgetId = api.render(containerRef.current, {
        sitekey: siteKey,
        language: 'cs',
        theme: 'light',
        callback: (token: string) => { setFailed(false); onTokenRef.current(token) },
        'expired-callback': () => onTokenRef.current(null),
        'error-callback': () => { setFailed(true); onTokenRef.current(null) },
      })
    }).catch(() => { if (!cancelled) setFailed(true) })
    return () => {
      cancelled = true
      if (widgetId) window.turnstile?.remove(widgetId)
    }
  }, [siteKey])

  return (
    <div>
      <div ref={containerRef} data-testid="turnstile" />
      {failed && (
        <p className="text-sm text-red-600 mt-1">
          Ověření, že nejsi robot, se nepodařilo načíst. Zkus obnovit stránku nebo vypnout blokování obsahu.
        </p>
      )}
    </div>
  )
}
