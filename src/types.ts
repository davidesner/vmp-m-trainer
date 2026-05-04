export type ZkratkaId = 'PP1' | 'PP2' | 'PP3' | 'PP4' | 'TZ' | 'ZP'

export type GroupId =
  | 'plavebni-provoz'
  | 'nocni-denni-signalizace'
  | 'signalizace-rizeni-plavby'
  | 'zvukove-signaly'
  | 'vytyceni-vodnich-cest'
  | 'zaklady-konstrukce-plavidel'
  | 'zaklady-prvni-pomoci'

export interface Group {
  id: GroupId
  name: string
  zkratky: ZkratkaId[]
}

export interface QuestionOption {
  key: 'a' | 'b' | 'c'
  text: string
}

export interface Question {
  id: number
  zkratka: ZkratkaId
  group: GroupId
  text: string
  image: string | null
  options: QuestionOption[]
  correct: 'a' | 'b' | 'c'
}

export interface QuestionsBundle {
  version: string
  scrapedAt: string
  groups: Group[]
  testStructure: TestSegment[]
  questions: Question[]
}

export interface TestSegment {
  groups: GroupId[]
  count: number
}

export type AnswerMode = 'test' | 'practice'

export interface AttemptRecord {
  at: string
  correct: boolean
  mode: AnswerMode
}

export interface QuestionProgress {
  attempts: AttemptRecord[]
  lastSeen: string
}

export interface TestHistoryEntry {
  at: string
  score: number
  total: number
  durationSec: number
  perGroup: Record<GroupId, { correct: number; total: number }>
  questionIds: number[]
}

export interface ProgressStore {
  questions: Record<number, QuestionProgress>
  testHistory: TestHistoryEntry[]
}

export interface ExplanationMeta {
  qid: number
  generated_at: string
  sources: string[]
  session_url?: string
  model?: string
}

export type MixMode = 'random' | 'mix' | 'weak'
