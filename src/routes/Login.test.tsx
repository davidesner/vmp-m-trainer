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
