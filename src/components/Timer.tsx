import { useEffect, useState } from 'react'

interface Props {
  remainingSec: number
  ticking?: boolean
  onExpire?: () => void
}

function fmt(s: number) {
  const mm = Math.floor(s / 60).toString().padStart(2, '0')
  const ss = (s % 60).toString().padStart(2, '0')
  return `${mm}:${ss}`
}

export default function Timer({ remainingSec, ticking, onExpire }: Props) {
  const [s, setS] = useState(remainingSec)
  useEffect(() => { setS(remainingSec) }, [remainingSec])
  useEffect(() => {
    if (!ticking) return
    if (s <= 0) { onExpire?.(); return }
    const id = setInterval(() => setS(prev => Math.max(0, prev - 1)), 1000)
    return () => clearInterval(id)
  }, [ticking, s, onExpire])
  return <span className={`tabular-nums ${s <= 60 ? 'text-danger' : ''}`}>⏱ {fmt(s)}</span>
}
