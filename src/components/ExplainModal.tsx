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
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-6" onClick={onClose}>
      <div
        className="bg-white rounded-lg shadow-2xl w-full max-w-5xl h-full max-h-[92vh] flex flex-col overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        <header className="flex justify-between items-center px-6 py-4 border-b border-neutral-200 shrink-0">
          <h3 className="text-lg font-semibold">Vysvětlení k otázce #{qid}</h3>
          <div className="flex items-center gap-2">
            {coworkUrl && result?.status === 'hit' && (
              <a
                href={coworkUrl}
                className="px-3 py-2 bg-accent text-white text-sm rounded hover:opacity-90 transition"
                title="Otevřít v Cowork pro doplňující dotazy"
              >
                💬 Probrat v Cowork ↗
              </a>
            )}
            {result?.status === 'hit' && (
              <button
                onClick={reload}
                className="px-3 py-2 border border-neutral-300 text-neutral-600 text-sm rounded hover:bg-neutral-50"
                title="Znovu načíst (po případné úpravě v Cowork)"
              >
                ↻
              </button>
            )}
            <button onClick={onClose} className="px-2 py-1 text-xl text-neutral-500 hover:text-neutral-900 leading-none">✕</button>
          </div>
        </header>

        <div className="flex-1 overflow-auto px-8 py-6">
          {loading && <div className="text-sm text-neutral-500">Načítám…</div>}

          {!loading && result?.status === 'hit' && (
            <article
              className="prose prose-neutral max-w-none prose-headings:text-neutral-900 prose-headings:font-semibold prose-h2:text-xl prose-h2:mt-6 prose-h2:mb-3 prose-h3:text-base prose-h3:mt-4 prose-h3:mb-2 prose-p:my-3 prose-p:leading-relaxed prose-a:text-accent prose-strong:text-neutral-900 prose-img:rounded prose-img:border prose-img:border-neutral-200 [&_svg]:max-w-full [&_svg]:h-auto [&_svg]:my-4 [&_svg]:rounded [&_svg]:border [&_svg]:border-neutral-200 [&_svg]:bg-white [&_table]:text-sm [&_th]:bg-neutral-100"
              dangerouslySetInnerHTML={{ __html: sanitizeExplanationHtml(result.html ?? '') }}
            />
          )}

          {!loading && result?.status === 'miss' && (
            <div className="bg-amber-50 border border-amber-200 rounded p-5">
              <p className="text-base mb-4">Vysvětlení k téhle otázce zatím nemáme.</p>
              {coworkUrl ? (
                <div className="flex flex-col gap-3 max-w-md">
                  <a href={coworkUrl} className="inline-flex items-center justify-center px-4 py-3 bg-primary text-white rounded font-medium hover:bg-primary-dark transition">
                    ▶ Vygeneruj přes Cowork
                  </a>
                  <p className="text-sm text-neutral-600">
                    Otevře se nová Cowork session. Až tě Claude poprosí o uložení a souhlasíš,
                    klikni dole na <em>Načíst výsledek</em>.
                  </p>
                  <button
                    onClick={reload}
                    className="px-4 py-2 border border-neutral-300 rounded text-neutral-700 hover:bg-neutral-100 transition"
                  >
                    ↻ Načíst výsledek
                  </button>
                </div>
              ) : (
                <p className="text-danger text-sm">Není nastavena cesta k repu — otevři Nastavení a doplň <code>VITE_PROJECT_ROOT</code>.</p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
