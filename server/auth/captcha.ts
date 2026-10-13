const SITEVERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify'
const VERIFY_TIMEOUT_MS = 5000

/** Outcome of a server-side captcha check. 'unavailable' means Cloudflare could not be reached. */
export type CaptchaResult = 'ok' | 'failed' | 'unavailable'

export interface Captcha {
  /** Public key the SPA needs to render the widget. */
  siteKey: string
  verify: (token: string, ip?: string) => Promise<CaptchaResult>
}

/** Cloudflare Turnstile verifier. Tokens are single-use and valid for 5 minutes. */
export function turnstile(siteKey: string, secretKey: string): Captcha {
  return {
    siteKey,
    async verify(token, ip) {
      try {
        const res = await fetch(SITEVERIFY_URL, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ secret: secretKey, response: token, remoteip: ip }),
          signal: AbortSignal.timeout(VERIFY_TIMEOUT_MS),
        })
        if (!res.ok) return 'unavailable'
        const body = await res.json() as { success?: boolean }
        return body.success === true ? 'ok' : 'failed'
      } catch {
        return 'unavailable'
      }
    },
  }
}
