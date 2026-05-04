import { describe, it, expect } from 'vitest'
import { buildExplainLink } from './coworkLink'

describe('buildExplainLink', () => {
  it('builds claude://cowork/new with q and folder', () => {
    const url = buildExplainLink({ qid: 12, folder: '/Users/me/repo' })
    expect(url.startsWith('claude://cowork/new?')).toBe(true)
    expect(url).toContain('folder=%2FUsers%2Fme%2Frepo')
    expect(url).toContain('q=')
  })

  it('encodes the prompt mentioning the skill and qid', () => {
    const url = buildExplainLink({ qid: 7, folder: '/x' })
    const params = new URLSearchParams(url.split('?')[1])
    const q = params.get('q') ?? ''
    expect(q).toContain('explain-vmp-question')
    expect(q).toContain('#7')
  })

  it('throws on missing folder', () => {
    expect(() => buildExplainLink({ qid: 1, folder: '' })).toThrow(/folder/)
  })
})
