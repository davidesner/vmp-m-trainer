import { describe, it, expect } from 'vitest'
import { buildFollowupLink } from './claudeDesktopLink'

describe('buildFollowupLink', () => {
  it('produces a claude:// URL with the qid embedded in the prompt', () => {
    const url = buildFollowupLink({ qid: 42 })
    expect(url.startsWith('claude://new?')).toBe(true)
    const params = new URLSearchParams(url.split('?')[1])
    expect(params.get('q')).toContain('otázce #42')
  })
})
