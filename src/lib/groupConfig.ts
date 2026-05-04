import type { Group, GroupId, TestSegment, ZkratkaId } from '../types'

export const ZKRATKA_TO_GROUP: Record<ZkratkaId, GroupId> = {
  PP1: 'plavebni-provoz',
  PP2: 'nocni-denni-signalizace',
  PP3: 'signalizace-rizeni-plavby',
  PP4: 'zvukove-signaly',
  TZ:  'zaklady-konstrukce-plavidel',
  ZP:  'zaklady-prvni-pomoci',
}

export const GROUPS: Group[] = [
  { id: 'plavebni-provoz',             name: 'Plavební provoz',                              zkratky: ['PP1'], testCount: 16 },
  { id: 'nocni-denni-signalizace',     name: 'Noční a denní signalizace',                    zkratky: ['PP2'], testCount: 7 },
  { id: 'signalizace-rizeni-plavby',   name: 'Signalizace pro řízení plavby na vodní cestě', zkratky: ['PP3'], testCount: 0 },
  { id: 'zvukove-signaly',             name: 'Zvukové signály',                              zkratky: ['PP4'], testCount: 0 },
  { id: 'vytyceni-vodnich-cest',       name: 'Vytyčení vodních cest',                        zkratky: [],      testCount: 0 },
  { id: 'zaklady-konstrukce-plavidel', name: 'Základy konstrukce plavidel',                  zkratky: ['TZ'],  testCount: 3 },
  { id: 'zaklady-prvni-pomoci',        name: 'Základy první pomoci',                         zkratky: ['ZP'],  testCount: 4 },
]

// 16/7/5/3/4 segment definition for the real test
export const TEST_STRUCTURE: TestSegment[] = [
  { groups: ['plavebni-provoz'],                                                                    count: 16 },
  { groups: ['nocni-denni-signalizace'],                                                            count: 7 },
  { groups: ['signalizace-rizeni-plavby', 'zvukove-signaly', 'vytyceni-vodnich-cest'],              count: 5 },
  { groups: ['zaklady-konstrukce-plavidel'],                                                        count: 3 },
  { groups: ['zaklady-prvni-pomoci'],                                                               count: 4 },
]
