import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, waitFor, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import Test from './Test'
import type { QuestionsBundle, Question, GroupId } from '../types'

// Build a bundle where every question has a deterministic "marker" text
// in option (a). If shuffle works, "marker for q1" should appear in
// random positions across many runs, not always position 0.
function makeBundle(): QuestionsBundle {
  const groups = [
    { id: 'plavebni-provoz' as GroupId,             name: 'PP', zkratky: [] },
    { id: 'nocni-denni-signalizace' as GroupId,     name: 'NS', zkratky: [] },
    { id: 'signalizace-rizeni-plavby' as GroupId,   name: 'SR', zkratky: [] },
    { id: 'zvukove-signaly' as GroupId,             name: 'ZS', zkratky: [] },
    { id: 'vytyceni-vodnich-cest' as GroupId,       name: 'VV', zkratky: [] },
    { id: 'zaklady-konstrukce-plavidel' as GroupId, name: 'KP', zkratky: [] },
    { id: 'zaklady-prvni-pomoci' as GroupId,        name: 'PP1',zkratky: [] },
  ]
  const counts: Record<GroupId, number> = {
    'plavebni-provoz': 50,
    'nocni-denni-signalizace': 30,
    'signalizace-rizeni-plavby': 20,
    'zvukove-signaly': 30,
    'vytyceni-vodnich-cest': 0,
    'zaklady-konstrukce-plavidel': 15,
    'zaklady-prvni-pomoci': 15,
  }
  const questions: Question[] = []
  let id = 1
  for (const g of groups) {
    for (let i = 0; i < counts[g.id]; i++) {
      questions.push({
        id, zkratka: 'PP1', group: g.id, text: `q${id}`, image: null,
        options: [
          { key: 'a', text: `CORRECT-q${id}` },
          { key: 'b', text: `WRONG1-q${id}` },
          { key: 'c', text: `WRONG2-q${id}` },
        ],
        correct: 'a',
      })
      id++
    }
  }
  return {
    version: 'M-2015', scrapedAt: '2026-05-04',
    groups: groups as any,
    testStructure: [
      { groups: ['plavebni-provoz'], count: 16 },
      { groups: ['nocni-denni-signalizace'], count: 7 },
      { groups: ['signalizace-rizeni-plavby', 'zvukove-signaly', 'vytyceni-vodnich-cest'], count: 5 },
      { groups: ['zaklady-konstrukce-plavidel'], count: 3 },
      { groups: ['zaklady-prvni-pomoci'], count: 4 },
    ],
    questions,
  }
}

describe('Test runner — shuffle integration', () => {
  beforeEach(() => {
    localStorage.clear()
    const bundle = makeBundle()
    vi.stubGlobal('fetch', vi.fn(async (url: string) => {
      if (url.includes('questions.json')) {
        return new Response(JSON.stringify(bundle), { status: 200 })
      }
      return new Response('', { status: 404 })
    }))
  })

  it('does not always show the correct answer in position (a)', async () => {
    // Render Test 30 times. Each render has its own useMemo → fresh shuffle.
    // For each render, check whether the FIRST visible option text contains
    // "CORRECT-". If shuffle works, this should be roughly 1/3 of the time.
    let correctInPosA = 0
    const TRIES = 30

    for (let i = 0; i < TRIES; i++) {
      const { unmount } = render(
        <MemoryRouter initialEntries={['/test']}>
          <Test />
        </MemoryRouter>
      )
      // Wait for question to render
      await waitFor(() => {
        expect(screen.getByText(/Otázka/)).toBeInTheDocument()
      })
      // Find buttons of the QuestionCard — they have role="button" with text containing "a) ..."
      const buttons = document.querySelectorAll('button')
      const optionButtons = Array.from(buttons).filter(b => /^[abc]\)/.test(b.textContent?.trim() ?? ''))
      // First option button text
      const firstOpt = optionButtons[0]?.textContent ?? ''
      if (firstOpt.includes('CORRECT-')) correctInPosA++
      unmount()
    }

    // Sanity: not all in position a, not zero
    expect(correctInPosA).toBeLessThan(TRIES)         // shuffle did SOMETHING
    expect(correctInPosA).toBeGreaterThan(0)          // not always elsewhere either
    // Stat check — within 3 SDs of expected 1/3
    const expected = TRIES / 3
    const sd = Math.sqrt(TRIES * (1/3) * (2/3))
    expect(Math.abs(correctInPosA - expected)).toBeLessThan(3 * sd + 2)
  })
})
