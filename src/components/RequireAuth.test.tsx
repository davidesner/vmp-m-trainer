import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import RequireAuth from './RequireAuth'
import { AuthProvider } from '../hooks/useAuth'

function App() {
  return (
    <AuthProvider>
      <MemoryRouter initialEntries={['/protected']}>
        <Routes>
          <Route path="/login" element={<div>LoginPage</div>} />
          <Route path="/protected" element={<RequireAuth><div>SecretPage</div></RequireAuth>} />
        </Routes>
      </MemoryRouter>
    </AuthProvider>
  )
}

describe('RequireAuth', () => {
  beforeEach(() => { vi.spyOn(globalThis, 'fetch').mockImplementation(async () => new Response('', { status: 401 })) })
  afterEach(() => { vi.restoreAllMocks() })

  it('redirects to /login when /api/me returns 401', async () => {
    render(<App />)
    await waitFor(() => expect(screen.getByText('LoginPage')).toBeInTheDocument())
    expect(screen.queryByText('SecretPage')).not.toBeInTheDocument()
  })

  it('renders children when /api/me returns a user', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async () =>
      new Response(JSON.stringify({ id: 'u1', email: 'a@b.c' }), { status: 200, headers: { 'content-type': 'application/json' } })
    )
    render(<App />)
    await waitFor(() => expect(screen.getByText('SecretPage')).toBeInTheDocument())
  })
})
