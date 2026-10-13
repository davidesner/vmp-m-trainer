import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { AuthProvider } from '../hooks/useAuth'
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
      <MemoryRouter initialEntries={['/']}>
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/app" element={<div>AppHome</div>} />
        </Routes>
      </MemoryRouter>
    </AuthProvider>,
  )
}

describe('Landing', () => {
  it('offers Google and Seznam (not wired yet) and a registration link', async () => {
    mockApi(null)
    renderLanding()
    expect(await screen.findByRole('button', { name: /Pokračovat přes Google/ })).toBeDisabled()
    expect(screen.getByRole('button', { name: /Pokračovat přes Seznam/ })).toBeDisabled()
    expect(screen.getByRole('link', { name: 'Zaregistruj se emailem' })).toHaveAttribute('href', '/register')
  })

  it('signs in from the embedded form and opens the app', async () => {
    const calls = mockApi(null)
    renderLanding()
    fireEvent.click(await screen.findByRole('button', { name: 'Přihlásit se emailem' }))
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
    expect(screen.queryByRole('button', { name: 'Přihlásit se emailem' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Vyzkoušet bez přihlášení' })).not.toBeInTheDocument()
  })

  it('tells guests what they are missing and keeps continuing as the secondary option', async () => {
    mockApi({ id: 'g1', email: null, guest: true })
    renderLanding()
    expect(await screen.findByText(/Teď trénuješ bez účtu/)).toBeInTheDocument()
    expect(screen.getAllByRole('link', { name: 'Pokračovat bez účtu' })).not.toHaveLength(0)
    expect(screen.queryByRole('link', { name: 'Pokračovat do trenažéru' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Pokračovat přes Google/ })).toBeInTheDocument()
  })
})
