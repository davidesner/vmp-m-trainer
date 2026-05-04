import { useState } from 'react'
import QuestionCard from './QuestionCard'
import ExplainButton from './ExplainButton'
import { useProgress } from '../hooks/useProgress'
import type { Question } from '../types'

interface Props {
  questions: Question[]
  onDone: () => void
}

export default function PracticeRunner({ questions, onDone }: Props) {
  const { recordAttempt } = useProgress()
  const [idx, setIdx] = useState(0)
  const [selected, setSelected] = useState<'a'|'b'|'c'|null>(null)
  const [revealed, setRevealed] = useState(false)
  const projectRoot = import.meta.env.VITE_PROJECT_ROOT ?? ''
  const q = questions[idx]
  const total = questions.length

  const submit = () => {
    if (selected === null) return
    setRevealed(true)
    recordAttempt(q.id, selected === q.correct, 'practice')
  }

  const next = () => {
    if (idx + 1 >= total) { onDone(); return }
    setIdx(idx + 1); setSelected(null); setRevealed(false)
  }

  return (
    <div className="max-w-3xl mx-auto p-8">
      <div className="text-sm text-neutral-500 mb-2">Otázka <strong>{idx + 1} / {total}</strong> · {q.group}</div>
      <div className="h-1 bg-neutral-200 rounded mb-6">
        <div className="h-1 bg-primary rounded" style={{ width: `${((idx+1)/total)*100}%` }}/>
      </div>

      <QuestionCard
        question={q}
        selectedKey={selected}
        revealedCorrect={revealed ? q.correct : null}
        onSelect={k => setSelected(k)}
      />

      <div className="flex justify-between items-center mt-6">
        <ExplainButton qid={q.id} projectRoot={projectRoot} />
        {!revealed ? (
          <button onClick={submit} disabled={selected === null}
            className="px-4 py-2 bg-primary text-white rounded text-sm font-semibold disabled:opacity-40">
            Odpovědět
          </button>
        ) : (
          <button onClick={next} className="px-4 py-2 bg-primary text-white rounded text-sm font-semibold">
            {idx + 1 >= total ? 'Konec' : 'Další otázka →'}
          </button>
        )}
      </div>
    </div>
  )
}
