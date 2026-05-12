import { useState } from 'react'
import { useProgress } from '../hooks/useProgress'

export default function Settings() {
  const { reset } = useProgress()
  const [confirmReset, setConfirmReset] = useState(false)

  return (
    <div className="max-w-2xl p-8">
      <h2 className="text-2xl font-bold mb-6">Nastavení</h2>

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
