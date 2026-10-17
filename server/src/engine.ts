import { cardForMap, CHANCE_IDS, CHEST_IDS } from '../../shared/cards.ts'
import { translate } from '../../shared/phrases.ts'
import { RAILROAD_IDS, SPACES, spacesForMap, UTILITY_IDS, isDeed } from '../../shared/board.ts'
import {
  buildIssue,
  purchasePrice,
  rentForPlayer,
  interestOf,
  isTradeWindow,
  mortgageIssue,
  nearestAhead,
  sellIssue,
  unmortgageCost,
  unmortgageIssue,
} from '../../shared/rules.ts'
import type {
  Action,
  Card,
  Creditor,
  DebtStep,
  GameEvent,
  GamePlayer,
  GameState,
  HeldCard,
  Phase,
  Rules,
  SeatInput,
  Step,
  TradePack,
} from '../../shared/types.ts'
import { isCharacterId } from '../../shared/characters.ts'

export class RuleError extends Error {}

export interface ApplyResult {
  ok: boolean
  state: GameState
  events: GameEvent[]
  error?: string
}

const BANK: Creditor = { type: 'bank' }

function assert(cond: unknown, message: string): asserts cond {
  if (!cond) throw new RuleError(message)
}

export function arrangeSeats(seats: SeatInput[], rand: () => number): {
  seats: SeatInput[]
  lots: { controllerId: string; lot: number; characterIds: string[] }[]
} {
  const byController = new Map<string, SeatInput[]>()
  const seen: string[] = []
  for (const seat of seats) {
    const controllerId = seat.controllerId || seat.id
    if (!byController.has(controllerId)) {
      seen.push(controllerId)
      byController.set(controllerId, [])
    }
    byController.get(controllerId)!.push({ ...seat, controllerId })
  }
  const drawn = shuffle(seen, rand)
  const groups = new Map(drawn.map((controllerId) => [controllerId, shuffle(byController.get(controllerId)!, rand)]))
  const queues = drawn.map((controllerId) => [...groups.get(controllerId)!])
  const ordered: SeatInput[] = []
  let more = true
  while (more) {
    more = false
    for (const queue of queues) {
      const next = queue.shift()
      if (!next) continue
      ordered.push(next)
      more = true
    }
  }
  const lotOf = new Map(drawn.map((controllerId, index) => [controllerId, index + 1]))
  return {
    seats: ordered,
    lots: seen.map((controllerId) => ({
      controllerId,
      lot: lotOf.get(controllerId)!,
      characterIds: groups.get(controllerId)!.map((seat) => seat.characterId),
    })),
  }
}

function shuffle<T>(list: T[], rand: () => number): T[] {
  const copy = [...list]
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1))
    const swap = copy[i]!
    copy[i] = copy[j]!
    copy[j] = swap
  }
  return copy
}

function must(state: GameState, id: string): GamePlayer {
  const found = state.players.find((p) => p.id === id)
  assert(found, '找不到这位玩家')
  return found
}

function alive(state: GameState): GamePlayer[] {
  return state.order.map((id) => must(state, id)).filter((p) => !p.bankrupt)
}

function others(state: GameState, id: string): GamePlayer[] {
  return alive(state).filter((p) => p.id !== id)
}

function nextId(state: GameState, fromId: string): string | null {
  const start = state.order.indexOf(fromId)
  if (start < 0) return alive(state)[0]?.id ?? null
  for (let step = 1; step <= state.order.length; step++) {
    const id = state.order[(start + step) % state.order.length]!
    if (!must(state, id).bankrupt) return id
  }
  return null
}

// Action-local event sinks keep transient feedback out of persisted game state.
const cashEvents = new WeakMap<GameState, GameEvent[]>()
function changeCash(state: GameState, playerId: string, amount: number, reason: string, enReason: string) {
  if (amount === 0) return
  must(state, playerId).money += amount
  cashEvents.get(state)?.push({ type: 'money', playerId, amount, reason, enReason })
}

function log(state: GameState, text: string, en = text) {
  state.logSeq += 1
  state.log.push({ id: state.logSeq, text, en, at: Date.now() })
  if (state.log.length > 120) state.log.splice(0, state.log.length - 120)
}

function rollDice(state: GameState, rand: () => number): [number, number] {
  if (state.debugDice.length >= 2) {
    const a = state.debugDice.shift()!
    const b = state.debugDice.shift()!
    return [a, b]
  }
  return [1 + Math.floor(rand() * 6), 1 + Math.floor(rand() * 6)]
}

function maybeWin(state: GameState): boolean {
  if (state.phase === 'ended') return true
  const left = alive(state)
  if (state.players.length >= 2 && left.length <= 1) {
    state.phase = 'ended'
    state.winnerId = left[0]?.id ?? null
    state.extraRoll = false
    state.pendingExtra = false
    state.stack = []
    state.auction = null
    state.trade = null
    log(state, left[0] ? `${left[0].name} 赢了` : '这局结束了', left[0] ? `${left[0].name} wins` : 'The game is over')
    return true
  }
  return false
}

function enterIdle(state: GameState) {
  if (maybeWin(state)) return
  if (state.phase === 'pre-roll' || state.phase === 'buy' || state.phase === 'auction' || state.phase === 'debt' || state.phase === 'hop' || state.phase === 'ended') {
    return
  }
  const who = must(state, state.currentId)
  state.phase = 'post-roll'
  state.extraRoll = state.pendingExtra && !who.inJail && !who.bankrupt
}

function sendToJail(state: GameState, player: GamePlayer, events: GameEvent[]) {
  player.position = 10
  player.inJail = true
  player.jailTurns = 0
  state.pendingExtra = false
  state.extraRoll = false
  state.doublesStreak = 0
  events.push({ type: 'jail', playerId: player.id })
  log(state, `${player.name} 进监狱了`, `${player.name} went to jail`)
}

function reasonEn(state: GameState, reason: string) {
  return translate('en', reason, state.rules.mapId)
}

function placeEn(state: GameState, name: string) {
  return spacesForMap(state.rules.mapId).find((space) => space.name === name)?.en ?? name
}

function pay(state: GameState, fromId: string, amount: number, creditor: Creditor, reason: string) {
  const from = must(state, fromId)
  changeCash(state, fromId, -amount, reason, reasonEn(state, reason))
  if (creditor.type === 'bank') {
    if (state.rules.freeParking && amount > 0) {
      state.pot += amount
      log(
        state,
        `${from.name} 支付 $${amount}（${reason}），计入免费停车奖池（共 $${state.pot}）`,
        `${from.name} paid $${amount} for ${reasonEn(state, reason)}. Free Parking pot: $${state.pot}`,
      )
    } else {
      log(state, `${from.name} 支付 $${amount}（${reason}）`, `${from.name} paid $${amount} for ${reasonEn(state, reason)}`)
    }
    return
  }
  const to = must(state, creditor.id)
  changeCash(state, to.id, amount, reason, reasonEn(state, reason))
  log(
    state,
    `${from.name} 给 ${to.name} 支付 $${amount}（${reason}）`,
    `${from.name} paid ${to.name} $${amount} for ${reasonEn(state, reason)}`,
  )
}

