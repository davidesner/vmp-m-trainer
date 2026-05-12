export interface ClaudeLinkParams {
  qid: number
}

/**
 * Builds a Claude Desktop deeplink for follow-up questions about a specific
 * VMP question. The static explanation is rendered in-app; this link is only
 * for "I want to ask Claude more about this".
 */
export function buildFollowupLink({ qid }: ClaudeLinkParams): string {
  const prompt = `Mám doplňující dotaz k otázce #${qid} z VMP M testu. Vysvětlení mám zobrazené v appce — chci se zeptat na konkrétní detail.`
  const params = new URLSearchParams({ q: prompt })
  return `claude://new?${params.toString()}`
}
