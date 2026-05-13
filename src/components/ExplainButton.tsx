import { useState } from 'react'
import ExplainModal from './ExplainModal'

interface Props {
  qid: number
}

export default function ExplainButton({ qid }: Props) {
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
      <ExplainModal qid={qid} open={open} onClose={() => setOpen(false)} />
    </>
  )
}
