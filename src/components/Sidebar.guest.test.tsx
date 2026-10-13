import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { ActiveTestProvider } from '../hooks/useActiveTest'
import Sidebar from './Sidebar'

const guestState = vi.hoisted(() => ({ isGuest: false, authLoading: false }))
vi.mock('../hooks/useAuth', () => ({ useGuestStatus: () => guestState }))

function renderSidebar() {
  render(<ActiveTestProvider><MemoryRouter><Sidebar /></MemoryRouter></ActiveTestProvider>)
}

describe('Sidebar mobile drawer footer', () => {
  it.each([false, true])('keeps the category hint pinned to the bottom (guest=%s)', isGuest => {
    guestState.isGuest = isGuest
    renderSidebar()
    const hint = screen.getByText('Kategorii přepneš nahoře v aplikaci.')
    expect(hint.closest('.mt-auto')).not.toBeNull()
  })

  it('shows the guest status only for guests', () => {
    guestState.isGuest = true
    renderSidebar()
    expect(screen.getAllByText(/Nepřihlášen/).length).toBeGreaterThan(0)
  })
})