function debt(playerId: string, amount: number, creditor: Creditor, reason: string): DebtStep {
  return { type: 'debt', playerId, amount, creditor, reason }
}

function stepsForCard(state: GameState, playerId: string, card: Card): Step[] {
  const me = must(state, playerId)
  const effect = card.effect
  switch (effect.type) {
    case 'money':
      if (effect.amount >= 0) return [{ type: 'collect', playerId, amount: effect.amount, reason: '卡牌奖励' }]
      return [debt(playerId, -effect.amount, BANK, '卡牌费用')]
    case 'goto':
      return [
        { type: 'advance', target: effect.space, collectGo: true },
        { type: 'resolve-space' },
      ]
    case 'nearest': {
      const targets = effect.kind === 'railroad' ? RAILROAD_IDS : UTILITY_IDS
      state.landingMod = effect.kind === 'railroad' ? 'rail2' : 'utility10'
      return [
        { type: 'advance', target: nearestAhead(me.position, targets), collectGo: true },
        { type: 'resolve-space' },
      ]
    }
    case 'back':
      return [
        { type: 'back', steps: effect.steps },
        { type: 'resolve-space' },
      ]
    case 'jail':
      return [{ type: 'go-jail' }]
    case 'jail-card':
      return []
    case 'repairs': {
      let amount = 0
      for (let i = 0; i < 40; i++) {
        const plot = state.plots[i]
        if (!plot || plot.ownerId !== playerId || plot.houses <= 0) continue
        amount += plot.houses === 5 ? effect.hotel : plot.houses * effect.house
      }
      if (amount <= 0) return []
      return [debt(playerId, amount, BANK, '房产维修费')]
    }
    case 'pay-each':
      return others(state, playerId).map((p) => debt(playerId, effect.amount, { type: 'player', id: p.id }, '卡牌指定付款'))
    case 'collect-each':
      return others(state, playerId).map((p) => debt(p.id, effect.amount, { type: 'player', id: playerId }, '卡牌指定付款（收款）'))
    default: {
      const neverEffect: never = effect
      throw new RuleError(`未知的牌效果 ${String(neverEffect)}`)
    }
  }
}

function drawFrom(state: GameState, deck: 'chance' | 'chest', rand: () => number): string | null {
  const pile = deck === 'chance' ? state.chance : state.chest
  const discard = deck === 'chance' ? state.chanceDiscard : state.chestDiscard
  if (!pile.length) {
    pile.push(...shuffle(discard, rand))
    discard.length = 0
  }
  return pile.shift() ?? null
}

function offerHop(state: GameState, player: GamePlayer) {
  if (player.characterId === 'tutu' && player.hopUses > 0 && !player.inJail) {
    state.stack.unshift({ type: 'hop-choice' })
  }
}

function meetingDebts(state: GameState): DebtStep[] {
  const me = must(state, state.currentId)
  if (me.position === 10 || me.inJail || me.bankrupt) return []
  const shibagy = state.players.find((p) => p.characterId === 'shibagy' && !p.bankrupt && !p.inJail && p.position === me.position)
  if (!shibagy) return []
  const payers = me.id === shibagy.id
    ? others(state, me.id).filter((p) => !p.inJail && p.position === me.position)
    : [me]
  return payers.map((p) => debt(p.id, 20, { type: 'player', id: shibagy.id }, 'Shibagy的捣蛋费'))
}

function perform(state: GameState, step: Step, events: GameEvent[], rand: () => number): boolean {
  const player = must(state, state.currentId)
  switch (step.type) {
    case 'forward': {
      const path: number[] = []
      if (step.steps > 0) events.push({ type: 'move', playerId: player.id, path })
      for (let i = 0; i < step.steps; i++) {
        player.position = (player.position + 1) % 40
        path.push(player.position)
        if (step.collectGo && player.position === 0) {
          changeCash(state, player.id, state.rules.salary, '经过起点', 'Passed GO')
          log(state, `${player.name} 经过起点，领了 $${state.rules.salary}`, `${player.name} passed GO and collected $${state.rules.salary}`)
        }
      }
      if (path.length) {
        if (step.allowHop !== false) offerHop(state, player)
      }
      return false
    }
    case 'advance': {
      const path: number[] = []
      if (player.position !== step.target) events.push({ type: 'move', playerId: player.id, path, jump: true })
      let guard = 0
      while (player.position !== step.target && guard++ < 40) {
        player.position = (player.position + 1) % 40
        path.push(player.position)
        if (step.collectGo && player.position === 0) {
          changeCash(state, player.id, state.rules.salary, '经过起点', 'Passed GO')
          log(state, `${player.name} 经过起点，领了 $${state.rules.salary}`, `${player.name} passed GO and collected $${state.rules.salary}`)
        }
      }
      if (path.length) {
        offerHop(state, player)
      }
      return false
    }
    case 'back': {
      const path: number[] = []
      if (step.steps > 0) events.push({ type: 'move', playerId: player.id, path })
      for (let i = 0; i < step.steps; i++) {
        player.position = (player.position + 39) % 40
        path.push(player.position)
      }
      if (path.length) {
        offerHop(state, player)
      }
      return false
    }
    case 'hop-choice':
      if (player.characterId !== 'tutu' || player.hopUses <= 0 || player.inJail) return false
      state.phase = 'hop'
      return true
    case 'resolve-space': {
      if (!step.meetingsChecked) {
        const meetings = meetingDebts(state)
        if (meetings.length) {
          state.stack.unshift(...meetings, { type: 'resolve-space', meetingsChecked: true })
          return false
        }
      }
      return resolveSpace(state, events, rand)
    }
    case 'draw':
      return drawCard(state, step.deck, events, rand)
    case 'go-jail':
      sendToJail(state, player, events)
      state.stack.unshift({ type: 'next-turn' })
      return false
    case 'next-turn': {
      if (maybeWin(state)) return true
      const id = nextId(state, state.currentId)
      if (!id) {
        state.phase = 'ended'
        return true
      }
      state.lastCard = null
      state.currentId = id
      state.doublesStreak = 0
      state.pendingExtra = false
      state.extraRoll = false
      state.cardChain = 0
      state.phase = 'pre-roll'
      log(state, `轮到 ${must(state, id).name}`, `${must(state, id).name}'s turn`)
      return true
    }
    case 'free-from-jail':
      player.inJail = false
      player.jailTurns = 0
      state.phase = 'pre-roll'
      state.extraRoll = false
      log(state, `${player.name} 已出狱，可以正常掷骰`, `${player.name} is out of jail`)
      return true
    case 'release-jail':
      player.inJail = false
      player.jailTurns = 0
      return false
    case 'collect': {
      const who = must(state, step.playerId)
      changeCash(state, who.id, step.amount, step.reason, reasonEn(state, step.reason))
      log(state, `${who.name} 领取 $${step.amount}（${step.reason}）`, `${who.name} collected $${step.amount} (${reasonEn(state, step.reason)})`)
      return false
    }
    default:
      return false
  }
}

