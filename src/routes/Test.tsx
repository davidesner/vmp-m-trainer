import { useCallback, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuestions } from '../hooks/useQuestions'
import { useProgress } from '../hooks/useProgress'
import { sampleTestQuestions } from '../lib/testStructure'
import { shuffleQuestionOptions } from '../lib/shuffleOptions'
import QuestionCard from '../components/QuestionCard'
import Timer from '../components/Timer'
import TestResults from '../components/TestResults'
import type { Question, GroupId } from '../types'

const TIMER_SEC = 30 * 60

export default function Test() {
  const { data, error, loading } = useQuestions()
  const { recordAttempt, recordTestHistory } = useProgress()
  const navigate = useNavigate()

  const sampled = useMemo<Question[]>(() => {
    if (!data) return []
    return sampleTestQuestions(data.questions, data.testStructure).map(q => shuffleQuestionOptions(q))
  }, [data])

  const [answers, setAnswers] = useState<Record<number, 'a'|'b'|'c'>>({})
  const [idx, setIdx] = useState(0)
  const [submitted, setSubmitted] = useState(false)
  const [startedAt] = useState(() => Date.now())

  const submit = useCallback(() => {
    setSubmitted(true)
    const at = new Date().toISOString()
    let score = 0
    const perGroup: Record<GroupId, { correct: number; total: number }> = {} as any
    for (const sq of sampled) {
      const ans = answers[sq.id]
      const correct = ans === sq.correct
      if (correct) score++
      recordAttempt(sq.id, correct, 'test')
      const g = sq.group
      if (!perGroup[g]) perGroup[g] = { correct: 0, total: 0 }
      perGroup[g].total++
      if (correct) perGroup[g].correct++
    }
    recordTestHistory({
      at, score, total: sampled.length,
      durationSec: Math.round((Date.now() - startedAt) / 1000),
      perGroup,
      questionIds: sampled.map(s => s.id),
    })
  }, [sampled, answers, startedAt, recordAttempt, recordTestHistory])

  if (loading) return <div className="p-8">Načítám otázky…</div>
  if (error) return <div className="p-8 text-danger">Chyba: {error.message}</div>
  if (!data || sampled.length === 0) return <div className="p-8">Žádné otázky.</div>

  const q = sampled[idx]
  const answeredCount = Object.keys(answers).length

  if (submitted) {
    return <TestResults questions={sampled} answers={answers} onHome={() => navigate('/')} projectRoot={import.meta.env.VITE_PROJECT_ROOT ?? ''} />
  }

  return (
    <div className="max-w-3xl mx-auto p-8">
      <div className="flex justify-between items-center mb-2 text-sm">
        <span className="text-neutral-500">Otázka <strong className="text-neutral-900">{idx + 1} / {sampled.length}</strong> · {q.group}</span>
        <Timer remainingSec={TIMER_SEC - Math.round((Date.now() - startedAt) / 1000)} ticking onExpire={submit} />
      </div>
      <div className="h-1 bg-neutral-200 rounded mb-6">
        <div className="h-1 bg-primary rounded" style={{ width: `${((idx+1)/sampled.length)*100}%` }}/>
      </div>

      <QuestionCard
        question={q}
        selectedKey={answers[q.id] ?? null}
        revealedCorrect={null}
        onSelect={(k) => setAnswers(a => ({ ...a, [q.id]: k }))}
      />

      <div className="flex justify-between items-center mt-6">
        <button onClick={() => setIdx(i => Math.max(0, i - 1))} className="px-4 py-2 border border-neutral-300 rounded text-sm" disabled={idx === 0}>← Předchozí</button>
        <span className="text-xs text-neutral-500">Odpovězeno: {answeredCount} / {sampled.length}</span>
        {idx < sampled.length - 1 ? (
          <button onClick={() => setIdx(i => i + 1)} className="px-4 py-2 bg-primary text-white rounded text-sm">Další →</button>
        ) : (
          <button onClick={submit} className="px-4 py-2 bg-primary text-white rounded text-sm font-semibold">Odeslat test</button>
        )}
      </div>
    </div>
  )
}
