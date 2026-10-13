import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'

export interface AuthUser {
  id: string
  email: string | null
  guest: boolean
  /** false for guests and SSO-only accounts, which confirm account deletion by typing DELETE_CONFIRM_WORD */
  hasPassword: boolean
}

/** Must match DELETE_CONFIRM_WORD in server/auth/routes.ts. */
export const DELETE_CONFIRM_WORD = 'SMAZAT'

export type DeleteAccountConfirmation = { password: string } | { confirm: string }

interface AuthResult { ok: boolean; error?: string }

export type SsoProvider = 'google' | 'seznam'
/** Which SSO providers the server has credentials for; null until /api/auth/config answers. */
export type SsoAvailability = Record<SsoProvider, boolean> | null

interface AuthCtx {
  user: AuthUser | null
  loading: boolean
  signupEnabled: boolean
  sso: SsoAvailability
  /** Turnstile site key for /register; undefined while /api/auth/config is loading, null when signup is off. */
  captchaSiteKey: string | null | undefined
  login: (email: string, password: string) => Promise<AuthResult>
  register: (email: string, password: string, captchaToken: string) => Promise<AuthResult>
  /** `captchaToken` is required when the server has a captcha configured (see useGuestStart). */
  loginAsGuest: (captchaToken?: string) => Promise<AuthResult>
  logout: () => Promise<void>
  /** Permanently deletes the signed-in account; on success the user is signed out. */
  deleteAccount: (confirmation: DeleteAccountConfirmation) => Promise<AuthResult>
  /** Where RequireAuth sends a signed-out visitor: the landing page right after account deletion, else /login. */
  signedOutPath: '/' | '/login'
  refresh: () => Promise<void>
}

const Ctx = createContext<AuthCtx | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [loading, setLoading] = useState(true)
  const [signupEnabled, setSignupEnabled] = useState(false)
  const [sso, setSso] = useState<SsoAvailability>(null)
  const [captchaSiteKey, setCaptchaSiteKey] = useState<string | null | undefined>(undefined)
  const [signedOutPath, setSignedOutPath] = useState<'/' | '/login'>('/login')

  useEffect(() => {
    void fetch('/api/auth/config', { credentials: 'same-origin' })
      .then(res => (res.ok ? res.json() : null))
      .then(cfg => {
        setSignupEnabled(Boolean(cfg?.signupEnabled))
        setCaptchaSiteKey(typeof cfg?.captchaSiteKey === 'string' ? cfg.captchaSiteKey : null)
        setSso({ google: cfg?.sso?.google === true, seznam: cfg?.sso?.seznam === true })
      })
      .catch(() => {
        setSignupEnabled(false)
        setCaptchaSiteKey(null)
        setSso({ google: false, seznam: false })
      })
  }, [])

  const refresh = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/me', { credentials: 'same-origin' })
      if (res.ok) setUser(await res.json())
      else setUser(null)
    } catch {
      setUser(null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void refresh() }, [refresh])

  const login = useCallback(async (email: string, password: string) => {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify({ email, password }),
    })
    if (res.ok) {
      setUser(await res.json())
      return { ok: true }
    }
    return { ok: false, error: res.status === 401 ? 'Špatný email nebo heslo' : `HTTP ${res.status}` }
  }, [])

  const register = useCallback(async (email: string, password: string, captchaToken: string) => {
    const res = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify({ email, password, captchaToken }),
    })
    if (res.ok) {
      setUser(await res.json())
      return { ok: true }
    }
    const body = await res.json().catch(() => null) as { error?: string } | null
    if (body?.error === 'captcha failed') return { ok: false, error: 'Ověření, že nejsi robot, neprošlo. Zkus to znovu.' }
    const errByStatus: Record<number, string> = {
      403: 'Registrace teď není dostupná',
      409: 'Tento email už je registrovaný',
      400: 'Zkontroluj email a heslo (min. 8 znaků)',
      429: 'Příliš mnoho pokusů, zkus to za chvíli',
      503: 'Ověření teď nefunguje, zkus to za chvíli',
    }
    return { ok: false, error: errByStatus[res.status] ?? `HTTP ${res.status}` }
  }, [])

  const loginAsGuest = useCallback(async (captchaToken?: string) => {
    const res = await fetch('/api/auth/guest', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify(captchaToken ? { captchaToken } : {}),
    })
    if (res.ok) {
      setUser(await res.json())
      return { ok: true }
    }
    const errByStatus: Record<number, string> = {
      403: 'Ověření, že nejsi robot, se nepovedlo. Zkus to znovu.',
      429: 'Příliš mnoho pokusů, zkus to za chvíli',
      503: 'Ověření, že nejsi robot, teď nefunguje. Zkus to za chvíli.',
    }
    return { ok: false, error: errByStatus[res.status] ?? `HTTP ${res.status}` }
  }, [])

  const logout = useCallback(async () => {
    await fetch('/api/auth/logout', { method: 'POST', credentials: 'same-origin' })
    setSignedOutPath('/login')
    setUser(null)
  }, [])

  const deleteAccount = useCallback(async (confirmation: DeleteAccountConfirmation) => {
    let res: Response
    try {
      res = await fetch('/api/me', {
        method: 'DELETE',
        headers: { 'content-type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify(confirmation),
      })
    } catch {
      return { ok: false, error: 'Nepodařilo se spojit se serverem, zkus to znovu' }
    }
    if (res.ok) {
      setSignedOutPath('/')
      setUser(null)
      return { ok: true }
    }
    const body = await res.json().catch(() => null) as { error?: string } | null
    if (body?.error === 'invalid password') return { ok: false, error: 'Špatné heslo' }
    if (body?.error === 'invalid confirmation') return { ok: false, error: `Pro potvrzení napiš ${DELETE_CONFIRM_WORD}` }
    const errByStatus: Record<number, string> = {
      401: 'Nejsi přihlášen, přihlas se znovu',
      403: 'Účet hosta nelze smazat',
      429: 'Příliš mnoho pokusů, zkus to za chvíli',
    }
    return { ok: false, error: errByStatus[res.status] ?? `Smazání se nepovedlo (HTTP ${res.status})` }
  }, [])

  return (
    <Ctx.Provider value={{ user, loading, signupEnabled, sso, captchaSiteKey, login, register, loginAsGuest, logout, deleteAccount, signedOutPath, refresh }}>
      {children}
    </Ctx.Provider>
  )
}

export function useAuth(): AuthCtx {
  const v = useContext(Ctx)
  if (!v) throw new Error('useAuth must be inside <AuthProvider>')
  return v
}

/** Guest flag for hooks that may render outside <AuthProvider> (e.g. in unit tests). */
export function useGuestStatus(): { isGuest: boolean; authLoading: boolean } {
  const v = useContext(Ctx)
  if (!v) return { isGuest: false, authLoading: false }
  return { isGuest: v.user?.guest === true, authLoading: v.loading }
}