function resolveSpace(state: GameState, events: GameEvent[], rand: () => number): boolean {
  const player = must(state, state.currentId)
  const space = spacesForMap(state.rules.mapId)[player.position]
  assert(space, '棋子位置无效')
  const mod = state.landingMod
  state.landingMod = null
  log(state, `${player.name} 停在 ${space.name}`, `${player.name} landed on ${space.en}`)

  if (space.type === 'go' || space.type === 'jail') {
    if (space.type === 'jail') log(state, `${player.name} 只是路过`, `${player.name} is just visiting`)
    return false
  }
  if (space.type === 'parking') {
    if (state.rules.freeParking && state.pot > 0) {
      changeCash(state, player.id, state.pot, '免费停车奖金', 'Free Parking pot')
      log(state, `${player.name} 领取免费停车奖金 $${state.pot}`, `${player.name} collected $${state.pot} from Free Parking`)
      state.pot = 0
    } else {
      log(state, `${player.name} 停在免费停车格`, `${player.name} landed on Free Parking`)
    }
    return false
  }
  if (space.type === 'tax') {
    if (player.characterId === 'ada' && space.id === 38) {
      log(state, `${player.name} 喜欢购物，免缴奢侈税`, `${player.name} loves shopping: Luxury Tax waived`)
      return false
    }
    state.stack.unshift(debt(player.id, space.tax || 0, BANK, space.name))
    return false
  }
  if (space.type === 'gotojail') {
    sendToJail(state, player, events)
    state.stack.unshift({ type: 'next-turn' })
    return false
  }
  if (space.type === 'chance' || space.type === 'chest') {
    state.stack.unshift({ type: 'draw', deck: space.type === 'chance' ? 'chance' : 'chest' })
    return false
  }

  const plot = state.plots[space.id]
  assert(plot, '找不到地块数据')
  if (!plot.ownerId) {
    state.buySpaceId = space.id
    state.phase = 'buy'
    log(state, `${space.name} 尚无业主`, `${space.en} is unowned`)
    return true
  }
  if (plot.ownerId === player.id) {
    log(state, `${player.name} 停在自己的房产上`, `${player.name} landed on their own property`)
    return false
  }
  if (plot.mortgaged) {
    log(state, `${space.name} 已抵押，本次免租`, `${space.en} is mortgaged. No rent is due`)
    return false
  }

  let rent = 0
  if (mod === 'utility10' && space.type === 'utility') {
    const dice = rollDice(state, rand)
    state.lastDice = dice
    events.push({ type: 'dice', playerId: player.id, dice })
    rent = (dice[0] + dice[1]) * 10
    log(
      state,
      `两家公用都在手里，按骰子的十倍收租。掷出 ${dice[0]} 和 ${dice[1]}`,
      `Both utilities are owned. Rent is ten times the dice: ${dice[0]} and ${dice[1]}`,
    )
  } else {
    const diceSum = state.lastDice ? state.lastDice[0] + state.lastDice[1] : 7
    rent = rentForPlayer(state, space.id, diceSum, player.id)
    if (mod === 'rail2') rent *= 2
  }
  if (rent > 0) {
    state.stack.unshift(debt(player.id, rent, { type: 'player', id: plot.ownerId }, `${space.name}租金`))
  }
  return false
}

function drawCard(state: GameState, deck: 'chance' | 'chest', events: GameEvent[], rand: () => number): boolean {
  if (state.cardChain >= 8) {
    log(state, '连续抽牌次数过多，跳过本次抽牌', 'Too many cards in a row. This one is skipped')
    return false
  }
  state.cardChain += 1
  const id = drawFrom(state, deck, rand)
  if (!id) {
    log(state, deck === 'chance' ? '机会牌已抽完' : '公益金牌已抽完', deck === 'chance' ? 'The Chance deck is empty' : 'The Community Chest deck is empty')
    return false
  }
  const card = cardForMap(id, state.rules.mapId)
  assert(card, '找不到卡牌数据')
  const player = must(state, state.currentId)
  state.lastCard = { id: card.id, deck: card.deck, text: card.text, en: card.en }
  events.push({ type: 'card', playerId: player.id, deck: card.deck, text: card.text, en: card.en })
  log(state, `${player.name} 抽到：${card.text}`, `${player.name} drew: ${card.en}`)
  if (card.effect.type === 'jail-card') {
    player.heldCards.push({ id: card.id, deck: card.deck })
    return false
  }
  const discard = deck === 'chance' ? state.chanceDiscard : state.chestDiscard
  discard.push(card.id)
  const steps = stepsForCard(state, player.id, card)
  if (steps.length) state.stack.unshift(...steps)
  return false
}

function runStack(state: GameState, events: GameEvent[], rand: () => number) {
  let guard = 0
  while (state.stack.length && guard++ < 48) {
    const step = state.stack[0]!
    if (step.type === 'debt') {
      const who = state.players.find((p) => p.id === step.playerId)
      if (!who || who.bankrupt) {
        state.stack.shift()
        continue
      }
      if (who.money >= step.amount) {
        state.stack.shift()
        pay(state, who.id, step.amount, step.creditor, step.reason)
        continue
      }
      state.phase = 'debt'
      log(
        state,
        `${who.name} 要付 $${step.amount}（${step.reason}）。先凑钱，或者破产`,
        `${who.name} owes $${step.amount} (${reasonEn(state, step.reason)}). Raise cash, or go bankrupt`,
      )
      return
    }
    state.stack.shift()
    if (perform(state, step, events, rand)) return
  }
  if (guard >= 48) {
    log(state, '处理步骤过多，已暂停结算', 'Too many actions in sequence. Resolution paused')
    state.stack = []
  }
  enterIdle(state)
}

function canManage(phase: Phase) {
  return phase === 'pre-roll' || phase === 'post-roll' || phase === 'buy'
}

function assertCurrent(state: GameState, playerId: string) {
  assert(state.currentId === playerId, '还没轮到你')
  assert(!must(state, playerId).bankrupt, '你已经破产了')
}

function ownedGroupClear(state: GameState, spaceId: number): boolean {
  const space = spacesForMap(state.rules.mapId)[spaceId]
  if (!space?.group) return true
  return state.plots.every((plot, id) => {
    if (spacesForMap(state.rules.mapId)[id]?.group !== space.group) return true
    return plot.houses === 0
  })
}

function auctionInterest(state: GameState) {
  const auction = state.auction
  return auction?.sellerId && state.plots[auction.spaceId]?.mortgaged ? interestOf(spacesForMap(state.rules.mapId)[auction.spaceId]?.mortgage || 0) : 0
}

