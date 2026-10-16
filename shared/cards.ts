import { spacesForMap } from './board.ts'
import type { Card, MapId } from './types.ts'

export const CARD_LIST: Card[] = [
  { id: 'c1', deck: 'chance', text: '前进到起点，领取 $200。', en: 'Advance to GO. Collect $200.', effect: { type: 'goto', space: 0 } },
  { id: 'c2', deck: 'chance', text: '前进到杭州。如果经过起点，领取 $200。', en: 'Advance to Hangzhou. If you pass GO, collect $200.', effect: { type: 'goto', space: 24 } },
  { id: 'c3', deck: 'chance', text: '前进到攀枝花。如果经过起点，领取 $200。', en: 'Advance to Panzhihua. If you pass GO, collect $200.', effect: { type: 'goto', space: 12 } },
  {
    id: 'c4',
    deck: 'chance',
    text: '前进到最近的国家电网或自来水厂。如果已有业主，掷骰子，按点数总和的 10 倍支付租金。', en: 'Advance to the nearest utility. If owned, roll the dice and pay the owner 10 times the total.',
    effect: { type: 'nearest', kind: 'utility' },
  },
  {
    id: 'c5',
    deck: 'chance',
    text: '前进到最近的火车站。如果已有业主，支付双倍租金。', en: 'Advance to the nearest railway station. If owned, pay the owner twice the usual rent.',
    effect: { type: 'nearest', kind: 'railroad' },
  },
  {
    id: 'c6',
    deck: 'chance',
    text: '前进到最近的火车站。如果已有业主，支付双倍租金。', en: 'Advance to the nearest railway station. If owned, pay the owner twice the usual rent.',
    effect: { type: 'nearest', kind: 'railroad' },
  },
  { id: 'c7', deck: 'chance', text: '银行结算有误，补发 $50。', en: 'Bank error in your favor. Collect $50.', effect: { type: 'money', amount: 50 } },
  { id: 'c8', deck: 'chance', text: '获得一张免费出狱卡。可保留到需要时使用，也可用于交易。', en: 'Get Out of Jail Free. Keep this card until needed, or trade it.', effect: { type: 'jail-card' } },
  { id: 'c9', deck: 'chance', text: '后退三格。', en: 'Go back three spaces.', effect: { type: 'back', steps: 3 } },
  { id: 'c10', deck: 'chance', text: '直接前往监狱。不经过起点，不领取 $200。', en: 'Go directly to Jail. Do not pass GO. Do not collect $200.', effect: { type: 'jail' } },
  { id: 'c11', deck: 'chance', text: '房产需要维修：每栋房屋支付 $25，每座旅馆支付 $100。', en: 'Make general repairs on your properties. Pay $25 per house and $100 per hotel.', effect: { type: 'repairs', house: 25, hotel: 100 } },
  { id: 'c12', deck: 'chance', text: '缴纳税款 $15。', en: 'Pay $15 in taxes.', effect: { type: 'money', amount: -15 } },
  { id: 'c13', deck: 'chance', text: '前进到合肥南站。如果经过起点，领取 $200。', en: 'Advance to Hefei South. If you pass GO, collect $200.', effect: { type: 'goto', space: 5 } },
  { id: 'c14', deck: 'chance', text: '前进到上海。', en: 'Advance to Shanghai.', effect: { type: 'goto', space: 39 } },
  { id: 'c15', deck: 'chance', text: '你当选董事长，向其他每位玩家支付 $50。', en: 'You have been elected chair of the board. Pay each other player $50.', effect: { type: 'pay-each', amount: 50 } },
  { id: 'c16', deck: 'chance', text: '投资到期，领取 $150。', en: 'Your investment matures. Collect $150.', effect: { type: 'money', amount: 150 } },

  { id: 'h1', deck: 'chest', text: '前进到起点，领取 $200。', en: 'Advance to GO. Collect $200.', effect: { type: 'goto', space: 0 } },
  { id: 'h2', deck: 'chest', text: '银行结算有误，补发 $200。', en: 'Bank error in your favor. Collect $200.', effect: { type: 'money', amount: 200 } },
  { id: 'h3', deck: 'chest', text: '支付诊疗费 $50。', en: 'Doctor’s bill. Pay $50.', effect: { type: 'money', amount: -50 } },
  { id: 'h4', deck: 'chest', text: '收到股票分红 $50。', en: 'Your stocks pay a dividend. Collect $50.', effect: { type: 'money', amount: 50 } },
  { id: 'h5', deck: 'chest', text: '获得一张免费出狱卡。可保留到需要时使用，也可用于交易。', en: 'Get Out of Jail Free. Keep this card until needed, or trade it.', effect: { type: 'jail-card' } },
  { id: 'h6', deck: 'chest', text: '直接前往监狱。不经过起点，不领取 $200。', en: 'Go directly to Jail. Do not pass GO. Do not collect $200.', effect: { type: 'jail' } },
  { id: 'h7', deck: 'chest', text: '歌剧之夜，向其他每位玩家收取 $50。', en: 'It’s opening night at the opera. Collect $50 from each other player.', effect: { type: 'collect-each', amount: 50 } },
  { id: 'h8', deck: 'chest', text: '度假基金到期，领取 $100。', en: 'Your vacation fund matures. Collect $100.', effect: { type: 'money', amount: 100 } },
  { id: 'h9', deck: 'chest', text: '收到所得税退税 $20。', en: 'Income tax refund. Collect $20.', effect: { type: 'money', amount: 20 } },
  { id: 'h10', deck: 'chest', text: '今天是你的生日！向其他每位玩家收取 $10。', en: 'It’s your birthday! Collect $10 from each other player.', effect: { type: 'collect-each', amount: 10 } },
  { id: 'h11', deck: 'chest', text: '人寿保险到期，领取 $100。', en: 'Your life insurance matures. Collect $100.', effect: { type: 'money', amount: 100 } },
  { id: 'h12', deck: 'chest', text: '支付住院费 $100。', en: 'Hospital bill. Pay $100.', effect: { type: 'money', amount: -100 } },
  { id: 'h13', deck: 'chest', text: '支付学费 $50。', en: 'Pay $50 in school fees.', effect: { type: 'money', amount: -50 } },
  { id: 'h14', deck: 'chest', text: '收到顾问费 $25。', en: 'Collect a $25 consulting fee.', effect: { type: 'money', amount: 25 } },
  { id: 'h15', deck: 'chest', text: '分摊道路维修费：每栋房屋支付 $40，每座旅馆支付 $115。', en: 'You are assessed for street repairs. Pay $40 per house and $115 per hotel.', effect: { type: 'repairs', house: 40, hotel: 115 } },
  { id: 'h16', deck: 'chest', text: '选美比赛获得亚军，领取奖金 $10。', en: 'You win second prize in a beauty contest. Collect $10.', effect: { type: 'money', amount: 10 } },
]

