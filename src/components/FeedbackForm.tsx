import { useState } from 'react'
import { useActiveTest } from '../hooks/useActiveTest'

interface Props {
  qid: number
}

type Status = 'idle' | 'sending' | 'sent' | 'error'

export default function FeedbackForm({ qid }: Props) {
  const { activeTest } = useActiveTest()
  const [open, setOpen] = useState(false)
  const [message, setMessage] = useState('')
  const [status, setStatus] = useState<Status>('idle')
  const [error, setError] = useState<string | null>(null)

  const submit = async () => {
    const trimmed = message.trim()
    if (trimmed.length === 0) return
    setStatus('sending')
    setError(null)
    try {
      const res = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ testId: activeTest, qid, message: trimmed }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => null) as { error?: string } | null
        setError(data?.error ?? `HTTP ${res.status}`)
        setStatus('error')
        return
      }
      setStatus('sent')
      setMessage('')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'network error')
      setStatus('error')
    }
  }

  if (status === 'sent') {
    return (
      <div className="mt-8 pt-4 border-t border-neutral-200 text-sm text-green-700">
        ✓ Děkujeme za zpětnou vazbu. Nahlášení bylo odesláno.
        <button
          type="button"
          onClick={() => { setStatus('idle'); setOpen(false) }}
          className="ml-3 text-neutral-500 hover:text-neutral-900 underline"
        >
          Zavřít
        </button>
      </div>
    )
  }

  if (!open) {
    return (
      <div className="mt-8 pt-4 border-t border-neutral-200">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="text-xs text-neutral-500 hover:text-neutral-900 underline"
        >
          Nahlásit chybu ve vysvětlení
        </button>
      </div>
    )
  }

  return (
    <div className="mt-8 pt-4 border-t border-neutral-200">
      <label className="block text-sm font-medium text-neutral-700 mb-2">
        Co je s vysvětlením špatně?
      </label>
      <textarea
        value={message}
        onChange={e => setMessage(e.target.value)}
        rows={4}
        maxLength={4000}
        placeholder="Popiš co je nepřesné nebo chybné…"
        className="w-full border border-neutral-300 rounded p-2 text-sm focus:outline-none focus:border-accent"
        disabled={status === 'sending'}
      />
      {error && (
        <div className="mt-2 text-sm text-red-700">Odeslání selhalo: {error}</div>
      )}
      <div className="mt-3 flex gap-2">
        <button
          type="button"
          onClick={submit}
          disabled={status === 'sending' || message.trim().length === 0}
          className="px-3 py-2 bg-primary text-white text-sm rounded font-medium disabled:opacity-40"
        >
          {status === 'sending' ? 'Odesílám…' : 'Odeslat'}
        </button>
        <button
          type="button"
          onClick={() => { setOpen(false); setError(null); setStatus('idle') }}
          disabled={status === 'sending'}
          className="px-3 py-2 text-sm text-neutral-600 hover:text-neutral-900"
        >
          Zrušit
        </button>
      </div>
    </div>
  )
}
