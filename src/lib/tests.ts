// Registry kategorií zkoušky. Přidej sem novou položku, až přibude S.

export type TestId = 'M' | 'C'

export interface TestMeta {
  id: TestId
  label: string          // krátký label v UI (např. v dropdownu)
  name: string           // plný název kategorie
  shortDesc: string      // krátký popis pro tooltip / subtitle
  dataUrl: string        // cesta k questions JSON
  explanationsBase: string  // base path pro explanations HTML
}

export const TESTS: Record<TestId, TestMeta> = {
  M: {
    id: 'M',
    label: 'M',
    name: 'Vůdce malého plavidla',
    shortDesc: 'Malé plavidlo',
    dataUrl: '/data/questions-M.json',
    explanationsBase: '/explanations/M',
  },
  C: {
    id: 'C',
    label: 'C',
    name: 'Příbřežní plavba na moři',
    shortDesc: 'Námořní pobřežní',
    dataUrl: '/data/questions-C.json',
    explanationsBase: '/explanations/C',
  },
}

export const TEST_IDS: TestId[] = ['M', 'C']

export function isTestId(v: unknown): v is TestId {
  return typeof v === 'string' && (v === 'M' || v === 'C')
}
