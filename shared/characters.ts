import type { Character, CharacterId } from './types.ts'

export const CHARACTERS: Character[] = [
  {
    id: 'shibagy',
    skill: 'Shibagy 喜欢捣蛋。其他角色与他停在同一格时，立即支付给他 $20；他停到其他角色所在格时也一样。监狱格除外。',
    skillEn: 'Shibagy loves mischief. Whenever he and another character land together, that character pays him $20. The Jail space is exempt.',
    name: '柴猪',
    english: 'Shibagy',
    color: '#fddf98',
    ink: '#3a2a16',
    blurb: '一到起点附近，就惦记着领钱。',
  },
  {
    id: 'ada',
    skill: 'Ada 喜欢购物，不用缴纳奢侈税。',
    skillEn: 'Ada loves shopping. She never pays Luxury Tax.',
    name: '果熊',
    english: 'Ada',
    color: '#fdd1d0',
    ink: '#3a1620',
    blurb: '租金算得清清楚楚，一分也不能少。',
  },
  {
    id: 'erchai',
    skill: 'Erchai 是酒店金会员，停在有酒店的地块时，只需支付 70% 的租金。',
    skillEn: 'Erchai is a hotel Gold member. He pays only 70% of the rent when landing on a property with a hotel.',
    name: '二柴',
    english: 'Erchai',
    color: '#b4cad7',
    ink: '#1d2833',
    blurb: '平时慢悠悠，买地从不犹豫。',
  },
  {
    id: 'orangie',
    skill: 'Orangie 很会捉迷藏，开局自带两张免费出狱卡，可使用或交易。',
    skillEn: 'Orangie is great at hide-and-seek. Start with two Get Out of Jail Free cards to use or trade.',
    name: '小橘',
    english: 'Orangie',
    color: '#cfe7c2',
    ink: '#243024',
    blurb: '偏爱暖色地块，路过也想买下。',
  },
  {
    id: 'tutu',
    skill: 'Tutu 是蹦蹦跳跳的小兔子。全局可发动两次技能：移动完成、地块结算前，选择再向前跳一格。未发动不消耗次数。',
    skillEn: 'Tutu loves to hop! Twice per game, after moving and before resolving the space, she may hop one extra space forward. Skipping costs no uses.',
    name: '兔兔',
    english: 'Tutu',
    color: '#dfd0e8',
    ink: '#2c2233',
    blurb: '就算免费停车，也要四处逛逛。',
  },
  {
    id: 'ginger',
    skill: 'Ginger 很有威望。按标价购买每个颜色组中最贵的城市时，只需支付该组最便宜城市的价格。拍卖不适用。',
    skillEn: 'Ginger commands respect. When buying the most expensive city in a color group at its listed price, pay the price of that group’s cheapest city instead. Auctions are excluded.',
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
