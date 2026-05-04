import { useEffect, useState } from 'react'
import { useExplanations, type ExplanationFetchResult } from '../hooks/useExplanations'
import { sanitizeExplanationHtml } from '../lib/sanitize'
import { buildExplainLink } from '../lib/coworkLink'

interface Props {
  qid: number
  open: boolean
  onClose: () => void
  projectRoot: string
}

export default function ExplainModal({ qid, open, onClose, projectRoot }: Props) {
  const { fetchExplanation } = useExplanations()
  const [result, setResult] = useState<ExplanationFetchResult | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!open) return
    setLoading(true)
    fetchExplanation(qid).then(r => { setResult(r); setLoading(false) })
  }, [open, qid, fetchExplanation])

  if (!open) return null

  const reload = async () => {
    setLoading(true)
    const r = await fetchExplanation(qid, true)
    setResult(r); setLoading(false)
  }

  const coworkUrl = projectRoot ? buildExplainLink({ qid, folder: projectRoot }) : null

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[80vh] overflow-auto p-6" onClick={e => e.stopPropagation()}>
        <div className="flex justify-between items-start mb-4">
          <h3 className="text-lg font-semibold">Vysvětlení k otázce #{qid}</h3>
          <button onClick={onClose} className="text-neutral-500 hover:text-neutral-900">✕</button>
        </div>

        {loading && <div className="text-sm text-neutral-500">Načítám...</div>}

        {!loading && result?.status === 'hit' && (
          <>
            <div className="prose prose-sm max-w-none" dangerouslySetInnerHTML={{ __html: sanitizeExplanationHtml(result.html ?? '') }} />
            {result.meta?.session_url && (
              <a href={result.meta.session_url} className="inline-block mt-4 px-3 py-2 bg-accent text-white text-sm rounded">
                Pokračovat v Cowork ↗
              </a>
            )}
          </>
        )}

        {!loading && result?.status === 'miss' && (
          <div className="bg-amber-50 border border-amber-200 rounded p-4 text-sm">
            <p className="mb-3">Vysvětlení zatím nemáme.</p>
            {coworkUrl ? (
              <>
                <a href={coworkUrl} className="inline-block px-4 py-2 bg-primary text-white rounded font-medium">
                  ▶ Vygeneruj přes Cowork
                </a>
                <p className="mt-3 text-neutral-600">Po dokončení v Cowork klikni níže.</p>
                <button onClick={reload} className="mt-2 px-3 py-2 border border-neutral-300 rounded text-neutral-700 hover:bg-neutral-100 w-full">
                  ↻ Načíst výsledek
                </button>
              </>
            ) : (
              <p className="text-danger">Není nastavena cesta k repu — otevři Nastavení.</p>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
