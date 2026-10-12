import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import type { QuestionsBundle } from '../types'
import Practice from './Practice'

vi.mock('../hooks/useAuth', () => ({
  useAuth: () => ({ signupEnabled: false }),
  useGuestStatus: () => ({ isGuest: true, authLoading: false }),
}))
vi.mock('../hooks/useQuestions', () => ({
  useQuestions: () => ({
    data: { questions: [], groups: [], testStructure: [], passing: { score: 30, total: 35 } } as unknown as QuestionsBundle,
    loading: false, error: null,
  }),
}))
vi.mock('../hooks/useProgress', () => ({ useProgress: () => ({ store: { questions: {}, testHistory: [] } }) }))
vi.mock('../components/CategorySubtitle', () => ({ default: () => null }))

describe('Practice for guests', () => {
  it('defaults to random and disables weak-based modes with a hint', () => {
    render(<MemoryRouter><Practice /></MemoryRouter>)
    expect(screen.getByRole('button', { name: 'Náhodně' })).toHaveClass('border-primary')
    expect(screen.getByRole('button', { name: '⚖ Mix slabiny + známé' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Hlavně slabiny' })).toBeDisabled()
    expect(screen.getByRole('link', { name: 'Dostupné po přihlášení' })).toHaveAttribute('href', '/login')
  })
})
