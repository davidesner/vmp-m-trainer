export interface ExplainLinkParams {
  qid: number
  folder: string
}

export function buildExplainLink({ qid, folder }: ExplainLinkParams): string {
  if (!folder) throw new Error('folder is required')
  const prompt = `Vysvětli mi otázku #${qid} z VMP M testu (skill explain-vmp-question). Začni výkladem v chatu, vizualizací pokud pomůže — uložení do HTML pak nabídneš.`
  const params = new URLSearchParams({ q: prompt, folder })
  return `claude://cowork/new?${params.toString()}`
}
