// Per-category scrape + test config.
// Add a new entry here when adding kategorie S.

export const CATEGORIES = {
  M: {
    label: 'M',
    name: 'Vůdce malého plavidla',
    version: 'M-2015',
    url: 'http://www.spspraha.cz/zkousky/otazky.asp?zp=M+2015',
    parser: 'parseM',
    // Maps zkratka in scrape -> group id used in app
    zkratkaToGroup: {
      PP1: 'plavebni-provoz',
      PP2: 'nocni-denni-signalizace',
      PP3: 'signalizace-rizeni-plavby',
      PP4: 'zvukove-signaly',
      TZ:  'zaklady-konstrukce-plavidel',
      ZP:  'zaklady-prvni-pomoci',
    },
    groups: [
      { id: 'plavebni-provoz',             name: 'Plavební provoz',                              zkratky: ['PP1'] },
      { id: 'nocni-denni-signalizace',     name: 'Noční a denní signalizace',                    zkratky: ['PP2'] },
      { id: 'signalizace-rizeni-plavby',   name: 'Signalizace pro řízení plavby na vodní cestě', zkratky: ['PP3'] },
      { id: 'zvukove-signaly',             name: 'Zvukové signály a signální znaky',             zkratky: ['PP4'] },
      { id: 'vytyceni-vodnich-cest',       name: 'Vytyčení vodních cest',                        zkratky: []      },
      { id: 'zaklady-konstrukce-plavidel', name: 'Základy konstrukce plavidel',                  zkratky: ['TZ']  },
      { id: 'zaklady-prvni-pomoci',        name: 'Základy první pomoci',                         zkratky: ['ZP']  },
    ],
    testStructure: [
      { groups: ['plavebni-provoz'],                                                       count: 16 },
      { groups: ['nocni-denni-signalizace'],                                               count: 7  },
      { groups: ['signalizace-rizeni-plavby', 'zvukove-signaly', 'vytyceni-vodnich-cest'], count: 5  },
      { groups: ['zaklady-konstrukce-plavidel'],                                           count: 3  },
      { groups: ['zaklady-prvni-pomoci'],                                                  count: 4  },
    ],
    passing: { score: 30, total: 35, durationMin: 30 },
  },

  C: {
    label: 'C',
    name: 'Příbřežní plavba na moři',
    version: 'C-2015',
    url: 'http://www.spspraha.cz/zkousky/otazky.asp?zp=C',
    parser: 'parseC',
    zkratkaToGroup: {
      MP1: 'mezinarodni-pravo',
      MP2: 'mezinarodni-pravo',
      MP3: 'mezinarodni-pravo',
      MP4: 'mezinarodni-pravo',
      N1:  'navigace',
      N2:  'navigace',
      N3:  'navigace',
      N4:  'navigace',
      M1:  'meteorologie',
      Z1:  'bezpecnost',
    },
    groups: [
      { id: 'mezinarodni-pravo', name: 'Mezinárodní právo a předpisy',              zkratky: ['MP1','MP2','MP3','MP4'] },
      { id: 'navigace',          name: 'Navigace a značení mořských vodních cest',  zkratky: ['N1','N2','N3','N4']     },
      { id: 'meteorologie',      name: 'Meteorologie',                              zkratky: ['M1']                     },
      { id: 'bezpecnost',        name: 'Bezpečnost a záchrana na moři',             zkratky: ['Z1']                     },
    ],
    testStructure: [
      { groups: ['mezinarodni-pravo'], count: 11 },
      { groups: ['navigace'],          count: 7  },
      { groups: ['meteorologie'],      count: 7  },
      { groups: ['bezpecnost'],        count: 3  },
    ],
    passing: { score: 24, total: 28, durationMin: 25 },
  },

  S: {
    label: 'S',
    name: 'Plachetnice',
    version: 'S-2015',
    url: 'http://www.spspraha.cz/zkousky/otazky.asp?zp=S+2015',
    parser: 'parseC',
    zkratkaToGroup: {
      P1: 'nazvoslovi-druhy-plachetnic',
      P2: 'konstrukce-plachetnic',
      P3: 'teorie-plachteni',
      P4: 'plavba-pod-plachtami',
    },
    groups: [
      { id: 'nazvoslovi-druhy-plachetnic', name: 'Názvosloví a druhy plachetnic',      zkratky: ['P1'] },
      { id: 'konstrukce-plachetnic',       name: 'Konstrukce a vlastnosti plachetnic', zkratky: ['P2'] },
      { id: 'teorie-plachteni',            name: 'Teorie plavby a stabilita',          zkratky: ['P3'] },
      { id: 'plavba-pod-plachtami',        name: 'Plavba pod plachtami a manévry',     zkratky: ['P4'] },
    ],
    // Zkouška S: 14 otázek náhodně z celé databáze (P1–P4), bez per-skupinové kvóty.
    testStructure: [
      { groups: ['nazvoslovi-druhy-plachetnic', 'konstrukce-plachetnic', 'teorie-plachteni', 'plavba-pod-plachtami'], count: 14 },
    ],
    passing: { score: 11, total: 14, durationMin: 10 },
  },
}