export const CARDS: Record<string, Card> = Object.fromEntries(CARD_LIST.map((c) => [c.id, c]))
export const CHANCE_IDS = CARD_LIST.filter((c) => c.deck === 'chance').map((c) => c.id)
export const CHEST_IDS = CARD_LIST.filter((c) => c.deck === 'chest').map((c) => c.id)

export function cardForMap(id: string, mapId: MapId = 'china'): Card | undefined {
  const card = CARDS[id]
  if (!card) return undefined
  const effect = card.effect
  if (effect.type === 'goto' && effect.space !== 0) {
    const space = spacesForMap(mapId)[effect.space]!
    const collect = effect.space !== 39
    return { ...card,
      text: `前进到${space.name}。${collect ? '如果经过起点，领取 $200。' : ''}`,
      en: `Advance to ${space.enShort}.${collect ? ' If you pass GO, collect $200.' : ''}`,
    }
  }
  if (effect.type === 'nearest') {
    const transport = mapId === 'usa' ? ['机场', 'airport'] : ['火车站', 'railway station']
    return { ...card,
      text: effect.kind === 'railroad'
        ? `前进到最近的${transport[0]}。如果已有业主，支付双倍租金。`
        : `前进到最近的${mapId === 'china' ? '国家电网' : '电力公司'}或自来水厂。如果已有业主，掷骰子，按点数总和的 10 倍支付租金。`,
      en: effect.kind === 'railroad'
        ? `Advance to the nearest ${transport[1]}. If owned, pay the owner twice the usual rent.`
        : card.en,
    }
  }
  return card
}
