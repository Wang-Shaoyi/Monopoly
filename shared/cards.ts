import type { Card } from './types.ts'

export const CARD_LIST: Card[] = [
  { id: 'c1', deck: 'chance', text: '走到起点，把工资领了。', effect: { type: 'goto', space: 0 } },
  { id: 'c2', deck: 'chance', text: '走到杭州。路过起点的话，工资照领。', effect: { type: 'goto', space: 24 } },
  { id: 'c3', deck: 'chance', text: '走到攀枝花。路过起点的话，工资照领。', effect: { type: 'goto', space: 12 } },
  {
    id: 'c4',
    deck: 'chance',
    text: '走到最近的国家电网或自来水厂。要是已经有主人，掷骰子，按点数的十倍付钱。',
    effect: { type: 'nearest', kind: 'utility' },
  },
  {
    id: 'c5',
    deck: 'chance',
    text: '走到最近的火车站。要是已经有主人，租金翻倍。',
    effect: { type: 'nearest', kind: 'railroad' },
  },
  {
    id: 'c6',
    deck: 'chance',
    text: '走到最近的火车站。要是已经有主人，租金翻倍。',
    effect: { type: 'nearest', kind: 'railroad' },
  },
  { id: 'c7', deck: 'chance', text: '银行算错账了，补给你 $50。', effect: { type: 'money', amount: 50 } },
  { id: 'c8', deck: 'chance', text: '把这张卡留着。它可以抵出狱的罚款。', effect: { type: 'jail-card' } },
  { id: 'c9', deck: 'chance', text: '往回退三格。', effect: { type: 'back', steps: 3 } },
  { id: 'c10', deck: 'chance', text: '直接进监狱。不经过起点，也不发工资。', effect: { type: 'jail' } },
  { id: 'c11', deck: 'chance', text: '房子该修了。每栋 $25，旅馆每座 $100。', effect: { type: 'repairs', house: 25, hotel: 100 } },
  { id: 'c12', deck: 'chance', text: '缴 $15 的税。', effect: { type: 'money', amount: -15 } },
  { id: 'c13', deck: 'chance', text: '走到合肥南站。路过起点就领工资。', effect: { type: 'goto', space: 5 } },
  { id: 'c14', deck: 'chance', text: '走到上海。', effect: { type: 'goto', space: 39 } },
  { id: 'c15', deck: 'chance', text: '你当了街坊主席，给在座每人 $50。', effect: { type: 'pay-each', amount: 50 } },
  { id: 'c16', deck: 'chance', text: '建筑贷款到期，领 $150。', effect: { type: 'money', amount: 150 } },

  { id: 'h1', deck: 'chest', text: '走到起点，把工资领了。', effect: { type: 'goto', space: 0 } },
  { id: 'h2', deck: 'chest', text: '银行出错，补给你 $200。', effect: { type: 'money', amount: 200 } },
  { id: 'h3', deck: 'chest', text: '付医药费 $50。', effect: { type: 'money', amount: -50 } },
  { id: 'h4', deck: 'chest', text: '股票分红，领 $50。', effect: { type: 'money', amount: 50 } },
  { id: 'h5', deck: 'chest', text: '把这张卡留着。它可以抵出狱的罚款。', effect: { type: 'jail-card' } },
  { id: 'h6', deck: 'chest', text: '直接进监狱。不经过起点，也不发工资。', effect: { type: 'jail' } },
  { id: 'h7', deck: 'chest', text: '今晚看歌剧，向在座每人收 $50。', effect: { type: 'collect-each', amount: 50 } },
  { id: 'h8', deck: 'chest', text: '假期基金到期，领 $100。', effect: { type: 'money', amount: 100 } },
  { id: 'h9', deck: 'chest', text: '所得税退税，领 $20。', effect: { type: 'money', amount: 20 } },
  { id: 'h10', deck: 'chest', text: '今天你生日，在座每人给你 $10。', effect: { type: 'collect-each', amount: 10 } },
  { id: 'h11', deck: 'chest', text: '人寿保险到期，领 $100。', effect: { type: 'money', amount: 100 } },
  { id: 'h12', deck: 'chest', text: '付住院费 $100。', effect: { type: 'money', amount: -100 } },
  { id: 'h13', deck: 'chest', text: '付学费 $50。', effect: { type: 'money', amount: -50 } },
  { id: 'h14', deck: 'chest', text: '顾问费到账，领 $25。', effect: { type: 'money', amount: 25 } },
  { id: 'h15', deck: 'chest', text: '街道要修。每栋房子 $40，旅馆每座 $115。', effect: { type: 'repairs', house: 40, hotel: 115 } },
  { id: 'h16', deck: 'chest', text: '选美拿了第二，领 $10。', effect: { type: 'money', amount: 10 } },
]

export const CARDS: Record<string, Card> = Object.fromEntries(CARD_LIST.map((c) => [c.id, c]))
export const CHANCE_IDS = CARD_LIST.filter((c) => c.deck === 'chance').map((c) => c.id)
export const CHEST_IDS = CARD_LIST.filter((c) => c.deck === 'chest').map((c) => c.id)
