import { useEffect, useRef, useState } from 'react'
import { useExplanations, type ExplanationFetchResult } from '../hooks/useExplanations'
import { sanitizeExplanationHtml } from '../lib/sanitize'
import { buildFollowupLink } from '../lib/claudeDesktopLink'
import FeedbackForm from './FeedbackForm'

interface Props {
  qid: number
  open: boolean
  onClose: () => void
}

export default function ExplainModal({ qid, open, onClose }: Props) {
  const { fetchExplanation } = useExplanations()
  const [result, setResult] = useState<ExplanationFetchResult | null>(null)
  const [loading, setLoading] = useState(false)
  const onCloseRef = useRef(onClose)

  useEffect(() => { onCloseRef.current = onClose }, [onClose])

  useEffect(() => {
    if (!open) return
    setLoading(true)
    fetchExplanation(qid).then(r => { setResult(r); setLoading(false) })
  }, [open, qid, fetchExplanation])

  // Intercept the mobile back-swipe so it closes the modal instead of leaving the test.
  useEffect(() => {
    if (!open) return
    window.history.pushState({ explainModal: true }, '')
    let poppedByBrowser = false
    const handlePopState = () => {
      poppedByBrowser = true
      onCloseRef.current()
    }
    window.addEventListener('popstate', handlePopState)
    return () => {
      window.removeEventListener('popstate', handlePopState)
      if (!poppedByBrowser) window.history.back()
    }
  }, [open])

  if (!open) return null

  const followupUrl = buildFollowupLink({ qid })

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 sm:p-6" onClick={onClose}>
      <div
        className="bg-white sm:rounded-lg shadow-2xl w-full max-w-5xl h-full sm:max-h-[92vh] flex flex-col overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        <header className="flex justify-between items-center gap-2 px-4 sm:px-6 py-3 sm:py-4 border-b border-neutral-200 shrink-0">
          <h3 className="text-base sm:text-lg font-semibold truncate">Vysvětlení k otázce #{qid}</h3>
          <div className="flex items-center gap-2 shrink-0">
            {result?.status === 'hit' && (
              <a
                href={followupUrl}
                className="px-3 py-2 bg-accent text-white text-xs sm:text-sm rounded hover:opacity-90 transition whitespace-nowrap"
                title="Doplňující dotaz v Claude Desktop"
              >
                <span className="sm:hidden">💬 Claude ↗</span>
                <span className="hidden sm:inline">💬 Zeptat se Claude ↗</span>
              </a>
            )}
            <button onClick={onClose} aria-label="Zavřít" className="w-10 h-10 flex items-center justify-center text-xl text-neutral-500 hover:text-neutral-900 leading-none">✕</button>
          </div>
        </header>

        <div className="flex-1 overflow-auto px-4 sm:px-8 py-4 sm:py-6">
          {loading && <div className="text-sm text-neutral-500">Načítám…</div>}

          {!loading && result?.status === 'hit' && (
            <>
              <article
                className="prose prose-neutral max-w-none prose-headings:text-neutral-900 prose-headings:font-semibold prose-h2:text-xl prose-h2:mt-6 prose-h2:mb-3 prose-h3:text-base prose-h3:mt-4 prose-h3:mb-2 prose-p:my-3 prose-p:leading-relaxed prose-a:text-accent prose-strong:text-neutral-900 prose-img:rounded prose-img:border prose-img:border-neutral-200 [&_svg]:max-w-full [&_svg]:h-auto [&_svg]:my-4 [&_svg]:rounded [&_svg]:border [&_svg]:border-neutral-200 [&_svg]:bg-white [&_table]:text-sm [&_th]:bg-neutral-100"
                dangerouslySetInnerHTML={{ __html: sanitizeExplanationHtml(result.html ?? '') }}
              />
              <FeedbackForm qid={qid} />
            </>
          )}

          {!loading && result?.status === 'miss' && (
            <div className="bg-amber-50 border border-amber-200 rounded p-5">
              <p className="text-base">Vysvětlení k téhle otázce zatím nemáme. Můžeš se zeptat Claude přímo:</p>
              <a href={followupUrl} className="inline-flex mt-3 items-center justify-center px-4 py-3 bg-primary text-white rounded font-medium hover:bg-primary-dark transition">
                ▶ Otevřít Claude
              </a>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
