import { describe, it, expect, vi } from 'vitest'
import { render, act } from '@testing-library/react'
import Timer from './Timer'

describe('Timer', () => {
  it('renders mm:ss', () => {
    const { container } = render(<Timer remainingSec={150} />)
    expect(container.textContent).toContain('02:30')
  })

  it('calls onExpire when count reaches 0', async () => {
    vi.useFakeTimers()
    const onExpire = vi.fn()
    render(<Timer remainingSec={2} onExpire={onExpire} ticking />)
    act(() => { vi.advanceTimersByTime(2100) })
    expect(onExpire).toHaveBeenCalled()
    vi.useRealTimers()
  })
})
