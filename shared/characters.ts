import type { Character, CharacterId } from './types.ts'

export const CHARACTERS: Character[] = [
  {
    id: 'shibagy',
    name: '柴猪',
    english: 'Shibagy',
    color: '#fddf98',
    ink: '#3a2a16',
    blurb: '一到起点附近，就惦记着领钱。',
  },
  {
    id: 'ada',
    name: '果熊',
    english: 'Ada',
    color: '#fdd1d0',
    ink: '#3a1620',
    blurb: '租金算得清清楚楚，一分也不能少。',
  },
  {
    id: 'erchai',
    name: '二柴',
    english: 'Erchai',
    color: '#b4cad7',
    ink: '#1d2833',
    blurb: '平时慢悠悠，买地从不犹豫。',
  },
  {
    id: 'orangie',
    name: '小橘',
    english: 'Orangie',
    color: '#cfe7c2',
    ink: '#243024',
    blurb: '偏爱暖色地块，路过也想买下。',
  },
  {
    id: 'tutu',
    name: '兔兔',
    english: 'Tutu',
    color: '#dfd0e8',
    ink: '#2c2233',
    blurb: '就算免费停车，也要四处逛逛。',
  },
  {
    id: 'ginger',
    name: '小金',
    english: 'Ginger',
    color: '#e2e0dc',
    ink: '#2c2a28',
    blurb: '车站、电厂，统统想收入囊中。',
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