function finishAuction(state: GameState) {
  const auction = state.auction
  const interest = auctionInterest(state)
  state.auction = null
  state.buySpaceId = null
  if (auction?.highBidderId && auction.highBid > 0) {
    const winner = must(state, auction.highBidderId)
    const name = spacesForMap(state.rules.mapId)[auction.spaceId]?.name ?? '这块地'
    if (winner.bankrupt || winner.money < auction.highBid + interest) {
      log(state, `${winner.name} 付不起 $${auction.highBid}，${name} 流拍了`, `${winner.name} can't pay $${auction.highBid}. ${placeEn(state, name)} goes unsold`)
    } else {
      changeCash(state, winner.id, -auction.highBid, '拍卖购入房产', 'Auction purchase')
      if (auction.sellerId) changeCash(state, auction.sellerId, auction.highBid, '拍卖出售房产', 'Property auction proceeds')
      changeCash(state, winner.id, -interest, '抵押利息', 'Mortgage interest')
      if (state.rules.freeParking) state.pot += interest
      const plot = state.plots[auction.spaceId]
      if (plot) plot.ownerId = winner.id
      log(state, `${winner.name} 以 $${auction.highBid} 拍下${name}`, `${winner.name} bought ${placeEn(state, name)} at auction for $${auction.highBid}`)
    }
  } else if (auction) {
    log(state, `${spacesForMap(state.rules.mapId)[auction.spaceId]?.name ?? '这块地'} 流拍了`, `${spacesForMap(state.rules.mapId)[auction.spaceId]?.en ?? 'This lot'} went unsold`)
  }
  if (state.phase !== 'ended') state.phase = auction?.sellerId ? 'debt' : 'resolving'
}

function setNextBidder(state: GameState): boolean {
  const auction = state.auction
  if (!auction) return false
  const order = alive(state).map((p) => p.id)
  if (!order.length) return false
  const idx = order.indexOf(auction.turnId)
  const start = idx === -1 ? -1 : idx
  for (let step = 1; step <= order.length; step++) {
    const id = order[(start + step) % order.length]!
    if (id === auction.highBidderId) continue
    if (id === auction.sellerId) continue
    if (auction.passed.includes(id)) continue
    const bidder = must(state, id)
    if (bidder.money < auction.highBid + 1 + auctionInterest(state)) {
      auction.passed.push(id)
      log(state, `${bidder.name} 现金不足，无法继续出价`, `${bidder.name} can't afford the current bid`)
      continue
    }
    auction.turnId = id
    return true
  }
  return false
}

function startAuction(state: GameState) {
  const spaceId = state.buySpaceId
  assert(spaceId !== null, '当前没有房产正在拍卖')
  state.auction = {
    spaceId,
    highBid: 0,
    highBidderId: null,
    turnId: state.currentId,
    passed: [],
  }
  state.phase = 'auction'
  log(state, `${spacesForMap(state.rules.mapId)[spaceId]?.name ?? '这块地'} 开始拍卖`, `Auction started for ${spacesForMap(state.rules.mapId)[spaceId]?.en ?? 'this lot'}`)
  if (!setNextBidder(state)) finishAuction(state)
}

function sanitizeAuction(state: GameState) {
  const auction = state.auction
  if (!auction) return
  if (auction.sellerId && must(state, auction.sellerId).bankrupt) {
    state.auction = null
    state.buySpaceId = null
    state.phase = 'resolving'
    return
  }
  if (auction.highBidderId && must(state, auction.highBidderId).bankrupt) {
    auction.highBidderId = null
    auction.highBid = 0
    auction.passed = []
  }
  auction.passed = auction.passed.filter((id) => !must(state, id).bankrupt)
  const turnGone = must(state, auction.turnId).bankrupt || auction.turnId === auction.highBidderId
  if (turnGone || auction.passed.includes(auction.turnId)) {
    if (!setNextBidder(state)) finishAuction(state)
  }
}

function liquidate(state: GameState, debtorId: string, creditor: Creditor) {
  const debtor = must(state, debtorId)
  for (let i = 0; i < 40; i++) {
    const plot = state.plots[i]
    if (!plot || plot.ownerId !== debtorId) continue
    if (plot.houses === 5) state.hotels += 1
    else state.houses += plot.houses
    plot.houses = 0
  }
  const creditorPlayer = creditor.type === 'player' ? state.players.find((p) => p.id === creditor.id && !p.bankrupt) : undefined
  if (creditorPlayer) {
    const remaining = debtor.money
    changeCash(state, debtor.id, -remaining, '破产清算', 'Bankruptcy settlement')
    changeCash(state, creditorPlayer.id, remaining, '接收破产资产', 'Bankruptcy proceeds')
  } else {
    changeCash(state, debtor.id, -debtor.money, '破产清算', 'Bankruptcy settlement')
  }
  for (const plot of state.plots) {
    if (plot.ownerId !== debtorId) continue
    plot.ownerId = null
    plot.mortgaged = false
  }
  for (const card of debtor.heldCards) {
    const discard = card.deck === 'chance' ? state.chanceDiscard : state.chestDiscard
    discard.push(card.id)
  }
  debtor.heldCards = []
  log(state, `${debtor.name} 破产了，未售出的房产恢复无主状态`, `${debtor.name} is bankrupt. Unsold properties are now unowned`)
  debtor.bankrupt = true
  debtor.inJail = false
  debtor.jailTurns = 0
  if (state.trade && (state.trade.from === debtorId || state.trade.to === debtorId)) state.trade = null
}

function continueAfterRemoval(state: GameState, _debtorId: string, events: GameEvent[], rand: () => number) {
  sanitizeAuction(state)
  if (maybeWin(state)) return
  if (must(state, state.currentId).bankrupt) {
    state.auction = null
    state.buySpaceId = null
    state.trade = null
    state.stack = [{ type: 'next-turn' }]
    state.pendingExtra = false
    state.phase = 'resolving'
    runStack(state, events, rand)
    return
  }
  if (state.stack[0]?.type === 'debt') {
    state.phase = 'debt'
    return
  }
  if (state.phase === 'auction' || state.phase === 'buy' || state.phase === 'pre-roll' || state.phase === 'post-roll' || state.phase === 'hop') return
  state.phase = 'resolving'
  runStack(state, events, rand)
}

function declareBankrupt(state: GameState, debtorId: string, events: GameEvent[], rand: () => number) {
  const step = state.stack[0]
  assert(state.phase === 'debt' && step?.type === 'debt' && step.playerId === debtorId, '当前无需申请破产')
  state.stack.shift()
  liquidate(state, debtorId, step.creditor)
  continueAfterRemoval(state, debtorId, events, rand)
}

function groupBuildings(state: GameState, spaceId: number): number {
  const group = spacesForMap(state.rules.mapId)[spaceId]?.group
  if (!group) return state.plots[spaceId]?.houses ?? 0
  return state.plots.reduce((sum, plot, id) => (spacesForMap(state.rules.mapId)[id]?.group === group ? sum + plot.houses : sum), 0)
}

