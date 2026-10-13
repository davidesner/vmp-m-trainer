import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import type { QuestionsBundle } from '../types'
import Practice from './Practice'

vi.mock('../hooks/useAuth', () => ({
  useAuth: () => ({ signupEnabled: false }),
  useGuestStatus: () => ({ isGuest: false, authLoading: false }),
}))
vi.mock('../hooks/useQuestions', () => ({
  useQuestions: () => ({
    data: {
      questions: [
        { id: 1, zkratka: 'PP1', group: 'plavebni-provoz', text: 'q', image: null, options: [], correct: 'a' },
      ],
      groups: [
        { id: 'plavebni-provoz', name: 'Plavební provoz', zkratky: ['PP1'] },
      ],
      testStructure: [{ groups: ['plavebni-provoz'], count: 1 }],
      passing: { score: 1, total: 1 },
    } as unknown as QuestionsBundle,
    loading: false, error: null,
  }),
}))
vi.mock('../hooks/useProgress', () => ({ useProgress: () => ({ store: { questions: {}, testHistory: [] } }) }))
vi.mock('../components/CategorySubtitle', () => ({ default: () => null }))

const structureBtn = () => screen.getByRole('button', { name: /Struktura ostrého testu/ })
const groupsBtn = () => screen.getByRole('button', { name: /Vybrat oblasti/ })

describe('Practice mode picker', () => {
  it('marks only the selected mode as filled', () => {
    render(<MemoryRouter><Practice /></MemoryRouter>)
    expect(structureBtn()).toHaveAttribute('aria-pressed', 'true')
    expect(structureBtn()).toHaveTextContent('●')
    expect(groupsBtn()).toHaveTextContent('○')

    fireEvent.click(groupsBtn())
    expect(groupsBtn()).toHaveAttribute('aria-pressed', 'true')
    expect(groupsBtn()).toHaveTextContent('●')
    expect(structureBtn()).toHaveTextContent('○')
  })
})
