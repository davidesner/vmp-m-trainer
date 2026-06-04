import { describe, it, expect } from 'vitest'
import { buildFollowupLink } from './claudeDesktopLink'
import type { Question } from '../types'

const question: Question = {
  id: 42,
  zkratka: 'PP1',
  group: 'plavebni-provoz',
  text: 'Jaká je nejvyšší povolená rychlost?',
  image: null,
  options: [
    { key: 'a', text: 'První možnost' },
    { key: 'b', text: 'Druhá možnost' },
    { key: 'c', text: 'Třetí možnost' },
  ],
  correct: 'b',
}

describe('buildFollowupLink', () => {
  it('produces a claude.ai/new URL that prefills the prompt', () => {
    const url = buildFollowupLink({ question })
    expect(url.startsWith('https://claude.ai/new?')).toBe(true)
    const params = new URLSearchParams(url.split('?')[1])
    expect(params.get('q')).toBeTruthy()
  })

  it('embeds the question text, all options, and the correct answer', () => {
    const url = buildFollowupLink({ question })
    const q = new URLSearchParams(url.split('?')[1]).get('q') ?? ''
    expect(q).toContain('Otázka #42')
    expect(q).toContain('Jaká je nejvyšší povolená rychlost?')
    expect(q).toContain('a) První možnost')
    expect(q).toContain('b) Druhá možnost')
    expect(q).toContain('c) Třetí možnost')
    expect(q).toContain('Správná odpověď: b) Druhá možnost')
  })

  it('calls out the user’s wrong answer when provided', () => {
    const url = buildFollowupLink({ question, userAnswer: 'a' })
    const q = new URLSearchParams(url.split('?')[1]).get('q') ?? ''
    expect(q).toContain('odpověděl špatně: a) První možnost')
  })

  it('does not mention a wrong answer when the user answered correctly', () => {
    const url = buildFollowupLink({ question, userAnswer: 'b' })
    const q = new URLSearchParams(url.split('?')[1]).get('q') ?? ''
    expect(q).not.toContain('odpověděl špatně')
  })
})