function takeCards(who: GamePlayer, ids: string[]): HeldCard[] {
  const taken: HeldCard[] = []
  for (const id of ids) {
    const index = who.heldCards.findIndex((card) => card.id === id)
    assert(index >= 0, '该免费出狱卡已不可用')
    taken.push(who.heldCards.splice(index, 1)[0]!)
  }
  return taken
}

function acceptTrade(state: GameState, events: GameEvent[]) {
  const trade = state.trade
  assert(trade, '当前没有待处理的交易')
  assert(isTradeWindow(state) && state.currentId === trade.from, '当前无法完成交易')
  const from = must(state, trade.from)
  const to = must(state, trade.to)
  assert(!from.bankrupt && !to.bankrupt, '交易方已破产，无法完成交易')
  const offerMoney = trade.offer.money
  const wantMoney = trade.want.money
  assert(offerMoney >= 0 && wantMoney >= 0, '交易金额无效')
  for (const id of [...trade.offer.spaceIds, ...trade.want.spaceIds]) {
    assert(ownedGroupClear(state, id) && groupBuildings(state, id) === 0, '交易前，请先卖掉该颜色组的所有建筑')
  }
  let interestForTo = 0
  let interestForFrom = 0
  for (const id of trade.offer.spaceIds) {
    const plot = state.plots[id]
    assert(plot?.ownerId === from.id, '交易房产的所有权已变更')
    if (plot.mortgaged) interestForTo += interestOf(spacesForMap(state.rules.mapId)[id]?.mortgage || 0)
  }
  for (const id of trade.want.spaceIds) {
    const plot = state.plots[id]
    assert(plot?.ownerId === to.id, '对方房产的所有权已变更')
    if (plot.mortgaged) interestForFrom += interestOf(spacesForMap(state.rules.mapId)[id]?.mortgage || 0)
  }
  assert(from.money - offerMoney + wantMoney >= interestForFrom, `${from.name} 的现金不够`)
  assert(to.money - wantMoney + offerMoney >= interestForTo, `${to.name} 接手抵押地需要先付利息 $${interestForTo}`)
  const empty =
    offerMoney === 0 &&
    wantMoney === 0 &&
    trade.offer.spaceIds.length === 0 &&
    trade.want.spaceIds.length === 0 &&
    trade.offer.cardIds.length === 0 &&
    trade.want.cardIds.length === 0
  assert(!empty, '交易中至少需要包含现金、房产或卡牌')

  const offerCards = takeCards(from, trade.offer.cardIds)
  const wantCards = takeCards(to, trade.want.cardIds)
  changeCash(state, from.id, -offerMoney, '交易付款', 'Trade payment')
  changeCash(state, to.id, offerMoney, '交易收款', 'Trade proceeds')
  changeCash(state, to.id, -wantMoney, '交易付款', 'Trade payment')
  changeCash(state, from.id, wantMoney, '交易收款', 'Trade proceeds')
  changeCash(state, from.id, -interestForFrom, '抵押利息', 'Mortgage interest')
  changeCash(state, to.id, -interestForTo, '抵押利息', 'Mortgage interest')
  const interest = interestForFrom + interestForTo
  if (interest > 0 && state.rules.freeParking) state.pot += interest
  for (const id of trade.offer.spaceIds) {
    const plot = state.plots[id]!
    plot.ownerId = to.id
  }
  for (const id of trade.want.spaceIds) {
    const plot = state.plots[id]!
    plot.ownerId = from.id
  }
  from.heldCards.push(...wantCards)
  to.heldCards.push(...offerCards)
  state.trade = null
  log(state, `${from.name} 和 ${to.name} 完成了交易`, `${from.name} and ${to.name} completed the trade`)
  for (const [giver, receiver, pack] of [[from, to, trade.offer], [to, from, trade.want]] as const) {
    const spaces = spacesForMap(state.rules.mapId)
    const zh = [pack.money ? `$${pack.money}` : '', ...pack.spaceIds.map((id) => spaces[id]!.name), pack.cardIds.length ? `${pack.cardIds.length} 张出狱卡` : ''].filter(Boolean)
    const en = [pack.money ? `$${pack.money}` : '', ...pack.spaceIds.map((id) => spaces[id]!.en), pack.cardIds.length ? `${pack.cardIds.length} Get Out of Jail Free card${pack.cardIds.length === 1 ? '' : 's'}` : ''].filter(Boolean)
    log(state, `${giver.name} → ${receiver.name}：${zh.join('、') || '无'}`, `${giver.name} → ${receiver.name}: ${en.join(', ') || 'Nothing'}`)
  }
  events.push({ type: 'trade-completed', trade: structuredClone(trade) })
}

function moneyOk(phase: Phase, kind: 'build' | 'sell' | 'mortgage' | 'unmortgage', playerId: string, state: GameState) {
  if (state.phase === 'debt') {
    const owing = state.stack[0]
    assert(owing?.type === 'debt' && owing.playerId === playerId, '当前只有欠款玩家可以出售或抵押资产')
    assert(kind === 'sell' || kind === 'mortgage', '欠款期间只能出售建筑或抵押房产')
    return
  }
  if (state.phase === 'auction') {
    assert(kind !== 'build', '拍卖期间无法建造')
    assert(!must(state, playerId).bankrupt, '你已经破产了')
    return
  }
  assert(canManage(phase), '当前无法管理房产')
  assertCurrent(state, playerId)
}

function actionRoll(state: GameState, playerId: string, events: GameEvent[], rand: () => number, fromJail = false) {
  assertCurrent(state, playerId)
  const player = must(state, playerId)
  if (fromJail) {
    assert(state.phase === 'pre-roll' && player.inJail, '当前无法办理出狱')
  } else {
    assert(!player.inJail, '请先出狱，再正常掷骰')
    const again = state.phase === 'post-roll' && state.extraRoll
    assert(state.phase === 'pre-roll' || again, '当前无法掷骰子')
    assert(!state.trade, '请先处理当前交易')
  }
  state.cardChain = 0
  state.lastCard = null
  const dice = rollDice(state, rand)
  state.lastDice = dice
  events.push({ type: 'dice', playerId, dice })
  const doubles = dice[0] === dice[1]
  log(state, `${player.name} 掷出 ${dice[0]} 和 ${dice[1]}`, `${player.name} rolled ${dice[0]} and ${dice[1]}`)

  if (fromJail) {
    const forced = player.jailTurns >= 2
    if (doubles || forced) {
      state.pendingExtra = false
      state.doublesStreak = 0
      const steps: Step[] = []
      if (!doubles) steps.push(debt(player.id, 50, BANK, '第三次尝试后支付出狱费'))
      steps.push({ type: 'release-jail' }, { type: 'forward', steps: dice[0] + dice[1], collectGo: true }, { type: 'resolve-space' })
      if (doubles) log(state, `${player.name} 掷出相同点数，成功出狱`, `${player.name} rolled doubles and left jail`)
      else log(state, `${player.name} 第三次未掷出相同点数，支付 $50 后移动`, `${player.name} failed to roll doubles on the third attempt and must pay $50 before moving`)
      state.phase = 'resolving'
      state.stack.unshift(...steps)
      runStack(state, events, rand)
      return
    }
    player.jailTurns += 1
    log(state, `${player.name} 未掷出相同点数，继续留在监狱（第 ${player.jailTurns} 次尝试）`, `${player.name} didn't roll doubles and stays in jail (try ${player.jailTurns})`)
    state.phase = 'resolving'
    state.stack.unshift({ type: 'next-turn' })
    runStack(state, events, rand)
    return
  }

  if (doubles) {
    state.doublesStreak += 1
    if (state.doublesStreak >= 3) {
      log(state, `${player.name} 连续三次掷出相同点数，直接入狱`, `${player.name} rolled doubles three times and went to jail`)
      sendToJail(state, player, events)
      state.phase = 'resolving'
      state.stack.unshift({ type: 'next-turn' })
      runStack(state, events, rand)
      return
    }
    state.pendingExtra = true
  } else {
    state.doublesStreak = 0
    state.pendingExtra = false
  }
  state.phase = 'resolving'
  state.stack.unshift(
    { type: 'forward', steps: dice[0] + dice[1], collectGo: true },
    { type: 'resolve-space' },
  )
  runStack(state, events, rand)
}

