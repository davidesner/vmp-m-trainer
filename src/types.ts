import type { TestId } from './lib/tests'

export type ZkratkaId = string  // per-test: PP1/PP2/.../TZ/ZP (M) nebo MP1.../N1.../M1/Z1 (C)

export type GroupId = string    // per-test: 'plavebni-provoz' (M) nebo 'mezinarodni-pravo' (C) atd.

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

export interface PassingThreshold {
  score: number
  total: number
  durationMin: number
}

export interface QuestionsBundle {
  testId: TestId
  version: string
  name: string
  scrapedAt: string
  groups: Group[]
  testStructure: TestSegment[]
  passing: PassingThreshold
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
