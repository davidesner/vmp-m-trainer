export interface ExplainLinkParams {
  qid: number
  folder: string
}

export function buildExplainLink({ qid, folder }: ExplainLinkParams): string {
  if (!folder) throw new Error('folder is required')
  const prompt = `Použij skill explain-vmp-question pro otázku #${qid}. Načti otázku z public/data/questions.json, prozkoumej kontext a ulož HTML do explanations/q-${qid}.html spolu s metadaty.`
  const params = new URLSearchParams({ q: prompt, folder })
  return `claude://cowork/new?${params.toString()}`
}
