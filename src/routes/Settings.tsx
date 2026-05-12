import { useState } from 'react'
import { useProgress } from '../hooks/useProgress'
import { useAuth } from '../hooks/useAuth'

const LEGACY_KEY = 'vmp:progress'

export default function Settings() {
  const { reset } = useProgress()
  const { user, logout } = useAuth()
  const [confirmReset, setConfirmReset] = useState(false)
  const [importMsg, setImportMsg] = useState<string | null>(null)

  const legacy = (() => {
    try { return localStorage.getItem(LEGACY_KEY) } catch { return null }
  })()

  async function doImport() {
    if (!legacy) return
    let parsed: unknown
    try { parsed = JSON.parse(legacy) } catch { setImportMsg('Neplatný JSON v localStorage.'); return }
    setImportMsg('Importuji…')
    const res = await fetch('/api/progress/import', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify(parsed),
    })
    if (res.ok) {
      try { localStorage.removeItem(LEGACY_KEY) } catch { /* ignore */ }
      setImportMsg('Import OK. Obnov stránku.')
    } else {
      setImportMsg(`Import selhal: HTTP ${res.status}`)
    }
  }

  return (
    <div className="max-w-2xl p-8">
      <h2 className="text-2xl font-bold mb-6">Nastavení</h2>

      <div className="bg-white border border-neutral-200 rounded p-4 mb-4">
        <div className="text-sm">Přihlášen jako <strong>{user?.email}</strong></div>
        <button onClick={() => void logout()}
          className="mt-3 px-3 py-2 border border-neutral-300 rounded text-sm hover:bg-neutral-50">
          Odhlásit
        </button>
      </div>

      {legacy && (
        <div className="bg-white border border-amber-300 rounded p-4 mb-4">
          <div className="text-sm font-semibold mb-2">Najít starý progress v prohlížeči?</div>
          <p className="text-xs text-neutral-600 mb-3">
            V localStorage je uložený progress z předchozí lokální verze. Můžeš ho jednorázově importovat na server.
          </p>
          <button onClick={() => void doImport()}
            className="px-3 py-2 bg-accent text-white rounded text-sm">
            Importovat
          </button>
          {importMsg && <div className="mt-2 text-sm">{importMsg}</div>}
        </div>
      )}

      <div className="bg-white border border-neutral-200 rounded p-4">
        <div className="text-sm font-semibold mb-2">Smazat veškerý progress</div>
        {!confirmReset ? (
          <button onClick={() => setConfirmReset(true)} className="px-3 py-2 border border-danger text-danger rounded text-sm hover:bg-danger hover:text-white transition">
            Reset progress
          </button>
        ) : (
          <div className="flex gap-2 items-center">
            <span className="text-sm text-danger">Opravdu? Toto smaže celou historii.</span>
            <button onClick={() => { void reset(); setConfirmReset(false) }} className="px-3 py-2 bg-danger text-white rounded text-sm">Ano, smazat</button>
            <button onClick={() => setConfirmReset(false)} className="px-3 py-2 border border-neutral-300 rounded text-sm">Zpět</button>
          </div>
        )}
      </div>
    </div>
  )
}
