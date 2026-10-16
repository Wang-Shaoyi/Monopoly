import type { Card } from './types.ts'

export const CARD_LIST: Card[] = [
  { id: 'c1', deck: 'chance', text: '走到起点，把工资领了。', en: 'Advance to GO and collect your salary.', effect: { type: 'goto', space: 0 } },
  { id: 'c2', deck: 'chance', text: '走到杭州。路过起点的话，工资照领。', en: 'Advance to Hangzhou. If you pass GO, collect your salary.', effect: { type: 'goto', space: 24 } },
  { id: 'c3', deck: 'chance', text: '走到攀枝花。路过起点的话，工资照领。', en: 'Advance to Panzhihua. If you pass GO, collect your salary.', effect: { type: 'goto', space: 12 } },
  {
    id: 'c4',
    deck: 'chance',
    text: '走到最近的国家电网或自来水厂。要是已经有主人，掷骰子，按点数的十倍付钱。',
    en: 'Advance to the nearest utility. If it is owned, roll and pay ten times the dice.',
    effect: { type: 'nearest', kind: 'utility' },
  },
  {
    id: 'c5',
    deck: 'chance',
    text: '走到最近的火车站。要是已经有主人，租金翻倍。',
    en: 'Advance to the nearest station. If it is owned, pay double rent.',
    effect: { type: 'nearest', kind: 'railroad' },
  },
  {
    id: 'c6',
    deck: 'chance',
    text: '走到最近的火车站。要是已经有主人，租金翻倍。',
    en: 'Advance to the nearest station. If it is owned, pay double rent.',
    effect: { type: 'nearest', kind: 'railroad' },
  },
  { id: 'c7', deck: 'chance', text: '银行算错账了，补给你 $50。', en: 'Bank error in your favor. Collect $50.', effect: { type: 'money', amount: 50 } },
  { id: 'c8', deck: 'chance', text: '把这张卡留着。它可以抵出狱的罚款。', en: 'Keep this card. It gets you out of jail.', effect: { type: 'jail-card' } },
  { id: 'c9', deck: 'chance', text: '往回退三格。', en: 'Go back three spaces.', effect: { type: 'back', steps: 3 } },
  { id: 'c10', deck: 'chance', text: '直接进监狱。不经过起点，也不发工资。', en: 'Go to jail. Do not pass GO. Do not collect salary.', effect: { type: 'jail' } },
  { id: 'c11', deck: 'chance', text: '房子该修了。每栋 $25，旅馆每座 $100。', en: 'Make repairs. Pay $25 per house and $100 per hotel.', effect: { type: 'repairs', house: 25, hotel: 100 } },
  { id: 'c12', deck: 'chance', text: '缴 $15 的税。', en: 'Pay $15 in tax.', effect: { type: 'money', amount: -15 } },
  { id: 'c13', deck: 'chance', text: '走到合肥南站。路过起点就领工资。', en: 'Advance to Hefei South. If you pass GO, collect your salary.', effect: { type: 'goto', space: 5 } },
  { id: 'c14', deck: 'chance', text: '走到上海。', en: 'Advance to Shanghai.', effect: { type: 'goto', space: 39 } },
  { id: 'c15', deck: 'chance', text: '你当了街坊主席，给在座每人 $50。', en: 'You are elected chair. Pay each player $50.', effect: { type: 'pay-each', amount: 50 } },
  { id: 'c16', deck: 'chance', text: '建筑贷款到期，领 $150。', en: 'Your building loan matures. Collect $150.', effect: { type: 'money', amount: 150 } },

  { id: 'h1', deck: 'chest', text: '走到起点，把工资领了。', en: 'Advance to GO and collect your salary.', effect: { type: 'goto', space: 0 } },
  { id: 'h2', deck: 'chest', text: '银行出错，补给你 $200。', en: 'Bank error in your favor. Collect $200.', effect: { type: 'money', amount: 200 } },
  { id: 'h3', deck: 'chest', text: '付医药费 $50。', en: 'Pay a doctor fee of $50.', effect: { type: 'money', amount: -50 } },
  { id: 'h4', deck: 'chest', text: '股票分红，领 $50。', en: 'Stock dividend. Collect $50.', effect: { type: 'money', amount: 50 } },
  { id: 'h5', deck: 'chest', text: '把这张卡留着。它可以抵出狱的罚款。', en: 'Keep this card. It gets you out of jail.', effect: { type: 'jail-card' } },
  { id: 'h6', deck: 'chest', text: '直接进监狱。不经过起点，也不发工资。', en: 'Go to jail. Do not pass GO. Do not collect salary.', effect: { type: 'jail' } },
  { id: 'h7', deck: 'chest', text: '今晚看歌剧，向在座每人收 $50。', en: 'Opera night. Collect $50 from each player.', effect: { type: 'collect-each', amount: 50 } },
  { id: 'h8', deck: 'chest', text: '假期基金到期，领 $100。', en: 'Holiday fund matures. Collect $100.', effect: { type: 'money', amount: 100 } },
  { id: 'h9', deck: 'chest', text: '所得税退税，领 $20。', en: 'Income tax refund. Collect $20.', effect: { type: 'money', amount: 20 } },
  { id: 'h10', deck: 'chest', text: '今天你生日，在座每人给你 $10。', en: 'It is your birthday. Collect $10 from each player.', effect: { type: 'collect-each', amount: 10 } },
  { id: 'h11', deck: 'chest', text: '人寿保险到期，领 $100。', en: 'Life insurance matures. Collect $100.', effect: { type: 'money', amount: 100 } },
  { id: 'h12', deck: 'chest', text: '付住院费 $100。', en: 'Pay a hospital fee of $100.', effect: { type: 'money', amount: -100 } },
  { id: 'h13', deck: 'chest', text: '付学费 $50。', en: 'Pay school fees of $50.', effect: { type: 'money', amount: -50 } },
  { id: 'h14', deck: 'chest', text: '顾问费到账，领 $25。', en: 'Consulting fee. Collect $25.', effect: { type: 'money', amount: 25 } },
  { id: 'h15', deck: 'chest', text: '街道要修。每栋房子 $40，旅馆每座 $115。', en: 'Street repairs. Pay $40 per house and $115 per hotel.', effect: { type: 'repairs', house: 40, hotel: 115 } },
  { id: 'h16', deck: 'chest', text: '选美拿了第二，领 $10。', en: 'You came second in a beauty contest. Collect $10.', effect: { type: 'money', amount: 10 } },
]

export const CARDS: Record<string, Card> = Object.fromEntries(CARD_LIST.map((c) => [c.id, c]))
export const CHANCE_IDS = CARD_LIST.filter((c) => c.deck === 'chance').map((c) => c.id)
export const CHEST_IDS = CARD_LIST.filter((c) => c.deck === 'chest').map((c) => c.id)
