import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import type { ComponentType } from 'react'
import type { QuestionsBundle } from '../types'
import Home from './Home'
import Weak from './Weak'
import Stats from './Stats'

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
  useAllProgress: () => { allProgressSpy(); return { bundles: {}, progressByTest: {}, loading: false, error: null } },
}))
vi.mock('../components/CategorySubtitle', () => ({ default: () => null }))

const LOCK = 'Přihlas se a uvidíš odhad úspěchu, slabiny a historii testů'

function renderRoute(Cmp: ComponentType) {
  render(<MemoryRouter><Cmp /></MemoryRouter>)
}

describe('guest locked screens', () => {
  it('Home shows the lock and keeps the test CTA, without the estimate', async () => {
    renderRoute(Home)
    expect(screen.getByText(LOCK)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Spustit ostrý test/ })).toHaveAttribute('href', '/test')
    expect(screen.queryByText('Odhad úspěchu u zkoušky')).not.toBeInTheDocument()
    expect(screen.queryByText('Po skupinách')).not.toBeInTheDocument()
  })

  it('Weak shows the lock instead of starting practice', async () => {
    renderRoute(Weak)
    expect(screen.getByText(LOCK)).toBeInTheDocument()
  })

  it('Stats shows the lock and never loads all progress', async () => {
    renderRoute(Stats)
    expect(screen.getByText(LOCK)).toBeInTheDocument()
    expect(allProgressSpy).not.toHaveBeenCalled()
  })

  it('lock offers login and, when enabled, register', async () => {
    renderRoute(Weak)
    expect(screen.getByRole('link', { name: 'Přihlásit se' })).toHaveAttribute('href', '/login')
    expect(screen.getByRole('link', { name: 'Vytvořit účet' })).toHaveAttribute('href', '/register')
  })
})
