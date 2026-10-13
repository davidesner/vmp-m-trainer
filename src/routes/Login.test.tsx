import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { AuthProvider } from '../hooks/useAuth'
import Login from './Login'

afterEach(() => vi.restoreAllMocks())

describe('Login guest entry', () => {
  it('"Pokračovat bez přihlášení" creates a guest session and navigates home', async () => {
    const calls: string[] = []
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
      const url = typeof input === 'string' ? input : (input as Request).url
      calls.push(`${init?.method ?? 'GET'} ${url}`)
      if (url === '/api/auth/guest') {
        return new Response(JSON.stringify({ id: 'g1', email: null, guest: true }), { status: 201, headers: { 'content-type': 'application/json' } })
      }
      if (url === '/api/auth/config') return new Response(JSON.stringify({ signupEnabled: false }), { status: 200 })
      return new Response('', { status: 401 })
    })
    render(
      <AuthProvider>
        <MemoryRouter initialEntries={['/login']}>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/app" element={<div>HomePage</div>} />
          </Routes>
        </MemoryRouter>
      </AuthProvider>,
    )
    fireEvent.click(await screen.findByRole('button', { name: 'Pokračovat bez přihlášení' }))
    await waitFor(() => expect(screen.getByText('HomePage')).toBeInTheDocument())
    expect(calls).toContain('POST /api/auth/guest')
  })
})

function renderLogin(config: object, entry = '/login') {
  vi.spyOn(globalThis, 'fetch').mockImplementation(async input => {
    const url = typeof input === 'string' ? input : (input as Request).url
    if (url === '/api/auth/config') return new Response(JSON.stringify(config), { status: 200 })
    return new Response('', { status: 401 })
  })
  render(
    <AuthProvider>
      <MemoryRouter initialEntries={[entry]}>
        <Routes>
          <Route path="/login" element={<Login />} />
        </Routes>
      </MemoryRouter>
    </AuthProvider>,
  )
}

describe('Login SSO', () => {
  it('links configured providers to their OAuth start endpoints', async () => {
    renderLogin({ signupEnabled: false, sso: { google: true, seznam: true } })
    expect(await screen.findByRole('link', { name: /Pokračovat přes Google/ })).toHaveAttribute('href', '/api/auth/oauth/google')
    expect(screen.getByRole('link', { name: /Pokračovat přes Seznam/ })).toHaveAttribute('href', '/api/auth/oauth/seznam')
    expect(screen.queryByText(/připravujeme/)).not.toBeInTheDocument()
  })

  it('keeps an unconfigured provider disabled and names only that one as coming soon', async () => {
    renderLogin({ signupEnabled: false, sso: { google: true, seznam: false } })
    expect(await screen.findByRole('link', { name: /Pokračovat přes Google/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Pokračovat přes Seznam/ })).toBeDisabled()
    expect(screen.getByText('Přihlášení přes Seznam připravujeme.')).toBeInTheDocument()
  })

  it('shows a Czech message for a failed SSO callback', async () => {
    renderLogin({ signupEnabled: false, sso: { google: true, seznam: true } }, '/login?error=cancelled')
    expect(await screen.findByRole('alert')).toHaveTextContent('Přihlášení bylo zrušeno.')
  })

  it('falls back to a generic message for an unknown error code', async () => {
    renderLogin({ signupEnabled: false }, '/login?error=whatever')
    expect(await screen.findByRole('alert')).toHaveTextContent('Účet se nepodařilo ověřit.')
  })
})
