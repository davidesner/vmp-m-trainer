import { useQuestions } from '../hooks/useQuestions'
import { TESTS } from '../lib/tests'
import { useActiveTest } from '../hooks/useActiveTest'

interface Props {
  /** When true, include test parameters (count / duration / pass threshold). Default false. */
  withParams?: boolean
  className?: string
}

export default function CategorySubtitle({ withParams = false, className = '' }: Props) {
  const { activeTest } = useActiveTest()
  const { data } = useQuestions()
  const t = TESTS[activeTest]

  let suffix = ''
  if (withParams && data) {
    const p = data.passing
    suffix = ` — ${p.total} otázek za ${p.durationMin} min, ≥ ${p.score} / ${p.total}`
  } else if (data) {
    suffix = ` — ${data.questions.length} otázek v databázi`
  }

  return (
    <div className={`text-sm text-neutral-500 ${className}`}>
      Kategorie <strong className="text-neutral-700">{t.label}</strong> · {t.name}{suffix}
    </div>
  )
}