function dispatch(state: GameState, playerId: string, action: Action, events: GameEvent[], rand: () => number) {
  assert(state.players.some((p) => p.id === playerId), '你未参与本局游戏')
  switch (action.type) {
    case 'surrender': {
      assert(state.phase !== 'ended', '本局游戏已结束')
      const player = must(state, playerId)
      assert(!player.bankrupt, '你已经破产了')
      const quitting = state.players.filter((p) => p.controllerId === player.controllerId && !p.bankrupt)
      const ids = new Set(quitting.map((p) => p.id))
      state.stack = state.stack.filter((step) => !(step.type === 'debt' && ids.has(step.playerId)))
      for (const who of quitting) {
        log(state, `${who.name} 认输了`, `${who.name} conceded`)
        liquidate(state, who.id, BANK)
      }
      continueAfterRemoval(state, playerId, events, rand)
      return
    }
    case 'debug-place':
      must(state, playerId).position = ((action.position % 40) + 40) % 40
      return
    case 'debug-own':
      for (const id of action.spaceIds) {
        const plot = state.plots[id]
        assert(plot && isDeed(spacesForMap(state.rules.mapId)[id]!), '无法获得该房产')
        plot.ownerId = playerId
        plot.mortgaged = false
        plot.houses = 0
      }
      return
    case 'debug-money':
      changeCash(state, playerId, action.amount - must(state, playerId).money, '现金调整', 'Cash adjustment')
      return
    case 'debug-end':
      state.trade = null
      state.pendingExtra = false
      state.extraRoll = false
      state.phase = 'resolving'
      state.stack = [{ type: 'next-turn' }]
      runStack(state, events, rand)
      return
    case 'debug-roll':
      state.debugDice.push(action.dice[0], action.dice[1])
      actionRoll(state, playerId, events, rand)
      return
    case 'hop':
    case 'skip-hop': {
      assertCurrent(state, playerId)
      const who = must(state, playerId)
      assert(state.phase === 'hop' && who.characterId === 'tutu' && who.hopUses > 0, '当前无法发动跳跃技能')
      if (action.type === 'hop') {
        who.hopUses -= 1
        state.landingMod = null
        state.stack.unshift({ type: 'forward', steps: 1, collectGo: true, allowHop: false })
        log(state, `${who.name} 向前跳一格（剩余 ${who.hopUses} 次）`, `${who.name} hopped one space forward (${who.hopUses} uses left)`)
      }
      state.phase = 'resolving'
      runStack(state, events, rand)
      return
    }
    case 'roll':
      actionRoll(state, playerId, events, rand)
      return
    case 'jail-roll':
      actionRoll(state, playerId, events, rand, true)
      return
    case 'jail-pay': {
      assertCurrent(state, playerId)
      const player = must(state, playerId)
      assert(state.phase === 'pre-roll' && player.inJail, '当前无需支付出狱费用')
      state.phase = 'resolving'
      state.stack.unshift(debt(player.id, 50, BANK, '出狱费'), { type: 'free-from-jail' })
      runStack(state, events, rand)
      return
    }
    case 'jail-card': {
      assertCurrent(state, playerId)
      const player = must(state, playerId)
      assert(state.phase === 'pre-roll' && player.inJail, '当前无法使用免费出狱卡')
      const index = action.deck
        ? player.heldCards.findIndex((card) => card.deck === action.deck)
        : player.heldCards.length - 1
      assert(index >= 0, '你没有免费出狱卡')
      const [card] = player.heldCards.splice(index, 1)
      assert(card, '你没有免费出狱卡')
      const discard = card.deck === 'chance' ? state.chanceDiscard : state.chestDiscard
      discard.push(card.id)
      player.inJail = false
      player.jailTurns = 0
      state.phase = 'pre-roll'
      log(state, `${player.name} 使用免费出狱卡出狱`, `${player.name} used a Get Out of Jail Free card`)
      return
    }
    case 'buy': {
      assertCurrent(state, playerId)
      assert(state.phase === 'buy' && state.buySpaceId !== null, '当前没有可购买的房产')
      const space = spacesForMap(state.rules.mapId)[state.buySpaceId]!
      const plot = state.plots[state.buySpaceId]!
      const player = must(state, playerId)
      assert(isDeed(space) && space.price, '该地块不可购买')
      assert(!plot.ownerId, '该房产已有业主')
      const cost = purchasePrice(state, playerId, space.id)
      assert(player.money >= cost, '现金不足，可先抵押房产再购买')
      changeCash(state, playerId, -cost, `购买${space.name}`, `Bought ${space.en}`)
      plot.ownerId = player.id
      plot.houses = 0
      plot.mortgaged = false
      log(state, `${player.name} 以 $${cost} 买下${space.name}`, `${player.name} bought ${space.en} for $${cost}`)
      state.buySpaceId = null
      state.phase = 'resolving'
      runStack(state, events, rand)
      return
    }
    case 'decline': {
      assertCurrent(state, playerId)
      assert(state.phase === 'buy', '当前无需作出购买决定')
      const name = spacesForMap(state.rules.mapId)[state.buySpaceId ?? -1]?.name ?? '这块地'
      if (state.rules.auction) {
        log(state, `${must(state, playerId).name} 不买 ${name}，拿去拍卖`, `${must(state, playerId).name} passed on ${placeEn(state, name)}. It goes to auction`)
        startAuction(state)
        if (!state.auction) {
          state.phase = 'resolving'
          runStack(state, events, rand)
        }
        return
      }
      log(state, `${must(state, playerId).name} 放弃购买${name}`, `${must(state, playerId).name} passed on ${placeEn(state, name)}`)
      state.buySpaceId = null
      state.phase = 'resolving'
      runStack(state, events, rand)
      return
    }
    case 'bid': {
      const auction = state.auction
      assert(state.phase === 'auction' && auction, '当前没有进行中的拍卖')
      assert(auction.turnId === playerId, '还没轮到你出价')
      const amount = Math.floor(Number(action.amount))
      assert(Number.isInteger(amount) && amount > auction.highBid, '出价必须高于当前最高价')
      const bidder = must(state, playerId)
      assert(playerId !== auction.sellerId, '不能竞拍自己的房产')
      assert(bidder.money >= amount + auctionInterest(state), '现金不足，无法支付该出价及抵押利息')
      auction.highBid = amount
      auction.highBidderId = playerId
      auction.passed = []
      auction.turnId = playerId
      log(state, `${bidder.name} 出价 $${amount}`, `${bidder.name} bid $${amount}`)
      if (!setNextBidder(state)) {
        finishAuction(state)
        if (!auction.sellerId) runStack(state, events, rand)
      }
      return
    }
    case 'pass': {
      const auction = state.auction
      assert(state.phase === 'auction' && auction, '当前没有进行中的拍卖')
      const actor = auction.turnId === playerId || !must(state, auction.turnId).connected ? auction.turnId : ''
      assert(actor, '还没轮到你放弃竞拍')
      if (auction.turnId !== playerId) assert(!must(state, auction.turnId).connected, '对方仍在线，无法代为操作')
      auction.passed.push(auction.turnId)
      log(state, `${must(state, auction.turnId).name} 放弃竞拍`, `${must(state, auction.turnId).name} passed`)
      if (!setNextBidder(state)) {
        finishAuction(state)
        if (!auction.sellerId) runStack(state, events, rand)
      }
      return
    }
    case 'end-turn': {
      assertCurrent(state, playerId)
      assert(state.phase === 'post-roll' && !state.extraRoll, '请先完成本回合的操作')
      assert(!state.trade, '请先处理当前交易')
      state.phase = 'resolving'
      state.stack.unshift({ type: 'next-turn' })
      runStack(state, events, rand)
      return
    }
    case 'build': {
      moneyOk(state.phase, 'build', playerId, state)
      const issue = buildIssue(state, playerId, action.spaceId)
      assert(!issue, issue || '不能建造')
      const space = spacesForMap(state.rules.mapId)[action.spaceId]!
      const plot = state.plots[action.spaceId]!
      const who = must(state, playerId)
      changeCash(state, who.id, -space.houseCost!, `在${space.name}建造`, `Building on ${space.en}`)
      if (plot.houses === 4) {
        state.hotels -= 1
        state.houses += 4
        plot.houses = 5
        log(state, `${who.name} 在${space.name} 盖了旅馆`, `${who.name} built a hotel on ${space.en}`)
      } else {
        state.houses -= 1
        plot.houses += 1
        log(state, `${who.name} 在${space.name} 盖了一栋房子`, `${who.name} built a house on ${space.en}`)
      }
      return
    }
    case 'sell': {
      moneyOk(state.phase, 'sell', playerId, state)
      const issue = sellIssue(state, playerId, action.spaceId)
      assert(!issue, issue || '不能出售')
      const space = spacesForMap(state.rules.mapId)[action.spaceId]!
      const plot = state.plots[action.spaceId]!
      const who = must(state, playerId)
      if (plot.houses === 5) {
        state.hotels += 1
        state.houses -= 4
        plot.houses = 4
      } else {
        plot.houses -= 1
        state.houses += 1
      }
      const refund = Math.floor((space.houseCost || 0) / 2)
      changeCash(state, who.id, refund, `出售${space.name}的建筑`, `Sold buildings on ${space.en}`)
      log(state, `${who.name} 卖掉 ${space.name} 上的一座建筑，获得 $${refund}`, `${who.name} sold a building on ${space.en} for $${refund}`)
      return
    }
    case 'mortgage': {
      assert(state.auction?.spaceId !== action.spaceId, '拍卖中的房产不能更改抵押状态')
      moneyOk(state.phase, 'mortgage', playerId, state)
      const issue = mortgageIssue(state, playerId, action.spaceId)
      assert(!issue, issue || '不能抵押')
      const space = spacesForMap(state.rules.mapId)[action.spaceId]!
      const plot = state.plots[action.spaceId]!
      plot.mortgaged = true
      changeCash(state, playerId, space.mortgage || 0, `抵押${space.name}`, `Mortgaged ${space.en}`)
      log(state, `${must(state, playerId).name} 抵押${space.name}，获得 $${space.mortgage}`, `${must(state, playerId).name} mortgaged ${space.en} for $${space.mortgage}`)
      return
    }
    case 'unmortgage': {
      assert(state.auction?.spaceId !== action.spaceId, '拍卖中的房产不能更改抵押状态')
      moneyOk(state.phase, 'unmortgage', playerId, state)
      const issue = unmortgageIssue(state, playerId, action.spaceId)
      assert(!issue, issue || '不能赎回')
      const space = spacesForMap(state.rules.mapId)[action.spaceId]!
      const plot = state.plots[action.spaceId]!
      const cost = unmortgageCost(space)
      const who = must(state, playerId)
      if (state.auction?.highBidderId === playerId) {
        assert(who.money - cost >= state.auction.highBid + auctionInterest(state), '赎回后现金不足以支付你的拍卖出价')
      }
      changeCash(state, who.id, -cost, `赎回${space.name}`, `Unmortgaged ${space.en}`)
      plot.mortgaged = false
      if (state.rules.freeParking) state.pot += cost - (space.mortgage || 0)
      log(state, `${must(state, playerId).name} 赎回 ${space.name}，付了 $${cost}`, `${must(state, playerId).name} unmortgaged ${space.en} for $${cost}`)
      return
    }
    case 'auction-property': {
      const step = state.stack[0]
      assert(state.phase === 'debt' && step?.type === 'debt' && step.playerId === playerId, '只有欠款玩家可以拍卖房产筹款')
      const space = spacesForMap(state.rules.mapId)[action.spaceId]
      assert(space && isDeed(space) && state.plots[action.spaceId]?.ownerId === playerId, '只能拍卖自己的房产')
      assert(ownedGroupClear(state, action.spaceId), '拍卖前，请先卖掉该颜色组的所有建筑')
      state.auction = { sellerId: playerId, spaceId: action.spaceId, highBid: 0, highBidderId: null, turnId: playerId, passed: [] }
      state.phase = 'auction'
      log(state, `${must(state, playerId).name} 拍卖${space.name}筹款`, `${must(state, playerId).name} is auctioning ${space.en} to raise cash`)
      if (!setNextBidder(state)) finishAuction(state)
      return
    }
    case 'pay-debt': {
      const step = state.stack[0]
      assert(state.phase === 'debt' && step?.type === 'debt' && step.playerId === playerId, '当前没有待支付的欠款')
      const who = must(state, playerId)
      assert(who.money >= step.amount, '现金仍不足以偿还欠款')
      state.stack.shift()
      pay(state, playerId, step.amount, step.creditor, step.reason)
      state.phase = 'resolving'
      runStack(state, events, rand)
      return
    }
    case 'bankrupt':
      declareBankrupt(state, playerId, events, rand)
      return
    case 'trade': {
      assertCurrent(state, playerId)
      assert(isTradeWindow(state), '当前无法发起交易')
      assert(!state.trade, '请先处理上一笔交易')
      assert(action.to !== playerId, '不能与同一个角色交易')
      const to = must(state, action.to)
      assert(!to.bankrupt, '对方已破产，无法交易')
      const pack = (value: TradePack): TradePack => ({
        money: Math.max(0, Math.floor(Number(value.money) || 0)),
        spaceIds: [...new Set(value.spaceIds.map((id) => Math.floor(id)))],
        cardIds: [...new Set(value.cardIds.map(String))],
      })
      state.trade = {
        id: `${state.logSeq + 1}`,
        from: playerId,
        to: action.to,
        offer: pack(action.offer),
        want: pack(action.want),
      }
      log(state, `${must(state, playerId).name} 向 ${to.name} 发起交易`, `${must(state, playerId).name} offered ${to.name} a trade`)
      return
    }
    case 'cancel-trade':
      assert(state.trade?.from === playerId, '你没有待处理的交易提议')
      state.trade = null
      log(state, `${must(state, playerId).name} 取消了交易`, `${must(state, playerId).name} canceled the trade`)
      return
    case 'respond-trade':
      assert(state.trade?.to === playerId, '你没有收到待处理的交易')
      if (!action.accept) {
        log(state, `${must(state, playerId).name} 拒绝了交易`, `${must(state, playerId).name} declined the trade`)
        state.trade = null
        return
      }
      acceptTrade(state, events)
      return
    case 'skip-offline': {
      if (state.phase === 'hop' && !must(state, state.currentId).connected) {
        assert(must(state, playerId).connected, '当前无法代为操作')
        dispatch(state, state.currentId, { type: 'skip-hop' }, events, rand)
        return
      }
      assert(must(state, playerId).connected && !must(state, playerId).bankrupt, '当前无法代为操作')
      if (state.phase === 'buy' && !must(state, state.currentId).connected) {
        dispatch(state, state.currentId, { type: 'decline' }, events, rand)
        return
      }
      if (state.phase === 'auction' && state.auction && !must(state, state.auction.turnId).connected) {
        dispatch(state, playerId, { type: 'pass' }, events, rand)
        return
      }
      if (state.phase === 'debt') {
        assert(false, '是否破产须由欠款玩家自行决定')
        return
      }
      assert(
        (state.phase === 'pre-roll' || state.phase === 'post-roll') && !must(state, state.currentId).connected,
        '当前玩家仍在线',
      )
      const skipped = must(state, state.currentId)
      state.trade = null
      state.pendingExtra = false
      if (skipped.inJail && state.phase === 'pre-roll') skipped.jailTurns = Math.min(2, skipped.jailTurns + 1)
      log(state, `${skipped.name} 已掉线，跳过本回合`, `${skipped.name} is offline. Skipping this turn`)
      state.phase = 'resolving'
      state.stack = [{ type: 'next-turn' }]
      runStack(state, events, rand)
      return
    }
    default: {
      const neverAction: never = action
      throw new RuleError(`未知行动 ${String(neverAction)}`)
    }
  }
}

