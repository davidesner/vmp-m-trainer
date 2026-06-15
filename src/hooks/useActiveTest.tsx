import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import type { TestId } from '../lib/tests'
import { isTestId } from '../lib/tests'

const STORAGE_KEY = 'vmp.activeTestId'
const DEFAULT_TEST: TestId = 'M'

interface ActiveTestCtx {
  activeTest: TestId
  setActiveTest: (id: TestId) => void
}

const Ctx = createContext<ActiveTestCtx | null>(null)

function readInitial(): TestId {
  if (typeof window === 'undefined') return DEFAULT_TEST
  try {
    const v = window.localStorage.getItem(STORAGE_KEY)
    return isTestId(v) ? v : DEFAULT_TEST
  } catch {
    return DEFAULT_TEST
  }
}

export function ActiveTestProvider({ children }: { children: ReactNode }) {
  const [activeTest, setActiveTestState] = useState<TestId>(readInitial)

  const setActiveTest = useCallback((id: TestId) => {
    setActiveTestState(id)
    try { window.localStorage.setItem(STORAGE_KEY, id) } catch { /* ignore */ }
  }, [])

  // Sync across tabs
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY && isTestId(e.newValue)) {
        setActiveTestState(e.newValue)
      }
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])

  return <Ctx.Provider value={{ activeTest, setActiveTest }}>{children}</Ctx.Provider>
}

export function useActiveTest(): ActiveTestCtx {
  const c = useContext(Ctx)
  if (!c) throw new Error('useActiveTest must be used inside <ActiveTestProvider>')
  return c
}
