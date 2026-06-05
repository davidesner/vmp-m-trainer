import type { Question } from '../types'

export interface ClaudeLinkParams {
  question: Question
  /** What the user actually answered, if known — lets Claude address the mistake directly. */
  userAnswer?: 'a' | 'b' | 'c' | null
}

/**
 * Builds a Claude deeplink for follow-up questions about a specific VMP question.
 *
 * The whole question (text, options, correct answer, and the user's own answer
 * if known) is embedded in the prompt — Claude opened from this link has no
 * access to the app, so the prompt has to carry everything needed to dig in.
 *
 * Uses the universal `https://claude.ai/new?q=` link rather than the
 * `claude://` custom scheme: the universal link prefills the prompt in the
 * browser and still hands off to the desktop/mobile app when it's installed,
 * whereas `claude://` silently does nothing on a device without the app.
 */
export function buildFollowupLink({ question, userAnswer }: ClaudeLinkParams): string {
  const optionLabel = (key: 'a' | 'b' | 'c') => {
    const opt = question.options.find(o => o.key === key)
    return opt ? `${key}) ${opt.text}` : `${key})`
  }

  const lines = [
    'Pomoz mi pochopit otázku z testu Vůdce malého plavidla (VMP M).',
    '',
    `Otázka #${question.id}:`,
    question.text,
    '',
    'Možnosti:',
    ...question.options.map(o => `${o.key}) ${o.text}`),
    '',
    `Správná odpověď: ${optionLabel(question.correct)}`,
  ]

  if (userAnswer && userAnswer !== question.correct) {
    lines.push('', `Já jsem ale odpověděl špatně: ${optionLabel(userAnswer)}`)
  }

  lines.push(
    '',
    'Vysvětli mi prosím srozumitelně, proč je správná odpověď správná a proč jsou ostatní možnosti špatně. Pak se budu chtít doptat na detaily.',
  )

  const params = new URLSearchParams({ q: lines.join('\n') })
  return `https://claude.ai/new?${params.toString()}`
}
