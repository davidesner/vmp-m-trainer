import type { Question, GroupId } from '../types'
import QuestionCard from './QuestionCard'
import ExplainButton from './ExplainButton'

interface Props {
  questions: Question[]
  answers: Record<number, 'a'|'b'|'c'>
  projectRoot: string
  onHome: () => void
}

export default function TestResults({ questions, answers, projectRoot, onHome }: Props) {
  const score = questions.filter(q => answers[q.id] === q.correct).length
  const passed = score >= 30
  const perGroup: Record<GroupId, { correct: number; total: number }> = {} as any
  for (const q of questions) {
    if (!perGroup[q.group]) perGroup[q.group] = { correct: 0, total: 0 }
    perGroup[q.group].total++
    if (answers[q.id] === q.correct) perGroup[q.group].correct++
  }

  return (
    <div className="max-w-3xl mx-auto p-8">
      <div className={`rounded-lg p-6 mb-6 text-white ${passed ? 'bg-primary' : 'bg-danger'}`}>
        <div className="text-sm opacity-90">{passed ? 'Splněno!' : 'Nesplněno'}</div>
        <div className="text-3xl font-bold mt-1">{score} / {questions.length}</div>
        <div className="text-sm opacity-90 mt-1">Pro splnění je potřeba minimálně 30 bodů.</div>
      </div>

      <div className="mb-6 bg-white border border-neutral-200 rounded p-4">
        <div className="text-xs uppercase tracking-wide text-neutral-500 mb-2">Po skupinách</div>
        {Object.entries(perGroup).map(([g, s]) => (
          <div key={g} className="flex justify-between text-sm py-1">
            <span>{g}</span>
            <span className="tabular-nums">{s.correct}/{s.total}</span>
          </div>
        ))}
      </div>

      <h3 className="text-lg font-semibold mb-3">Otázky</h3>
      <div className="flex flex-col gap-6">
        {questions.map(q => (
          <div key={q.id} className="bg-white border border-neutral-200 rounded p-5">
            <QuestionCard question={q} selectedKey={answers[q.id] ?? null} revealedCorrect={q.correct} onSelect={() => {}} />
            <div className="mt-3"><ExplainButton qid={q.id} projectRoot={projectRoot} /></div>
          </div>
        ))}
      </div>

      <div className="mt-6 flex justify-end">
        <button onClick={onHome} className="px-4 py-2 bg-primary text-white rounded">Domů</button>
      </div>
    </div>
  )
}
