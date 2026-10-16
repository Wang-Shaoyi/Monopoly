import type { Character, CharacterId } from './types.ts'

export const CHARACTERS: Character[] = [
  {
    id: 'shibagy',
    name: '柴猪',
    english: 'Shibagy',
    color: '#e2b657',
    ink: '#3a2a16',
    blurb: '见了起点就想冲过去。',
  },
  {
    id: 'ada',
    name: '果熊',
    english: 'Ada',
    color: '#6d5b8c',
    ink: '#f4efe6',
    blurb: '租金算到个位，一分不让。',
  },
  {
    id: 'erchai',
    name: '二柴',
    english: 'Erchai',
    color: '#6e8eb5',
    ink: '#1d2833',
    blurb: '看着慢，买起街来比谁都稳。',
  },
  {
    id: 'orangie',
    name: '小橘',
    english: 'Orangie',
    color: '#ef8b3a',
    ink: '#3a220f',
    blurb: '专挑暖色的街停下。',
  },
  {
    id: 'tutu',
    name: '兔兔',
    english: 'Tutu',
    color: '#d4566a',
    ink: '#3a1620',
    blurb: '停车格也要转一圈看看。',
  },
  {
    id: 'ginger',
    name: '小金',
    english: 'Ginger',
    color: '#8a8680',
    ink: '#f7f4ee',
    blurb: '铁路和电厂都想揣进口袋。',
  },
]

export function characterById(id: string | null | undefined): Character | undefined {
  return CHARACTERS.find((c) => c.id === id)
}

export function characterTitle(character: Pick<Character, 'english'>) {
  return character.english
}

export function isCharacterId(id: string): id is CharacterId {
  return CHARACTERS.some((c) => c.id === id)
}
