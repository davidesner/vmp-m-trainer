import { describe, it, expect, vi, afterEach } from 'vitest'
import { turnstile } from './captcha.js'

function mockSiteverify(response: Response | Error) {
  const fetchMock = vi.fn(async () => {
    if (response instanceof Error) throw response
    return response
  })
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

describe('turnstile', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('posts the secret, token and client IP to siteverify', async () => {
    const fetchMock = mockSiteverify(Response.json({ success: true }))
    expect(await turnstile('site', 'secret').verify('tok', '1.2.3.4')).toBe('ok')
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toBe('https://challenges.cloudflare.com/turnstile/v0/siteverify')
    expect(JSON.parse(init.body as string)).toEqual({ secret: 'secret', response: 'tok', remoteip: '1.2.3.4' })
  })

  it('reports failed when Cloudflare rejects the token', async () => {
    mockSiteverify(Response.json({ success: false, 'error-codes': ['invalid-input-response'] }))
    expect(await turnstile('site', 'secret').verify('tok')).toBe('failed')
  })

  it('reports unavailable on a network error or a non-2xx response', async () => {
    mockSiteverify(new Error('ECONNRESET'))
    expect(await turnstile('site', 'secret').verify('tok')).toBe('unavailable')
    mockSiteverify(new Response('oops', { status: 500 }))
    expect(await turnstile('site', 'secret').verify('tok')).toBe('unavailable')
  })
})
