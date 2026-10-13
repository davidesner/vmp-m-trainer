/**
 * Frequently asked questions on the landing page. Exam facts come from the SPS page
 * https://sps.gov.cz/dok-os/zkousky ; keep them in sync with LANDING_CATEGORIES in landingSamples.ts.
 * `answer` is plain text (also used for the FAQPage structured data); `links` are appended as references.
 */
export interface LandingFaqItem {
  question: string
  answer: string
  links?: Array<{ href: string; label: string }>
}

export const LANDING_FAQ: LandingFaqItem[] = [
  {
    question: 'Kolik otázek má test na vůdce malého plavidla a kolik bodů je potřeba?',
    answer:
      'Kategorie M: 35 otázek, 30 minut, potřebuješ aspoň 30 správně. Doplňková kategorie S (plachetnice): 14 otázek, '
      + '10 minut, aspoň 11 správně. Kategorie C (příbřežní plavba na moři): 28 otázek, 25 minut, aspoň 24 správně. '
      + 'Každá otázka má tři možnosti, správná je vždy jedna a je za ni jeden bod.',
  },
  {
    question: 'Jaký je rozdíl mezi kategoriemi M, S a C?',
    answer:
      'M je základní zkouška vůdce malého plavidla, její otázky platí i pro M20. S je doplňková část pro plachetnice '
      + '(i pro S20). C je zkouška pro příbřežní plavbu na moři a můžeš ji skládat, až když máš aspoň M20 nebo M. '
      + 'Kategorie se skládají postupně, každou musíš udělat před tou další.',
  },
  {
    question: 'Jsou v trenažéru všechny otázky ze zkoušky?',
    answer:
      'Ano. Trenažér obsahuje všechny otázky, které Státní plavební správa zveřejnila pro kategorie M, S i C. '
      + 'Ostrý test v trenažéru má stejný počet otázek, časový limit i hranici úspěchu jako skutečná zkouška.',
  },
  {
    question: 'Kde se přihlásit na zkoušku?',
    answer:
      'Zkoušky pořádá Státní plavební správa. Přihlásit se můžeš elektronicky, termíny zkoušek najdeš na jejím webu.',
    links: [
      { href: 'https://sps.gov.cz/dok-os/el-podani-prehled', label: 'Elektronické podání žádosti' },
      { href: 'https://terminy-zkousek.plavebniurad.cz/index.asp', label: 'Termíny zkoušek' },
    ],
  },
  {
    question: 'Je trenažér opravdu zdarma?',
    answer:
      'Ano, celý a bez reklam. Účet je také zdarma a slouží jen k uložení historie tvých pokusů. '
      + 'Kód trenažéru je veřejný na GitHubu.',
  },
  {
    question: 'Musím se registrovat?',
    answer:
      'Nemusíš. Bez účtu máš procvičování, ostré testy i vysvětlení. Účet potřebuješ, jen pokud chceš ukládat pokrok, '
      + 'vidět odhad připravenosti a dostávat otázky podle svých slabin.',
  },
]
