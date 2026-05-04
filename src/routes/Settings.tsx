import { useState } from 'react'
import { useProgress } from '../hooks/useProgress'

export default function Settings() {
  const { reset } = useProgress()
  const projectRoot = import.meta.env.VITE_PROJECT_ROOT ?? ''
  const [confirmReset, setConfirmReset] = useState(false)

  return (
    <div className="max-w-2xl p-8">
      <h2 className="text-2xl font-bold mb-6">Nastavení</h2>

      <div className="bg-white border border-neutral-200 rounded p-4 mb-4">
        <div className="text-xs uppercase tracking-wide text-neutral-500 mb-1">Cesta k repu (VITE_PROJECT_ROOT)</div>
        <code className="block bg-neutral-100 rounded p-2 text-sm break-all">{projectRoot || '(nenastaveno)'}</code>
        <p className="text-xs text-neutral-500 mt-2">
          Nastaveno přes <code>.env.local</code>. Po změně restartuj <code>pnpm dev</code>.
          Tato cesta jde do parametru <code>folder</code> u Cowork deep linku.
        </p>
      </div>

      <div className="bg-white border border-neutral-200 rounded p-4">
        <div className="text-sm font-semibold mb-2">Smazat veškerý progress</div>
        {!confirmReset ? (
          <button onClick={() => setConfirmReset(true)} className="px-3 py-2 border border-danger text-danger rounded text-sm hover:bg-danger hover:text-white transition">
            Reset progress
          </button>
        ) : (
          <div className="flex gap-2 items-center">
            <span className="text-sm text-danger">Opravdu? Toto smaže celou historii.</span>
            <button onClick={() => { reset(); setConfirmReset(false) }} className="px-3 py-2 bg-danger text-white rounded text-sm">Ano, smazat</button>
            <button onClick={() => setConfirmReset(false)} className="px-3 py-2 border border-neutral-300 rounded text-sm">Zpět</button>
          </div>
        )}
      </div>
    </div>
  )
}
