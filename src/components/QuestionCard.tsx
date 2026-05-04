import type { Question } from '../types'

interface Props {
  question: Question
  selectedKey: 'a' | 'b' | 'c' | null
  revealedCorrect: 'a' | 'b' | 'c' | null  // when null = not revealed; non-null = reveal mode
  onSelect: (key: 'a' | 'b' | 'c') => void
}

export default function QuestionCard({ question, selectedKey, revealedCorrect, onSelect }: Props) {
  return (
    <div>
      {question.image && (
        <div className="mb-4">
          <img src={question.image} alt="" className="max-h-64 rounded border border-neutral-200" />
        </div>
      )}
      <div className="text-base font-semibold leading-snug mb-4">{question.text}</div>
      <div className="flex flex-col gap-2">
        {question.options.map(opt => {
          const isSelected = selectedKey === opt.key
          const isCorrect = revealedCorrect === opt.key
          const isWrongChosen = revealedCorrect !== null && isSelected && !isCorrect
          let cls = 'border rounded px-4 py-3 text-sm cursor-pointer transition'
          if (revealedCorrect !== null) {
            cls += isCorrect ? ' border-primary bg-primary-light'
                 : isWrongChosen ? ' border-danger bg-danger-light'
                 : ' border-neutral-200 text-neutral-500'
          } else {
            cls += isSelected ? ' border-accent bg-accent/5' : ' border-neutral-200 hover:border-neutral-400'
          }
          return (
            <button
              key={opt.key}
              type="button"
              onClick={() => revealedCorrect === null && onSelect(opt.key)}
              className={cls}
              disabled={revealedCorrect !== null}
            >
              <span className="text-neutral-500 font-semibold mr-2">{opt.key})</span>
              {opt.text}
              {revealedCorrect === opt.key && <span className="ml-2 text-primary-dark text-xs font-medium">✓ správně</span>}
              {isWrongChosen && <span className="ml-2 text-danger text-xs font-medium">✗ tvoje odpověď</span>}
            </button>
          )
        })}
      </div>
    </div>
  )
}
