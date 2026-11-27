import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { AuthProvider } from '../hooks/useAuth'
import { ActiveTestProvider } from '../hooks/useActiveTest'
import Landing from './Landing'

afterEach(() => vi.restoreAllMocks())

function mockApi(me: object | null) {
  const calls: string[] = []
  vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
    const url = typeof input === 'string' ? input : (input as Request).url
    calls.push(`${init?.method ?? 'GET'} ${url}`)
    const json = (body: object, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })
    if (url === '/api/auth/config') return json({ signupEnabled: false })
    if (url === '/api/me') return me ? json(me) : new Response('', { status: 401 })
    if (url === '/api/auth/login') return json({ id: 'u1', email: 'a@b.c', guest: false })
    return new Response('', { status: 404 })
  })
  return calls
}

function renderLanding() {
  render(
    <AuthProvider>
      <ActiveTestProvider>
        <MemoryRouter initialEntries={['/']}>
          <Routes>
            <Route path="/" element={<Landing />} />
            <Route path="/app" element={<div>AppHome</div>} />
          </Routes>
        </MemoryRouter>
      </ActiveTestProvider>
    </AuthProvider>,
  )
}

describe('Landing', () => {
  it('offers Google, Seznam (not wired yet) and email, with registration inside the email option', async () => {
    mockApi(null)
    renderLanding()
    expect(await screen.findByRole('button', { name: /Pokračovat přes Google/ })).toBeDisabled()
    expect(screen.getByRole('button', { name: /Pokračovat přes Seznam/ })).toBeDisabled()
    fireEvent.click(screen.getByRole('button', { name: 'Pokračovat emailem' }))
    expect(screen.getByRole('link', { name: 'Zaregistruj se' })).toHaveAttribute('href', '/register')
  })

  it('signs in from the embedded form and opens the app', async () => {
    const calls = mockApi(null)
    renderLanding()
    fireEvent.click(await screen.findByRole('button', { name: 'Pokračovat emailem' }))
    const form = screen.getByRole('form', { name: 'Přihlášení' })
    fireEvent.change(form.querySelector('input[name="email"]')!, { target: { value: 'A@b.c' } })
    fireEvent.change(form.querySelector('input[name="password"]')!, { target: { value: 'hunter22' } })
    fireEvent.submit(form)
    await waitFor(() => expect(screen.getByText('AppHome')).toBeInTheDocument())
    expect(calls).toContain('POST /api/auth/login')
  })

  it('offers a way back into the app instead of sign-in when already signed in', async () => {
    mockApi({ id: 'u1', email: 'a@b.c', guest: false })
    renderLanding()
    expect(await screen.findAllByRole('link', { name: 'Pokračovat do trenažéru' })).not.toHaveLength(0)
    expect(screen.queryByRole('button', { name: 'Pokračovat emailem' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Vyzkoušet bez přihlášení' })).not.toBeInTheDocument()
  })

  it('tells guests what they are missing and keeps continuing as the secondary option', async () => {
    mockApi({ id: 'g1', email: null, guest: true })
    renderLanding()
    expect(await screen.findByRole('heading', { name: 'Přihlas se nebo si vytvoř účet' })).toBeInTheDocument()
    expect(screen.getByText(/Pokrok se ale neukládá/)).toBeInTheDocument()
    expect(screen.getByText(/žádná analytika, reklamy ani sledování/)).toBeInTheDocument()
    expect(screen.getAllByRole('link', { name: 'Pokračovat bez účtu' })).not.toHaveLength(0)
    expect(screen.queryByRole('link', { name: 'Pokračovat do trenažéru' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Pokračovat přes Google/ })).toBeInTheDocument()
  })

  it('shows no sign-in or guest actions until the session check answers, so a guest never sees the first-visit variant flash', async () => {
    let answerMe: ((res: Response) => void) | undefined
    vi.spyOn(globalThis, 'fetch').mockImplementation(async input => {
      const url = typeof input === 'string' ? input : (input as Request).url
      if (url === '/api/auth/config') return new Response(JSON.stringify({ signupEnabled: false }), { headers: { 'content-type': 'application/json' } })
      if (url === '/api/me') return new Promise<Response>(resolve => { answerMe = resolve })
      return new Response('', { status: 404 })
    })
    renderLanding()
    await waitFor(() => expect(answerMe).toBeDefined())
    expect(screen.queryAllByRole('button', { name: 'Vyzkoušet bez přihlášení' })).toHaveLength(0)
    expect(screen.queryAllByRole('button', { name: 'Pokračovat emailem' })).toHaveLength(0)
    expect(screen.queryAllByRole('button', { name: 'Přihlásit se' })).toHaveLength(0)

    answerMe!(new Response(JSON.stringify({ id: 'g1', email: null, guest: true }), { headers: { 'content-type': 'application/json' } }))
    expect(await screen.findByRole('heading', { name: 'Přihlas se nebo si vytvoř účet' })).toBeInTheDocument()
    expect(screen.queryAllByRole('button', { name: 'Vyzkoušet bez přihlášení' })).toHaveLength(0)
  })

  it('keeps the explanation behind a button instead of expanding it under the sample question', async () => {
    mockApi(null)
    renderLanding()
    expect(await screen.findByRole('button', { name: /Vysvětlení/ })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /^[abc]\)\s*zákaz předjíždění\.$/ }))
    expect(screen.getByText(/Správně|Špatně/)).toBeInTheDocument()
    expect(screen.queryByRole('article')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Vysvětlení/ })).toBeInTheDocument()
  })

  it('starts a guest session only after the captcha hands over a token', async () => {
    const bodies: string[] = []
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
      const url = typeof input === 'string' ? input : (input as Request).url
      const json = (body: object, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })
      if (url === '/api/auth/config') return json({ signupEnabled: true, captchaSiteKey: 'site-key' })
      if (url === '/api/me') return new Response('', { status: 401 })
      if (url === '/api/auth/guest') {
        bodies.push(String(init?.body))
        return json({ id: 'g1', email: null, guest: true }, 201)
      }
      return new Response('', { status: 404 })
    })
    // Stand-in for Cloudflare's script: the widget passes immediately and reports a token.
    let issue: ((token: string) => void) | undefined
    window.turnstile = {
      render: (_el, opts) => { issue = opts.callback as (token: string) => void; return 'w1' },
      remove: () => {},
    }
    try {
      renderLanding()
      await waitFor(() => expect(screen.getAllByRole('button', { name: 'Vyzkoušet bez přihlášení' })).not.toHaveLength(0))
      // The config fetch resolves asynchronously; wait until the site key is known before clicking.
      await new Promise(r => setTimeout(r, 0))
      fireEvent.click(screen.getAllByRole('button', { name: 'Vyzkoušet bez přihlášení' })[0])
      await waitFor(() => expect(issue).toBeDefined())
      expect(bodies).toHaveLength(0)
      issue!('tok-123')
      await waitFor(() => expect(screen.getByText('AppHome')).toBeInTheDocument())
      expect(JSON.parse(bodies[0])).toEqual({ captchaToken: 'tok-123' })
    } finally {
      delete window.turnstile
    }
  })
})
