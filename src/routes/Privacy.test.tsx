import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import Privacy from './Privacy'

describe('Privacy', () => {
  it('names the operator contact and the SSO data we receive', () => {
    render(<MemoryRouter><Privacy /></MemoryRouter>)
    expect(screen.getByRole('heading', { level: 1, name: 'Ochrana osobních údajů' })).toBeInTheDocument()
    expect(screen.getAllByRole('link', { name: 'info@vmp-trenazer.cz' })[0]).toHaveAttribute('href', 'mailto:info@vmp-trenazer.cz')
    expect(screen.getByText(/Přihlášení přes Google nebo Seznam:/)).toBeInTheDocument()
  })

  it('says account deletion is self-service in Settings, with email as a fallback', () => {
    render(<MemoryRouter><Privacy /></MemoryRouter>)
    expect(screen.getByText(/trvale smazat celý účet/)).toBeInTheDocument()
    expect(screen.getByText(/Pokud se k účtu nedostaneš/)).toBeInTheDocument()
    expect(screen.queryByText(/celého účtu provedeme na požádání/)).not.toBeInTheDocument()
  })
})