export function createGame(seats: SeatInput[], rules: Rules, rand: () => number = Math.random): GameState {
  assert(seats.length >= 1 && seats.length <= 6, '每局需要一到六个角色')
  assert(new Set(seats.map((s) => s.characterId)).size === seats.length, '每个角色只能由一位玩家选择')
  for (const seat of seats) assert(isCharacterId(seat.characterId), '所选角色无效')
  const state: GameState = {
    players: seats.map((seat) => ({
      id: seat.id,
      controllerId: seat.controllerId || seat.id,
      name: seat.name,
      characterId: seat.characterId,
      money: rules.startingMoney,
      position: 0,
      inJail: false,
      jailTurns: 0,
      heldCards: seat.characterId === 'orangie' ? [{ id: 'c8', deck: 'chance' }, { id: 'h5', deck: 'chest' }] : [],
      hopUses: seat.characterId === 'tutu' ? 2 : 0,
      bankrupt: false,
      connected: seat.connected,
    })),
    order: seats.map((s) => s.id),
    currentId: seats[0]!.id,
    phase: 'pre-roll',
    extraRoll: false,
    pendingExtra: false,
    doublesStreak: 0,
    plots: SPACES.map(() => ({ ownerId: null, houses: 0, mortgaged: false })),
    chance: shuffle(CHANCE_IDS, rand),
    chanceDiscard: [],
    chest: shuffle(CHEST_IDS, rand),
    chestDiscard: [],
    houses: 32,
    hotels: 12,
    pot: 0,
    lastDice: null,
    lastCard: null,
    landingMod: null,
    stack: [],
    auction: null,
    trade: null,
    log: [],
    logSeq: 0,
    winnerId: null,
    rules: { ...structuredClone(rules), mapId: rules.mapId ?? 'china' },
    debugDice: [],
    cardChain: 0,
    buySpaceId: null,
  }
  if (state.players.some((p) => p.characterId === 'orangie')) {
    state.chance = state.chance.filter((id) => id !== 'c8')
    state.chest = state.chest.filter((id) => id !== 'h5')
  }
  const names = state.players.map((p) => p.name).join('、')
  const namesEn = state.players.map((p) => p.name).join(', ')
  log(state, `游戏开始！行动顺序：${names}。由 ${state.players[0]?.name} 先行。`, `The game starts. Order: ${namesEn}. ${state.players[0]?.name} goes first.`)
  return state
}

