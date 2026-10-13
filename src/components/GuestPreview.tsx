import type { ReactNode } from 'react'

/**
 * Wraps one stats card shown to guests as an empty-value preview: a light gray
 * layer makes it read as a sample rather than live data. Clicks pass through.
 * Spacing goes on the wrapper (`className`) so the overlay covers only the card.
 */
export default function GuestPreview({ active, className = '', children }: {
  active: boolean
  className?: string
  children: ReactNode
}) {
  return (
    <div data-guest-preview={active || undefined} className={`relative ${className}`}>
      {children}
      {active && (
        <div data-guest-overlay aria-hidden className="absolute inset-0 rounded-lg bg-neutral-200/60 pointer-events-none" />
      )}
    </div>
  )
}
