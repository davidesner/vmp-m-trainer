import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'

interface AuthUser { id: string; email: string }

interface AuthResult { ok: boolean; error?: string }

interface AuthCtx {
  user: AuthUser | null
  loading: boolean
  signupEnabled: boolean
  login: (email: string, password: string) => Promise<AuthResult>
  register: (email: string, password: string, code: string) => Promise<AuthResult>
  logout: () => Promise<void>
  refresh: () => Promise<void>
}

const Ctx = createContext<AuthCtx | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [loading, setLoading] = useState(true)
  const [signupEnabled, setSignupEnabled] = useState(false)

  useEffect(() => {
    void fetch('/api/auth/config', { credentials: 'same-origin' })
      .then(res => (res.ok ? res.json() : null))
      .then(cfg => setSignupEnabled(Boolean(cfg?.signupEnabled)))
      .catch(() => setSignupEnabled(false))
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

  const register = useCallback(async (email: string, password: string, code: string) => {
    const res = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify({ email, password, code }),
    })
    if (res.ok) {
      setUser(await res.json())
      return { ok: true }
    }
    const errByStatus: Record<number, string> = {
      403: 'Neplatný registrační kód',
      409: 'Tento email už je registrovaný',
      400: 'Zkontroluj email a heslo (min. 8 znaků)',
      429: 'Příliš mnoho pokusů, zkus to za chvíli',
    }
    return { ok: false, error: errByStatus[res.status] ?? `HTTP ${res.status}` }
  }, [])

  const logout = useCallback(async () => {
    await fetch('/api/auth/logout', { method: 'POST', credentials: 'same-origin' })
    setUser(null)
  }, [])

  return (
    <Ctx.Provider value={{ user, loading, signupEnabled, login, register, logout, refresh }}>
      {children}
    </Ctx.Provider>
  )
}

export function useAuth(): AuthCtx {
  const v = useContext(Ctx)
  if (!v) throw new Error('useAuth must be inside <AuthProvider>')
  return v
}
