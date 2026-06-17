import { useEffect, useRef, useState } from 'react'
import { TESTS, TEST_IDS, type TestId } from '../lib/tests'
import { useActiveTest } from '../hooks/useActiveTest'

type Variant = 'sidebar' | 'badge'

interface Props {
  variant: Variant
  /** Optional gate. Return false (or false-resolving Promise) to abort the switch. */
  onBeforeSwitch?: (next: TestId) => boolean | Promise<boolean>
}

export default function CategoryDropdown({ variant, onBeforeSwitch }: Props) {
  const { activeTest, setActiveTest } = useActiveTest()
  const [open, setOpen] = useState(false)
  const wrapRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!open) return
    const onDoc = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false)
    }
    const onEsc = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', onDoc)
    document.addEventListener('keydown', onEsc)
    return () => {
      document.removeEventListener('mousedown', onDoc)
      document.removeEventListener('keydown', onEsc)
    }
  }, [open])

  async function handlePick(next: TestId) {
    if (next === activeTest) { setOpen(false); return }
    if (onBeforeSwitch) {
      const ok = await onBeforeSwitch(next)
      if (!ok) { setOpen(false); return }
    }
    setActiveTest(next)
    setOpen(false)
  }

  const active = TESTS[activeTest]

  if (variant === 'sidebar') {
    return (
      <div ref={wrapRef} className="relative">
        <div className="text-[10px] uppercase tracking-wide text-neutral-500 mb-1 font-semibold">Kategorie</div>
        <button
          type="button"
          onClick={() => setOpen(o => !o)}
          aria-haspopup="listbox"
          aria-expanded={open}
          className="w-full flex items-center justify-between px-3 py-1.5 text-sm border border-neutral-200 rounded hover:bg-neutral-50 bg-white"
        >
          <span><span className="font-bold">{active.label}</span> <span className="text-neutral-500 text-xs">· {active.shortDesc}</span></span>
          <Chevron />
        </button>
        {open && (
          <div role="listbox" className="absolute left-0 right-0 mt-1 bg-white border border-neutral-200 rounded shadow-md py-1 z-30 text-sm">
            {TEST_IDS.map(id => {
              const t = TESTS[id]
              const isActive = id === activeTest
              return (
                <button
                  key={id}
                  type="button"
                  role="option"
                  aria-selected={isActive}
                  onClick={() => handlePick(id)}
                  className="w-full text-left px-3 py-1.5 hover:bg-neutral-50 flex items-center gap-2"
                >
                  <span className={`w-4 inline-block ${isActive ? 'text-primary-dark' : ''}`}>{isActive ? '✓' : ''}</span>
                  <span><strong>{t.label}</strong> · {t.name}</span>
                </button>
              )
            })}
          </div>
        )}
      </div>
    )
  }

  // variant === 'badge' (mobile)
  return (
    <div ref={wrapRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className="flex items-center gap-1.5 pl-2.5 pr-2 py-1.5 rounded-full bg-primary-light border border-primary/40 text-primary-dark text-sm font-semibold active:bg-primary/20"
      >
        <span className="text-[10px] uppercase tracking-wide font-bold text-primary-dark/70 leading-none">Kat.</span>
        <span className="text-base font-bold leading-none">{active.label}</span>
        <Chevron />
      </button>
      {open && (
        <div role="listbox" className="absolute right-0 top-[calc(100%+6px)] z-50 bg-white border border-neutral-200 rounded-lg shadow-lg w-64 py-1 text-sm">
          <div className="px-3 pt-2 pb-1 text-[10px] uppercase tracking-wide text-neutral-500 font-semibold">Kategorie zkoušky</div>
          {TEST_IDS.map(id => {
            const t = TESTS[id]
            const isActive = id === activeTest
            return (
              <button
                key={id}
                type="button"
                role="option"
                aria-selected={isActive}
                onClick={() => handlePick(id)}
                className="w-full text-left px-3 py-2.5 hover:bg-neutral-50 flex items-center gap-2.5"
              >
                <span className={`w-4 inline-block text-base leading-none ${isActive ? 'text-primary-dark' : ''}`}>{isActive ? '✓' : ''}</span>
                <span className="font-bold text-base">{t.label}</span>
                <span className="text-neutral-600">· {t.name}</span>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

function Chevron() {
  return (
    <svg className="w-3.5 h-3.5" viewBox="0 0 12 12" fill="none" aria-hidden>
      <path d="M3 5l3 3 3-3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  )
}
