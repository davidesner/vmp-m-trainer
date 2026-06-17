import { useState } from 'react'
import { useQuestions } from '../hooks/useQuestions'
import { useProgress } from '../hooks/useProgress'
import { sampleTestQuestions } from '../lib/testStructure'
import { sampleByMix } from '../lib/sampleQuestions'
import { shuffleQuestionOptions } from '../lib/shuffleOptions'
import PracticeRunner from '../components/PracticeRunner'
import CategorySubtitle from '../components/CategorySubtitle'
import type { Question, MixMode, GroupId } from '../types'

type SubMode = 'structure' | 'groups'

export default function Practice() {
  const { data, loading, error } = useQuestions()
  const { store } = useProgress()
  const [subMode, setSubMode] = useState<SubMode>('structure')
  const [mix, setMix] = useState<MixMode>('mix')
  const [count, setCount] = useState(25)
  const [selectedGroups, setSelectedGroups] = useState<GroupId[]>([])
  const [run, setRun] = useState<Question[] | null>(null)

  if (loading) return <div className="p-4 md:p-8">Načítám…</div>
  if (error) return <div className="p-4 md:p-8 text-danger">{error.message}</div>
  if (!data) return null

  if (run) return <PracticeRunner questions={run} onDone={() => setRun(null)} />

  const start = () => {
    let pool: Question[]
    let final: Question[]
    if (subMode === 'structure') {
      pool = data.questions
      // sample by structure first, then re-rank by mix mode within each segment
      final = sampleTestQuestions(pool, data.testStructure)
    } else {
      pool = data.questions.filter(q => selectedGroups.includes(q.group))
      final = sampleByMix(pool, store.questions, mix, Math.min(count, pool.length), Date.now())
    }
    if (subMode === 'structure' && mix !== 'random') {
      // Apply mix preference within structure: re-rank using bucket priority
      final = sampleByMix(final, store.questions, mix, final.length, Date.now())
    }
    setRun(final.map(q => shuffleQuestionOptions(q)))
  }

  const toggleGroup = (g: GroupId) => {
    setSelectedGroups(prev => prev.includes(g) ? prev.filter(x => x !== g) : [...prev, g])
  }

  return (
    <div className="max-w-3xl mx-auto p-4 md:p-8">
      <h2 className="text-2xl font-bold mb-1">Procvičování</h2>
      <CategorySubtitle className="mb-6" />

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6">
        <button onClick={() => setSubMode('structure')}
          className={`text-left rounded-lg p-4 border-2 ${subMode === 'structure' ? 'border-primary bg-primary-light' : 'border-neutral-200'}`}>
          <div className={`text-sm font-semibold ${subMode === 'structure' ? 'text-primary-dark' : ''}`}>● Struktura ostrého testu</div>
          <div className="text-xs text-neutral-600 mt-1">{data.passing.total} otázek dle reálné struktury ({data.testStructure.map(s => s.count).join('/')}). Bez timeru.</div>
        </button>
        <button onClick={() => setSubMode('groups')}
          className={`text-left rounded-lg p-4 border-2 ${subMode === 'groups' ? 'border-primary bg-primary-light' : 'border-neutral-200'}`}>
          <div className={`text-sm font-semibold ${subMode === 'groups' ? 'text-primary-dark' : ''}`}>○ Vybrat oblasti</div>
          <div className="text-xs text-neutral-600 mt-1">Vyber konkrétní skupiny + počet.</div>
        </button>
      </div>

      {subMode === 'groups' && (
        <div className="mb-6 bg-white border border-neutral-200 rounded p-4">
          <div className="text-xs uppercase tracking-wide text-neutral-500 mb-2">Skupiny</div>
          {data.groups.map(g => (
            <label key={g.id} className="flex items-center gap-2 py-1 text-sm">
              <input type="checkbox" checked={selectedGroups.includes(g.id)} onChange={() => toggleGroup(g.id)} />
              <span>{g.name}</span>
              <span className="text-neutral-500 text-xs">
                ({data.questions.filter(q => q.group === g.id).length} otázek)
              </span>
            </label>
          ))}
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span className="text-sm text-neutral-600">Počet:</span>
            {[10, 25, 50, -1].map(n => (
              <button key={n} onClick={() => setCount(n === -1 ? 99999 : n)}
                className={`px-3 py-1 rounded text-sm border ${count === (n === -1 ? 99999 : n) ? 'border-primary bg-primary-light' : 'border-neutral-300'}`}>
                {n === -1 ? 'vše' : n}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="mb-6">
        <div className="text-xs uppercase tracking-wide text-neutral-500 mb-2">Zaměření výběru</div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          {([['random','Náhodně'],['mix','⚖ Mix slabiny + známé'],['weak','Hlavně slabiny']] as const).map(([m, label]) => (
            <button key={m} onClick={() => setMix(m)}
              className={`px-3 py-3 rounded text-sm border-2 ${mix === m ? 'border-primary bg-primary-light text-primary-dark font-semibold' : 'border-neutral-200'}`}>
              {label}
            </button>
          ))}
        </div>
        {mix === 'mix' && (
          <p className="text-xs text-neutral-500 mt-2">
            40% otázek které občas pleteš, 30% nových, 15% nedávno správně, 15% dlouho neviděných.
          </p>
        )}
      </div>

      <div className="sm:text-right">
        <button onClick={start}
          disabled={subMode === 'groups' && selectedGroups.length === 0}
          className="w-full sm:w-auto px-6 py-3 bg-primary hover:bg-primary-dark text-white rounded font-semibold disabled:opacity-50">
          ▶ Spustit procvičování
        </button>
      </div>
    </div>
  )
}
