import { useState } from 'react'
import ExplainModal from './ExplainModal'
import type { Question } from '../types'

interface Props {
  question: Question
  userAnswer?: 'a' | 'b' | 'c' | null
}

export default function ExplainButton({ question, userAnswer }: Props) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="px-3 py-2 border border-accent text-accent text-sm rounded hover:bg-accent hover:text-white transition"
      >
        🧠 Vysvětlení
      </button>
      <ExplainModal question={question} userAnswer={userAnswer} open={open} onClose={() => setOpen(false)} />
    </>
  )
}
