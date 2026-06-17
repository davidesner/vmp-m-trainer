import { useEffect } from 'react'
import type { TestId } from '../lib/tests'
import { TESTS } from '../lib/tests'

interface Props {
  open: boolean
  nextTest: TestId
  answered: number
  total: number
  remainingSec: number
  onCancel: () => void
  onConfirm: () => void
}

function formatTime(sec: number): string {
  const m = Math.floor(Math.max(0, sec) / 60)
  const s = Math.max(0, sec) % 60
  return `${m}:${String(s).padStart(2, '0')}`
}

export default function SwitchCategoryConfirmModal({
  open, nextTest, answered, total, remainingSec, onCancel, onConfirm,
}: Props) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel()
      if (e.key === 'Enter') onConfirm()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onCancel, onConfirm])

  if (!open) return null

  return (
    <div role="dialog" aria-modal="true" className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4" onClick={onCancel}>
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-6" onClick={e => e.stopPropagation()}>
        <h3 className="text-lg font-semibold mb-2">Zahodit rozdělaný test?</h3>
        <p className="text-sm text-neutral-700">
          Přepnutí na kategorii <strong>{TESTS[nextTest].label} · {TESTS[nextTest].name}</strong> zahodí rozdělaný test.
        </p>
        <div className="mt-3 text-sm text-neutral-600">
          Vyplněno: <strong className="tabular-nums">{answered} / {total}</strong> otázek · zbývá <strong className="tabular-nums">{formatTime(remainingSec)}</strong>
        </div>
        <div className="mt-6 flex gap-2 justify-end">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 text-sm border border-neutral-300 rounded hover:bg-neutral-50"
          >
            Zrušit
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="px-4 py-2 text-sm bg-danger text-white rounded font-semibold hover:opacity-90"
          >
            Přepnout a zahodit
          </button>
        </div>
      </div>
    </div>
  )
}
