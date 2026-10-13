import { useState, type FormEvent } from 'react'
import { DELETE_CONFIRM_WORD, useAuth } from '../hooks/useAuth'

/** Danger zone in Settings: permanent, self-service deletion of the signed-in account. */
export default function DeleteAccount() {
  const { user, deleteAccount } = useAuth()
  const [open, setOpen] = useState(false)
  const [value, setValue] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  if (!user || user.guest) return null
  const hasPassword = user.hasPassword

  function cancel() {
    setOpen(false)
    setValue('')
    setError(null)
  }

  async function submit(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    // On success the user is signed out and RequireAuth takes them to the landing page.
    const res = await deleteAccount(hasPassword ? { password: value } : { confirm: value })
    if (res.ok) return
    setBusy(false)
    setError(res.error ?? 'Smazání se nepovedlo')
  }

  return (
    <section aria-labelledby="delete-account-heading" className="mt-10 border border-danger rounded p-4 bg-danger-light/40">
      <h3 id="delete-account-heading" className="text-sm font-semibold text-danger mb-2">Smazat účet</h3>
      <p className="text-sm text-neutral-700 mb-2">
        Trvale smaže tvůj účet a vše, co k němu máme uložené: e-mail, heslo, propojení s Google či Seznamem,
        celou historii odpovědí a výsledky testů. Odhlásí tě to i na všech ostatních zařízeních.
      </p>
      <p className="text-sm text-neutral-700 mb-3">
        <strong>Smazání nejde vrátit.</strong> Když se pak přihlásíš stejným účtem Google nebo Seznam,
        začneš s novým, prázdným účtem.
      </p>

      {!open ? (
        <button onClick={() => setOpen(true)}
          className="px-3 py-2 border border-danger text-danger rounded text-sm hover:bg-danger hover:text-white transition">
          Smazat účet
        </button>
      ) : (
        <form onSubmit={e => void submit(e)} className="flex flex-col gap-3">
          <label className="block">
            <span className="block text-sm mb-1">
              {hasPassword
                ? 'Pro potvrzení zadej své heslo'
                : <>Pro potvrzení napiš <strong>{DELETE_CONFIRM_WORD}</strong></>}
            </span>
            <input
              type={hasPassword ? 'password' : 'text'}
              name={hasPassword ? 'password' : 'confirm'}
              autoComplete={hasPassword ? 'current-password' : 'off'}
              autoFocus
              required
              value={value}
              onChange={e => setValue(e.target.value)}
              className="w-full sm:max-w-xs rounded px-3 py-2 text-neutral-900 bg-white border border-neutral-300"
            />
          </label>
          {error && <div role="alert" className="text-sm text-red-600">{error}</div>}
          <div className="flex flex-wrap gap-2">
            <button type="submit" disabled={busy || !value}
              className="px-3 py-2 bg-danger text-white rounded text-sm disabled:opacity-50">
              {busy ? 'Mažu…' : 'Trvale smazat účet'}
            </button>
            <button type="button" onClick={cancel} disabled={busy}
              className="px-3 py-2 border border-neutral-300 rounded text-sm">
              Zpět
            </button>
          </div>
        </form>
      )}
    </section>
  )
}
