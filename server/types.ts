import type { Db } from './db/client'

export interface AuthUser {
  id: string
  email: string
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