export function apply(
  state: GameState,
  playerId: string,
  action: Action,
  rand: () => number = Math.random,
): ApplyResult {
  const next = structuredClone(state)
  const events: GameEvent[] = []
  cashEvents.set(next, events)
  try {
    dispatch(next, playerId, action, events, rand)
    return { ok: true, state: next, events }
  } catch (error) {
    if (error instanceof RuleError) return { ok: false, state, events: [], error: error.message }
    throw error
  } finally {
    cashEvents.delete(next)
  }
}

export function ejectPlayer(state: GameState, playerId: string, rand: () => number = Math.random): ApplyResult {
  const next = structuredClone(state)
  const events: GameEvent[] = []
  const player = next.players.find((p) => p.id === playerId)
  if (!player || player.bankrupt) return { ok: true, state: next, events }
  cashEvents.set(next, events)
  try {
    next.stack = next.stack.filter((step) => !(step.type === 'debt' && step.playerId === playerId))
    liquidate(next, playerId, BANK)
    if (next.phase === 'buy' && next.currentId === playerId) {
      next.buySpaceId = null
      next.phase = 'resolving'
    }
    continueAfterRemoval(next, playerId, events, rand)
    return { ok: true, state: next, events }
  } finally {
    cashEvents.delete(next)
  }
}
