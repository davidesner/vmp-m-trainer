import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { AuthProvider } from '../hooks/useAuth'
import { ActiveTestProvider } from '../hooks/useActiveTest'
import RequireAuth from '../components/RequireAuth'
import Settings from './Settings'

afterEach(() => vi.restoreAllMocks())

interface DeleteReply { status: number; body?: object }

/** Signed-in user + a DELETE /api/me that answers with the queued replies in order. */
function renderSettings(me: object, replies: DeleteReply[]) {
  const deletes: unknown[] = []
  vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
    const url = typeof input === 'string' ? input : (input as Request).url
    const method = init?.method ?? 'GET'
    if (url === '/api/me' && method === 'DELETE') {
      deletes.push(JSON.parse(String(init?.body)))
      const reply = replies.shift()!
      return reply.body
        ? new Response(JSON.stringify(reply.body), { status: reply.status, headers: { 'content-type': 'application/json' } })
        : new Response(null, { status: reply.status })
    }
    if (url === '/api/me') return new Response(JSON.stringify(me), { status: 200 })
    if (url === '/api/auth/config') return new Response(JSON.stringify({ signupEnabled: false }), { status: 200 })
    if (url.startsWith('/api/progress')) return new Response(JSON.stringify({}), { status: 200 })
    return new Response('', { status: 404 })
  })
  render(
    <AuthProvider>
      <ActiveTestProvider>
      <MemoryRouter initialEntries={['/app/settings']}>
        <Routes>
          <Route path="/" element={<div>LandingPage</div>} />
          <Route path="/login" element={<div>LoginPage</div>} />
          <Route path="/app/settings" element={<RequireAuth><Settings /></RequireAuth>} />
        </Routes>
      </MemoryRouter>
      </ActiveTestProvider>
    </AuthProvider>,
  )
  return { deletes }
}

describe('Settings: delete account', () => {
  it('password account: wrong password shows an error, the right one deletes and lands on /', async () => {
    const { deletes } = renderSettings(
      { id: 'u1', email: 'a@b.c', guest: false, hasPassword: true },
      [{ status: 403, body: { error: 'invalid password' } }, { status: 204 }],
    )
    expect(await screen.findByRole('heading', { name: 'Smazat účet' })).toBeInTheDocument()
    expect(screen.getByText(/nejde vrátit/)).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Smazat účet' }))
    const input = screen.getByLabelText('Pro potvrzení zadej své heslo')
    expect(input).toHaveAttribute('type', 'password')
    expect(screen.getByRole('button', { name: 'Trvale smazat účet' })).toBeDisabled()

    fireEvent.change(input, { target: { value: 'wrong' } })
    fireEvent.click(screen.getByRole('button', { name: 'Trvale smazat účet' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Špatné heslo')
    expect(screen.queryByText('LandingPage')).not.toBeInTheDocument()

    fireEvent.change(input, { target: { value: 'hunter22' } })
    fireEvent.click(screen.getByRole('button', { name: 'Trvale smazat účet' }))
    await waitFor(() => expect(screen.getByText('LandingPage')).toBeInTheDocument())
    expect(screen.queryByText('LoginPage')).not.toBeInTheDocument()
    expect(deletes).toEqual([{ password: 'wrong' }, { password: 'hunter22' }])
  })

  it('SSO-only account confirms by typing SMAZAT', async () => {
    const { deletes } = renderSettings(
      { id: 'u2', email: 'x@gmail.com', guest: false, hasPassword: false },
      [{ status: 403, body: { error: 'invalid confirmation' } }, { status: 204 }],
    )
    fireEvent.click(await screen.findByRole('button', { name: 'Smazat účet' }))
    const input = screen.getByLabelText(/Pro potvrzení napiš/)
    expect(input).toHaveAttribute('type', 'text')

    fireEvent.change(input, { target: { value: 'ano' } })
    fireEvent.click(screen.getByRole('button', { name: 'Trvale smazat účet' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Pro potvrzení napiš SMAZAT')

    fireEvent.change(input, { target: { value: 'SMAZAT' } })
    fireEvent.click(screen.getByRole('button', { name: 'Trvale smazat účet' }))
    await waitFor(() => expect(screen.getByText('LandingPage')).toBeInTheDocument())
    expect(deletes).toEqual([{ confirm: 'ano' }, { confirm: 'SMAZAT' }])
  })

  it('shows a Czech message when rate-limited and Zpět closes the form', async () => {
    renderSettings({ id: 'u1', email: 'a@b.c', guest: false, hasPassword: true }, [{ status: 429, body: { error: 'too many attempts' } }])
    fireEvent.click(await screen.findByRole('button', { name: 'Smazat účet' }))
    fireEvent.change(screen.getByLabelText('Pro potvrzení zadej své heslo'), { target: { value: 'x' } })
    fireEvent.click(screen.getByRole('button', { name: 'Trvale smazat účet' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Příliš mnoho pokusů, zkus to za chvíli')

    fireEvent.click(screen.getByRole('button', { name: 'Zpět' }))
    expect(screen.queryByLabelText('Pro potvrzení zadej své heslo')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Smazat účet' })).toBeInTheDocument()
  })

  it('guests do not get the danger section', async () => {
    renderSettings({ id: 'g1', email: null, guest: true, hasPassword: false }, [])
    expect(await screen.findByText(/Nejsi přihlášen/)).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Smazat účet' })).not.toBeInTheDocument()
  })
})
