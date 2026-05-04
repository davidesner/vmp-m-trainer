import { useQuestions } from '../hooks/useQuestions'
import { useProgress } from '../hooks/useProgress'
import type { GroupId } from '../types'

export default function Stats() {
  const { data, loading } = useQuestions()
  const { store } = useProgress()

  if (loading || !data) return <div className="p-8">Načítám…</div>

  const perGroup: Record<GroupId, { count: number; attempts: number; correct: number; lastSeen: string | null }> = {} as any
  for (const g of data.groups) {
    perGroup[g.id] = { count: 0, attempts: 0, correct: 0, lastSeen: null }
  }
  for (const q of data.questions) perGroup[q.group].count++
  for (const [qid, p] of Object.entries(store.questions)) {
    const q = data.questions.find(qq => qq.id === Number(qid))
    if (!q) continue
    perGroup[q.group].attempts += p.attempts.length
    perGroup[q.group].correct += p.attempts.filter(a => a.correct).length
    if (!perGroup[q.group].lastSeen || p.lastSeen > (perGroup[q.group].lastSeen ?? '')) {
      perGroup[q.group].lastSeen = p.lastSeen
    }
  }

  const history = store.testHistory.slice(0, 10).reverse()

  return (
    <div className="max-w-4xl mx-auto p-8">
      <h2 className="text-2xl font-bold mb-6">Statistiky</h2>

      <div className="bg-white border border-neutral-200 rounded p-4 mb-6 overflow-x-auto">
        <div className="text-xs uppercase tracking-wide text-neutral-500 mb-2">Po skupinách</div>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-neutral-500">
              <th className="py-2">Skupina</th>
              <th className="py-2">Otázek</th>
              <th className="py-2">Pokusů</th>
              <th className="py-2">Úspěšnost</th>
              <th className="py-2">Naposledy</th>
            </tr>
          </thead>
          <tbody>
            {data.groups.map(g => {
              const s = perGroup[g.id]
              const pct = s.attempts > 0 ? Math.round((s.correct / s.attempts) * 100) : null
              return (
                <tr key={g.id} className="border-t border-neutral-100">
                  <td className="py-2">{g.name}</td>
                  <td className="py-2">{s.count}</td>
                  <td className="py-2">{s.attempts}</td>
                  <td className="py-2 tabular-nums">{pct === null ? '—' : `${pct}%`}</td>
                  <td className="py-2 text-neutral-500">{s.lastSeen ? new Date(s.lastSeen).toLocaleDateString() : '—'}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <div className="bg-white border border-neutral-200 rounded p-4">
        <div className="text-xs uppercase tracking-wide text-neutral-500 mb-2">Poslední ostré testy</div>
        {history.length === 0 ? <div className="text-sm text-neutral-500">Zatím žádné testy.</div> : (
          <div className="flex items-end gap-2 h-32">
            {history.map((t, i) => {
              const h = (t.score / t.total) * 100
              const passed = t.score >= 30
              return (
                <div key={i} className="flex-1 flex flex-col items-center justify-end" title={`${t.score}/${t.total}`}>
                  <div className={`w-full rounded-t ${passed ? 'bg-primary' : 'bg-danger'}`} style={{ height: `${h}%` }} />
                  <div className="text-[10px] text-neutral-500 mt-1">{t.score}</div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
