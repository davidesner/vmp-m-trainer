import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuestions } from '../hooks/useQuestions'
import { useProgress } from '../hooks/useProgress'
import { useActiveTest } from '../hooks/useActiveTest'
import { sampleTestQuestions } from '../lib/testStructure'
import { shuffleQuestionOptions } from '../lib/shuffleOptions'
import { setTestInProgress, clearTestInProgress } from '../lib/testInProgress'
import QuestionCard from '../components/QuestionCard'
import Timer from '../components/Timer'
import TestResults from '../components/TestResults'
import type { Question, GroupId } from '../types'

export default function Test() {
  const { data, error, loading } = useQuestions()
  const { recordAttempt, recordTestHistory } = useProgress()
  const { activeTest } = useActiveTest()
  const navigate = useNavigate()

  // Re-sample when active category changes (different bundle/structure).
  const sampled = useMemo<Question[]>(() => {
    if (!data) return []
    return sampleTestQuestions(data.questions, data.testStructure).map(q => shuffleQuestionOptions(q))
  }, [data, activeTest])

  const [answers, setAnswers] = useState<Record<number, 'a'|'b'|'c'>>({})
  const [idx, setIdx] = useState(0)
  const [submitted, setSubmitted] = useState(false)
  const [startedAt, setStartedAt] = useState(() => Date.now())

  // Reset on category switch (modal guard ensures user already confirmed).
  useEffect(() => {
    setAnswers({})
    setIdx(0)
    setSubmitted(false)
    setStartedAt(Date.now())
  }, [activeTest])

  const timerSec = (data?.passing.durationMin ?? 30) * 60
  const remainingSec = Math.max(0, timerSec - Math.round((Date.now() - startedAt) / 1000))

  // Maintain global "test in progress" flag (used by CategoryDropdown to confirm switch).
  useEffect(() => {
    if (!data || submitted) { clearTestInProgress(); return }
    setTestInProgress({
      inProgress: true,
      answered: Object.keys(answers).length,
      total: sampled.length,
      remainingSec,
    })
    return () => clearTestInProgress()
  }, [data, submitted, answers, sampled.length, remainingSec])

  const submit = useCallback(() => {
    setSubmitted(true)
    const at = new Date().toISOString()
    let score = 0
    const perGroup: Record<GroupId, { correct: number; total: number }> = {} as Record<GroupId, { correct: number; total: number }>
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

  if (loading) return <div className="p-4 md:p-8">Načítám otázky…</div>
  if (error) return <div className="p-4 md:p-8 text-danger">Chyba: {error.message}</div>
  if (!data || sampled.length === 0) return <div className="p-4 md:p-8">Žádné otázky.</div>

  const q = sampled[idx]
  const answeredCount = Object.keys(answers).length

  if (submitted) {
    return <TestResults questions={sampled} answers={answers} onHome={() => navigate('/')} />
  }

  return (
    <div className="max-w-3xl mx-auto p-4 md:p-8">
      <div className="flex justify-between items-center mb-2 text-sm gap-2">
        <span className="text-neutral-500 truncate">Otázka <strong className="text-neutral-900">{idx + 1} / {sampled.length}</strong> · {q.group}</span>
        <Timer remainingSec={remainingSec} ticking onExpire={submit} />
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

      <div className="mt-6 flex flex-wrap items-center gap-2 sm:justify-between">
        <button onClick={() => setIdx(i => Math.max(0, i - 1))} className="px-4 py-2 border border-neutral-300 rounded text-sm" disabled={idx === 0}>← Předchozí</button>
        {idx < sampled.length - 1 ? (
          <button onClick={() => setIdx(i => i + 1)} className="px-4 py-2 bg-primary text-white rounded text-sm order-3 sm:order-none ml-auto">Další →</button>
        ) : (
          <button onClick={submit} className="px-4 py-2 bg-primary text-white rounded text-sm font-semibold order-3 sm:order-none ml-auto">Odeslat test</button>
        )}
        <span className="text-xs text-neutral-500 w-full sm:w-auto sm:order-none order-2 text-center sm:text-left">Odpovězeno: {answeredCount} / {sampled.length}</span>
      </div>
    </div>
  )
}
