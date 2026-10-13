import type { Question } from '../types'
import type { TestId } from './tests'

/**
 * Handpicked questions for the public landing page demo. Copied from
 * public/data/questions-*.json so the landing page needs no data fetch
 * besides the explanation itself. If the source data changes, update here.
 */
export interface LandingSample {
  label: string
  testId: TestId
  question: Question
}

export const LANDING_SAMPLES: LandingSample[] = [
  {
    label: 'Signální znak',
    testId: 'M',
    question: {
      id: 250, zkratka: 'PP4', group: 'zvukove-signaly',
      text: 'Tento signální znak (tabule) znamená:',
      image: '/data/images/M/q-250.jpg',
      options: [
        { key: 'a', text: 'zákaz předjíždění.' },
        { key: 'b', text: 'konec zákazu předjíždění.' },
        { key: 'c', text: 'rozdělení plavební dráhy.' },
      ],
      correct: 'a',
    },
  },
  {
    label: 'Noční světla',
    testId: 'M',
    question: {
      id: 167, zkratka: 'PP3', group: 'signalizace-rizeni-plavby',
      text: 'Tato signalizační světla nese:',
      image: '/data/images/M/q-167.jpg',
      options: [
        { key: 'a', text: 'samostatně plující plavidlo s vlastním pohonem.' },
        { key: 'b', text: 'převozní loď, která nepluje volně.' },
        { key: 'c', text: 'plavidlo, kterému bylo plavebním úřadem přiznáno oprávnění přednostního proplutí.' },
      ],
      correct: 'a',
    },
  },
  {
    label: 'První pomoc',
    testId: 'M',
    question: {
      id: 380, zkratka: 'ZP', group: 'zaklady-prvni-pomoci',
      text: 'Doporučený poměr kompresí hrudníku a dýchání z plic do plic při resuscitaci dospělých nebo dětí laiky je:',
      image: null,
      options: [
        { key: 'a', text: 'vždy 30:2 (s výjimkou novorozenců).' },
        { key: 'b', text: 'u dospělých 30:2, u dětí 5:2.' },
        { key: 'c', text: 'u dětí i dospělých 15:2.' },
      ],
      correct: 'a',
    },
  },
  {
    label: 'Námořní mapa',
    testId: 'C',
    question: {
      id: 105, zkratka: 'N2', group: 'navigace',
      text: 'Na námořní mapě znamená znak:',
      image: '/data/images/C/q-105.jpg',
      options: [
        { key: 'a', text: 'ponořená skála, nebezpečná pro plavbu, s uvedenou hloubkou nad ní.' },
        { key: 'b', text: 'ponořený kámen, plavba nad ním je bezpečná.' },
        { key: 'c', text: 'překážka s uvedenou výškou nad hladinou.' },
      ],
      correct: 'a',
    },
  },
]

/** Exam format per category, mirrored from `passing` / question counts in the data bundles. */
export const LANDING_CATEGORIES: Array<{
  id: TestId; name: string; questions: number; testSize: number; passScore: number; minutes: number
}> = [
  { id: 'M', name: 'Vůdce malého plavidla', questions: 407, testSize: 35, passScore: 30, minutes: 30 },
  { id: 'C', name: 'Příbřežní plavba na moři', questions: 215, testSize: 28, passScore: 24, minutes: 25 },
]
