import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import type { ComponentType } from 'react'
import type { QuestionsBundle } from '../types'
import Home from './Home'
import Weak from './Weak'
import Stats from './Stats'
import { ActiveTestProvider } from '../hooks/useActiveTest'

const allProgressSpy = vi.hoisted(() => vi.fn())

vi.mock('../hooks/useAuth', () => ({
  useAuth: () => ({ signupEnabled: true }),
  useGuestStatus: () => ({ isGuest: true, authLoading: false }),
}))
const questionsStub = vi.hoisted(() => ({
  data: {
    testId: 'M', name: 'M', questions: [], groups: [], testStructure: [],
    passing: { score: 30, total: 35 },
  },
  loading: false, error: null,
}))
vi.mock('../hooks/useQuestions', () => ({
  useQuestions: () => questionsStub as unknown as { data: QuestionsBundle; loading: false; error: null },
}))
// Stable identity: a fresh store per render would re-trigger effects that depend on it.
const progressStub = vi.hoisted(() => ({ store: { questions: {}, testHistory: [] } }))
vi.mock('../hooks/useProgress', () => ({
  useProgress: () => progressStub,
}))
vi.mock('../hooks/useAllProgress', () => ({
  useAllProgress: (opts?: { includeProgress?: boolean }) => {
    allProgressSpy(opts)
    return { bundles: { M: questionsStub.data, C: questionsStub.data }, progressByTest: { M: { questions: {}, testHistory: [] }, C: { questions: {}, testHistory: [] } }, loading: false, error: null }
  },
}))
vi.mock('../components/CategorySubtitle', () => ({ default: () => null }))

const LOCK = 'Přihlas se a uvidíš odhad úspěchu, slabiny a historii testů'

function renderRoute(Cmp: ComponentType) {
  render(<ActiveTestProvider><MemoryRouter><Cmp /></MemoryRouter></ActiveTestProvider>)
}

describe('guest locked screens', () => {
  it('Home shows the regular overview with empty values plus the sign-in banner', async () => {
    renderRoute(Home)
    expect(screen.getByText(LOCK)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Spustit ostrý test/ })).toHaveAttribute('href', '/test')
    expect(screen.getByText('Odhad úspěchu u zkoušky')).toBeInTheDocument()
    expect(screen.getByText('Po skupinách')).toBeInTheDocument()
    expect(document.querySelector('[data-guest-overlay]')).not.toBeNull()
    expect(screen.getByText(LOCK).closest('[data-guest-preview]')).toBeNull()
  })

  it('Weak shows the lock instead of starting practice', async () => {
    renderRoute(Weak)
    expect(screen.getByText(LOCK)).toBeInTheDocument()
  })

  it('Stats shows the regular tabs with empty values, the banner, and skips stored progress', async () => {
    renderRoute(Stats)
    expect(screen.getByText(LOCK)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Všechny' })).toBeInTheDocument()
    expect(document.querySelector('[data-guest-overlay]')).not.toBeNull()
    expect(screen.getByText(LOCK).closest('[data-guest-preview]')).toBeNull()
    expect(allProgressSpy).toHaveBeenCalled()
    for (const [opts] of allProgressSpy.mock.calls) expect(opts).toEqual({ includeProgress: false })
  })

  it('lock offers login and, when enabled, register', async () => {
    renderRoute(Weak)
    expect(screen.getByRole('link', { name: 'Přihlásit se' })).toHaveAttribute('href', '/login')
    expect(screen.getByRole('link', { name: 'Vytvořit účet' })).toHaveAttribute('href', '/register')
  })
})
