import { useState } from 'react'
import type { GroupId, QuestionsBundle, ProgressStore } from '../types'
import { useActiveTest } from '../hooks/useActiveTest'
import { useAllProgress } from '../hooks/useAllProgress'
import { TESTS, TEST_IDS, type TestId } from '../lib/tests'

type Tab = TestId | 'all'

export default function Stats() {
  const { activeTest } = useActiveTest()
  const { bundles, progressByTest, loading, error } = useAllProgress()
  const [tab, setTab] = useState<Tab>(activeTest)

  if (loading) return <div className="p-4 md:p-8">Načítám…</div>
  if (error)   return <div className="p-4 md:p-8 text-danger">{error.message}</div>

  const tabBundle = tab !== 'all' ? bundles[tab] : null

  return (
    <div className="max-w-4xl mx-auto p-4 md:p-8">
      <h2 className="text-2xl font-bold mb-1">Statistiky</h2>
      <div className="text-sm text-neutral-500 mb-4">
        {tab === 'all' ? (
          <>Souhrnný pohled napříč kategoriemi</>
        ) : tabBundle ? (
          <>Kategorie <strong className="text-neutral-700">{tabBundle.testId}</strong> · {tabBundle.name}</>
        ) : null}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 border-b border-neutral-200">
        {TEST_IDS.map(id => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px ${
              tab === id
                ? 'border-primary text-primary-dark'
                : 'border-transparent text-neutral-500 hover:text-neutral-900'
            }`}
          >
            {TESTS[id].label} · {TESTS[id].shortDesc}
          </button>
        ))}
        <button
          type="button"
          onClick={() => setTab('all')}
          className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px ${
            tab === 'all'
              ? 'border-primary text-primary-dark'
              : 'border-transparent text-neutral-500 hover:text-neutral-900'
          }`}
        >
          Všechny
        </button>
      </div>

      {tab === 'all' ? (
        <AllTab bundles={bundles} progressByTest={progressByTest} />
      ) : (
        <PerCategoryTab
          bundle={bundles[tab] ?? null}
          store={progressByTest[tab] ?? { questions: {}, testHistory: [] }}
        />
      )}
    </div>
  )
}

function PerCategoryTab({ bundle, store }: { bundle: QuestionsBundle | null; store: ProgressStore }) {
  if (!bundle) return <div className="text-sm text-neutral-500">Bundle se nepodařilo načíst.</div>

  const perGroup: Record<GroupId, { count: number; attempts: number; correct: number; lastSeen: string | null }> = {}
  for (const g of bundle.groups) {
    perGroup[g.id] = { count: 0, attempts: 0, correct: 0, lastSeen: null }
  }
  for (const q of bundle.questions) perGroup[q.group].count++
  for (const [qid, p] of Object.entries(store.questions)) {
    const q = bundle.questions.find(qq => qq.id === Number(qid))
    if (!q) continue
    perGroup[q.group].attempts += p.attempts.length
    perGroup[q.group].correct += p.attempts.filter(a => a.correct).length
    if (!perGroup[q.group].lastSeen || p.lastSeen > (perGroup[q.group].lastSeen ?? '')) {
      perGroup[q.group].lastSeen = p.lastSeen
    }
  }

  const history = store.testHistory.slice(0, 10).reverse()
  const passing = bundle.passing.score

  return (
    <>
      <div className="bg-white border border-neutral-200 rounded p-4 mb-6">
        <div className="text-xs uppercase tracking-wide text-neutral-500 mb-2">Po skupinách</div>

        <div className="sm:hidden flex flex-col gap-3">
          {bundle.groups.map(g => {
            const s = perGroup[g.id]
            const pct = s.attempts > 0 ? Math.round((s.correct / s.attempts) * 100) : null
            return (
              <div key={g.id} className="border-t border-neutral-100 pt-3 first:border-t-0 first:pt-0 text-sm">
                <div className="flex justify-between items-baseline gap-2">
                  <div className="font-medium">{g.name}</div>
                  <div className="tabular-nums">{pct === null ? '—' : `${pct}%`}</div>
                </div>
                <div className="mt-1 flex justify-between text-xs text-neutral-500 tabular-nums">
                  <span>{s.count} otázek · {s.attempts} pokusů</span>
                  <span>{s.lastSeen ? new Date(s.lastSeen).toLocaleDateString() : '—'}</span>
                </div>
              </div>
            )
          })}
        </div>

        <div className="hidden sm:block overflow-x-auto">
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
              {bundle.groups.map(g => {
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
      </div>

      <div className="bg-white border border-neutral-200 rounded p-4">
        <div className="text-xs uppercase tracking-wide text-neutral-500 mb-2">Poslední ostré testy</div>
        {history.length === 0 ? <div className="text-sm text-neutral-500">Zatím žádné testy.</div> : (
          <div className="flex items-end gap-2 h-32">
            {history.map((t, i) => {
              const h = (t.score / t.total) * 100
              const passed = t.score >= passing
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
    </>
  )
}

function AllTab({
  bundles, progressByTest,
}: {
  bundles: Partial<Record<TestId, QuestionsBundle>>
  progressByTest: Record<TestId, ProgressStore>
}) {
  return (
    <div className="grid sm:grid-cols-2 gap-4">
      {TEST_IDS.map(id => {
        const bundle = bundles[id]
        const store = progressByTest[id]
        if (!bundle) return null

        const totalQuestions = bundle.questions.length
        const seen = Object.keys(store.questions).filter(qid => (store.questions[Number(qid)]?.attempts.length ?? 0) > 0).length
        let attempts = 0, correct = 0
        for (const p of Object.values(store.questions)) {
          attempts += p.attempts.length
          correct += p.attempts.filter(a => a.correct).length
        }
        const accuracy = attempts > 0 ? Math.round((correct / attempts) * 100) : null
        const coveragePct = Math.round((seen / totalQuestions) * 100)

        const tests = store.testHistory.length
        const lastTest = store.testHistory[0]
        const passed = lastTest ? lastTest.score >= bundle.passing.score : null

        return (
          <div key={id} className="bg-white border border-neutral-200 rounded-lg p-5">
            <div className="flex items-baseline justify-between gap-2 mb-3">
              <div>
                <div className="text-xs uppercase tracking-wide text-neutral-500">Kategorie {bundle.testId}</div>
                <div className="text-base font-semibold">{bundle.name}</div>
              </div>
              <div className="text-xs text-neutral-500 tabular-nums">{bundle.passing.score}/{bundle.passing.total}</div>
            </div>
            <dl className="grid grid-cols-2 gap-y-2 text-sm">
              <dt className="text-neutral-600">Pokrytí</dt>
              <dd className="text-right tabular-nums font-medium">{seen} / {totalQuestions} ({coveragePct}%)</dd>
              <dt className="text-neutral-600">Úspěšnost</dt>
              <dd className="text-right tabular-nums font-medium">{accuracy === null ? '—' : `${accuracy}%`}</dd>
              <dt className="text-neutral-600">Počet pokusů</dt>
              <dd className="text-right tabular-nums">{attempts}</dd>
              <dt className="text-neutral-600">Ostrých testů</dt>
              <dd className="text-right tabular-nums">{tests}</dd>
              <dt className="text-neutral-600">Naposledy</dt>
              <dd className="text-right text-neutral-700">
                {lastTest ? (
                  <span>
                    {new Date(lastTest.at).toLocaleDateString()} · <span className={passed ? 'text-primary-dark font-medium' : 'text-danger font-medium'}>{lastTest.score}/{lastTest.total}</span>
                  </span>
                ) : '—'}
              </dd>
            </dl>
          </div>
        )
      })}
    </div>
  )
}
