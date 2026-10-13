import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import Privacy from './Privacy'

describe('Privacy', () => {
  it('names the operator contact and the SSO data we receive', () => {
    render(<MemoryRouter><Privacy /></MemoryRouter>)
    expect(screen.getByRole('heading', { level: 1, name: 'Ochrana osobních údajů' })).toBeInTheDocument()
    expect(screen.getAllByRole('link', { name: 'esnerda@gmail.com' })[0]).toHaveAttribute('href', 'mailto:esnerda@gmail.com')
    expect(screen.getByText(/Přihlášení přes Google nebo Seznam:/)).toBeInTheDocument()
  })
})
