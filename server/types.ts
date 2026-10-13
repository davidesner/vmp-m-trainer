import type { Db } from './db/client.js'

export interface AuthUser {
  id: string
  /** null for guests; the stored placeholder never leaves the server */
  email: string | null
  guest: boolean
}

export interface AppVariables {
  user?: AuthUser
  sid?: string
}

export interface AppBindings {
  db: Db
  cookieSecure: boolean
}

export interface AppEnv {
  Variables: AppVariables
  Bindings: AppBindings  // populated per-request via c.set on first middleware
}
