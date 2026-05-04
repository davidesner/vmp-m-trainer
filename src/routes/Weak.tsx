import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuestions } from '../hooks/useQuestions'
import { useProgress } from '../hooks/useProgress'
import { sampleByMix } from '../lib/sampleQuestions'
import PracticeRunner from '../components/PracticeRunner'
import type { Question } from '../types'

export default function Weak() {
  const { data, loading } = useQuestions()
  const { store } = useProgress()
  const [run, setRun] = useState<Question[] | null>(null)
  const navigate = useNavigate()

  useEffect(() => {
    if (!data) return
    const picked = sampleByMix(data.questions, store.questions, 'weak', 20, Date.now())
    setRun(picked)
  }, [data, store.questions])

  if (loading || !run) return <div className="p-8">Načítám…</div>
  if (run.length === 0) return (
    <div className="p-8">
      <h2 className="text-xl font-semibold">Žádné slabiny zatím nemáme.</h2>
      <p className="text-neutral-600 mt-2">Udělej pár testů a vrať se sem.</p>
      <button onClick={() => navigate('/')} className="mt-4 px-4 py-2 bg-primary text-white rounded">Domů</button>
    </div>
  )
  return <PracticeRunner questions={run} onDone={() => navigate('/')} />
}
