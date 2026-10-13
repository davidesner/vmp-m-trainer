import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent, act } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { AuthProvider } from '../hooks/useAuth'
import Register from './Register'

type RenderOpts = { callback: (token: string) => void }

let widgets: RenderOpts[]

beforeEach(() => {
  widgets = []
  window.turnstile = {
    render: (_el, opts) => { widgets.push(opts as unknown as RenderOpts); return `w${widgets.length}` },
    remove: vi.fn(),
  }
})
afterEach(() => {
  vi.restoreAllMocks()
  delete window.turnstile
})

function mockApi(config: object, registerStatus: number, registerBody: object = {}) {
  const bodies: unknown[] = []
  vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
    const url = typeof input === 'string' ? input : (input as Request).url
    if (url === '/api/auth/config') return Response.json(config)
    if (url === '/api/auth/register') {
      bodies.push(JSON.parse(init!.body as string))
      return Response.json(registerBody, { status: registerStatus })
    }
    return new Response('', { status: 401 })
  })
  return bodies
}

function renderRegister() {
  render(
    <AuthProvider>
      <MemoryRouter initialEntries={['/register']}>
        <Routes>
          <Route path="/register" element={<Register />} />
          <Route path="/app" element={<div>HomePage</div>} />
        </Routes>
      </MemoryRouter>
    </AuthProvider>,
  )
  fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'New@B.c' } })
  fireEvent.change(screen.getByLabelText(/Heslo/), { target: { value: 'password1' } })
}

describe('Register', () => {
  it('sends the captcha token with email and password and navigates home', async () => {
    const bodies = mockApi({ signupEnabled: true, captchaSiteKey: 'site-key' }, 201, { id: 'u2', email: 'new@b.c', guest: false })
    renderRegister()
    const submit = screen.getByRole('button', { name: 'Vytvořit účet' })
    await waitFor(() => expect(widgets).toHaveLength(1))
    expect(submit).toBeDisabled()
    act(() => widgets[0].callback('tok-1'))
    fireEvent.click(submit)
    await waitFor(() => expect(screen.getByText('HomePage')).toBeInTheDocument())
    expect(bodies).toEqual([{ email: 'new@b.c', password: 'password1', captchaToken: 'tok-1' }])
  })

  it('shows the captcha error and renders a fresh widget after a failed attempt', async () => {
    mockApi({ signupEnabled: true, captchaSiteKey: 'site-key' }, 403, { error: 'captcha failed' })
    renderRegister()
    await waitFor(() => expect(widgets).toHaveLength(1))
    act(() => widgets[0].callback('tok-1'))
    fireEvent.click(screen.getByRole('button', { name: 'Vytvořit účet' }))
    expect(await screen.findByText(/neprošlo/)).toBeInTheDocument()
    await waitFor(() => expect(widgets).toHaveLength(2))
    expect(window.turnstile!.remove).toHaveBeenCalledWith('w1')
    expect(screen.getByRole('button', { name: 'Vytvořit účet' })).toBeDisabled()
  })

  it('says registration is unavailable when the server has no captcha configured', async () => {
    mockApi({ signupEnabled: false, captchaSiteKey: null }, 403)
    renderRegister()
    expect(await screen.findByText('Registrace teď není dostupná.')).toBeInTheDocument()
    expect(widgets).toHaveLength(0)
    expect(screen.getByRole('button', { name: 'Vytvořit účet' })).toBeDisabled()
  })
})
