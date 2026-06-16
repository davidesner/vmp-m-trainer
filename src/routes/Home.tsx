import { Link } from 'react-router-dom'
import { useMemo } from 'react'
import { useQuestions } from '../hooks/useQuestions'
import { useProgress } from '../hooks/useProgress'
import { estimatePass, coverage } from '../lib/passProbability'
import CategorySubtitle from '../components/CategorySubtitle'

export default function Home() {
  const { data, loading } = useQuestions()
  const { store } = useProgress()

  const pass = useMemo(() => data ? estimatePass(data, store.questions, data.passing.score) : null, [data, store.questions])
  const cov  = useMemo(() => data ? coverage(data, store.questions)    : null, [data, store.questions])

  const recent = store.testHistory.slice(0, 5)

  if (loading || !data || !pass || !cov) return <div className="p-4 md:p-8">Načítám…</div>

  const passingScore = data.passing.score
  const passingTotal = data.passing.total
  const passPct = Math.round(pass.passProbability * 100)
  const expScore = Math.round(pass.expectedScore * 10) / 10  // 1 decimal
  const covOverallPct = Math.round((cov.overall.seen / cov.overall.total) * 100)
  const accOverallPct = cov.overall.accuracy === null ? null : Math.round(cov.overall.accuracy * 100)

  // Color hints for pass probability
  const passColor = passPct >= 80 ? 'text-primary-dark' : passPct >= 50 ? 'text-amber-600' : 'text-danger'
  const passBg    = passPct >= 80 ? 'bg-primary'        : passPct >= 50 ? 'bg-amber-500'   : 'bg-danger'

  return (
    <div className="p-4 md:p-8 max-w-5xl">
      <h2 className="text-2xl font-bold mb-1">Přehled</h2>
      <CategorySubtitle withParams className="mb-6" />

      {/* Hero: pass probability + expected score + CTA */}
      <div className="bg-white border border-neutral-200 rounded-lg overflow-hidden mb-6">
        <div className="p-5 md:p-6 flex flex-col sm:flex-row items-start sm:justify-between gap-4 sm:gap-6">
          <div>
            <div className="text-xs uppercase tracking-wide text-neutral-500 mb-1">Odhad úspěchu u zkoušky</div>
            <div className={`text-4xl md:text-5xl font-bold ${passColor}`}>{passPct}%</div>
            <div className="text-sm text-neutral-600 mt-1">
              pravděpodobnost dosáhnout ≥ {passingScore} / {passingTotal}
            </div>
            <div className="mt-3 text-sm">
              Očekávaný výsledek: <strong>{expScore} / {passingTotal}</strong>
              {accOverallPct !== null && <> · průměrná úspěšnost: <strong>{accOverallPct}%</strong></>}
            </div>
            <div className="mt-1 text-sm text-neutral-600">
              Pokrytí otázek: <strong>{cov.overall.seen} / {cov.overall.total}</strong> ({covOverallPct}%)
            </div>
          </div>
          <Link to="/test" className="w-full sm:w-auto text-center px-6 py-3 bg-primary hover:bg-primary-dark text-white rounded font-semibold transition shrink-0">
            ▶ Spustit ostrý test
          </Link>
        </div>
        {/* Probability bar */}
        <div className="h-2 bg-neutral-100">
          <div className={`h-2 ${passBg} transition-all`} style={{ width: `${passPct}%` }}/>
        </div>
      </div>

      {/* Per-group breakdown */}
      <div className="bg-white border border-neutral-200 rounded-lg p-4 sm:p-5 mb-6">
        <div className="text-xs uppercase tracking-wide text-neutral-500 mb-3">Po skupinách</div>

        {/* Mobile: stacked cards */}
        <div className="sm:hidden flex flex-col gap-3">
          {data.groups.map(g => {
            const c = cov.perGroup[g.id]
            const covPct = c.total > 0 ? Math.round((c.seen / c.total) * 100) : 0
            const accPct = c.accuracy === null ? null : Math.round(c.accuracy * 100)
            const inTest = data.testStructure.reduce((sum, seg) => sum + (seg.groups.includes(g.id) ? seg.count : 0), 0)
            const accColor = accPct === null ? 'text-neutral-400'
                            : accPct >= 80 ? 'text-primary-dark'
                            : accPct >= 50 ? 'text-amber-600'
                            : 'text-danger'
            return (
              <div key={g.id} className="border-t border-neutral-100 pt-3 first:border-t-0 first:pt-0">
                <div className="flex justify-between items-baseline gap-2">
                  <div className="text-sm font-medium">{g.name}</div>
                  <div className={`text-sm tabular-nums font-medium ${accColor}`}>{accPct === null ? '—' : `${accPct}%`}</div>
                </div>
                <div className="mt-1 flex justify-between text-xs text-neutral-500 tabular-nums">
                  <span>Pokrytí {c.seen}/{c.total} ({covPct}%)</span>
                  <span>V testu: {inTest > 0 ? inTest : '—'}</span>
                </div>
                <div className="mt-2 h-1.5 bg-neutral-100 rounded">
                  <div className="h-1.5 bg-primary rounded" style={{ width: `${covPct}%` }}/>
                </div>
              </div>
            )
          })}
        </div>

        {/* sm+ : table */}
        <table className="hidden sm:table w-full text-sm">
          <thead>
            <tr className="text-left text-neutral-500">
              <th className="py-2 font-normal">Skupina</th>
              <th className="py-2 font-normal text-right">Pokrytí</th>
              <th className="py-2 font-normal text-right">Úspěšnost</th>
              <th className="py-2 font-normal text-right pr-4">V testu</th>
              <th className="py-2 font-normal w-32"></th>
            </tr>
          </thead>
          <tbody>
            {data.groups.map(g => {
              const c = cov.perGroup[g.id]
              const covPct = c.total > 0 ? Math.round((c.seen / c.total) * 100) : 0
              const accPct = c.accuracy === null ? null : Math.round(c.accuracy * 100)
              const inTest = data.testStructure.reduce((sum, seg) => sum + (seg.groups.includes(g.id) ? seg.count : 0), 0)
              const accColor = accPct === null ? 'text-neutral-400'
                              : accPct >= 80 ? 'text-primary-dark'
                              : accPct >= 50 ? 'text-amber-600'
                              : 'text-danger'
              return (
                <tr key={g.id} className="border-t border-neutral-100">
                  <td className="py-2">{g.name}</td>
                  <td className="py-2 text-right tabular-nums text-neutral-600">{c.seen}/{c.total} <span className="text-neutral-400">({covPct}%)</span></td>
                  <td className={`py-2 text-right tabular-nums font-medium ${accColor}`}>{accPct === null ? '—' : `${accPct}%`}</td>
                  <td className="py-2 text-right tabular-nums text-neutral-500 pr-4">{inTest > 0 ? inTest : '—'}</td>
                  <td className="py-2">
                    <div className="h-1.5 bg-neutral-100 rounded">
                      <div className="h-1.5 bg-primary rounded" style={{ width: `${covPct}%` }}/>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Recent tests */}
      {recent.length > 0 && (
        <div className="bg-white border border-neutral-200 rounded-lg p-4 sm:p-5">
          <div className="flex items-center justify-between mb-3 gap-3">
            <div className="text-xs uppercase tracking-wide text-neutral-500">
              {recent.length === 1 ? 'Poslední test' : `Posledních ${recent.length} ${recent.length < 5 ? 'testy' : 'testů'}`}
            </div>
            <Link to="/stats" className="text-xs text-accent hover:underline whitespace-nowrap">Více ve Statistikách →</Link>
          </div>
          <div className="flex flex-col gap-2">
            {recent.map((t, i) => {
              const pct = (t.score / t.total) * 100
              const passed = t.score >= passingScore
              return (
                <div key={i} className="flex items-center gap-2 sm:gap-3 text-sm">
                  <span className="text-neutral-500 tabular-nums shrink-0 w-20 sm:w-32 text-xs sm:text-sm">
                    <span className="sm:hidden">{new Date(t.at).toLocaleDateString('cs-CZ', { dateStyle: 'short' })}</span>
                    <span className="hidden sm:inline">{new Date(t.at).toLocaleString('cs-CZ', { dateStyle: 'short', timeStyle: 'short' })}</span>
                  </span>
                  <div className="flex-1 bg-neutral-100 h-3 rounded overflow-hidden min-w-0">
                    <div className={`h-3 rounded ${passed ? 'bg-primary' : 'bg-danger'}`} style={{ width: `${pct}%` }}/>
                  </div>
                  <span className="font-semibold tabular-nums w-12 sm:w-14 text-right shrink-0">{t.score}/{t.total}</span>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
