import { CARDS, CHANCE_IDS, CHEST_IDS } from '../../shared/cards.ts'
import { RAILROAD_IDS, SPACES, UTILITY_IDS, isDeed } from '../../shared/board.ts'
import {
  buildIssue,
  computeRent,
  interestOf,
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

function log(state: GameState, text: string) {
  state.logSeq += 1
  state.log.push({ id: state.logSeq, text, at: Date.now() })
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
    log(state, left[0] ? `${left[0].name} 赢了` : '这局结束了')
    return true
  }
  return false
}

function enterIdle(state: GameState) {
  if (maybeWin(state)) return
  if (state.phase === 'pre-roll' || state.phase === 'buy' || state.phase === 'auction' || state.phase === 'debt' || state.phase === 'ended') {
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
  log(state, `${player.name} 进监狱了`)
}

function pay(state: GameState, fromId: string, amount: number, creditor: Creditor, reason: string) {
  const from = must(state, fromId)
  from.money -= amount
  if (creditor.type === 'bank') {
    if (state.rules.freeParking && amount > 0) {
      state.pot += amount
      log(state, `${from.name} 付了${reason} $${amount}，放进停车奖金（现在 $${state.pot}）`)
    } else {
      log(state, `${from.name} 付了${reason} $${amount}`)
    }
    return
  }
  const to = must(state, creditor.id)
  to.money += amount
  log(state, `${from.name} 给 ${to.name} 付了${reason} $${amount}`)
}

function debt(playerId: string, amount: number, creditor: Creditor, reason: string): DebtStep {
  return { type: 'debt', playerId, amount, creditor, reason }
}

function stepsForCard(state: GameState, playerId: string, card: Card): Step[] {
  const me = must(state, playerId)
  const effect = card.effect
  switch (effect.type) {
    case 'money':
      if (effect.amount >= 0) return [{ type: 'collect', playerId, amount: effect.amount, reason: '牌上的钱' }]
      return [debt(playerId, -effect.amount, BANK, '牌上的账')]
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
      return [debt(playerId, amount, BANK, '修房子')]
    }
    case 'pay-each':
      return others(state, playerId).map((p) => debt(playerId, effect.amount, { type: 'player', id: p.id }, '分给别人'))
    case 'collect-each':
      return others(state, playerId).map((p) => debt(p.id, effect.amount, { type: 'player', id: playerId }, '给抽牌的人'))
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

function perform(state: GameState, step: Step, events: GameEvent[], rand: () => number): boolean {
  const player = must(state, state.currentId)
  switch (step.type) {
    case 'forward': {
      const path: number[] = []
      for (let i = 0; i < step.steps; i++) {
        player.position = (player.position + 1) % 40
        path.push(player.position)
        if (step.collectGo && player.position === 0) {
          player.money += state.rules.salary
          log(state, `${player.name} 经过起点，领了 $${state.rules.salary}`)
        }
      }
      if (path.length) events.push({ type: 'move', playerId: player.id, path })
      return false
    }
    case 'advance': {
      const path: number[] = []
      let guard = 0
      while (player.position !== step.target && guard++ < 40) {
        player.position = (player.position + 1) % 40
        path.push(player.position)
        if (step.collectGo && player.position === 0) {
          player.money += state.rules.salary
          log(state, `${player.name} 经过起点，领了 $${state.rules.salary}`)
        }
      }
      if (path.length) events.push({ type: 'move', playerId: player.id, path })
      return false
    }
    case 'back': {
      const path: number[] = []
      for (let i = 0; i < step.steps; i++) {
        player.position = (player.position + 39) % 40
        path.push(player.position)
      }
      if (path.length) events.push({ type: 'move', playerId: player.id, path })
      return false
    }
    case 'resolve-space':
      return resolveSpace(state, events, rand)
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
      state.currentId = id
      state.doublesStreak = 0
      state.pendingExtra = false
      state.extraRoll = false
      state.cardChain = 0
      state.phase = 'pre-roll'
      log(state, `轮到 ${must(state, id).name}`)
      return true
    }
    case 'free-from-jail':
      player.inJail = false
      player.jailTurns = 0
      state.phase = 'pre-roll'
      state.extraRoll = false
      log(state, `${player.name} 出狱了，可以走了`)
      return true
    case 'release-jail':
      player.inJail = false
      player.jailTurns = 0
      return false
    case 'collect': {
      const who = must(state, step.playerId)
      who.money += step.amount
      log(state, `${who.name} 拿到 $${step.amount}（${step.reason}）`)
      return false
    }
    default:
      return false
  }
}

function resolveSpace(state: GameState, events: GameEvent[], rand: () => number): boolean {
  const player = must(state, state.currentId)
  const space = SPACES[player.position]
  assert(space, '走偏了')
  const mod = state.landingMod
  state.landingMod = null
  log(state, `${player.name} 停在 ${space.name}`)

  if (space.type === 'go' || space.type === 'jail') {
    if (space.type === 'jail') log(state, `${player.name} 只是路过`)
    return false
  }
  if (space.type === 'parking') {
    if (state.rules.freeParking && state.pot > 0) {
      player.money += state.pot
      log(state, `${player.name} 把停车奖金 $${state.pot} 拿走了`)
      state.pot = 0
    } else {
      log(state, `${player.name} 在停车格歇了歇`)
    }
    return false
  }
  if (space.type === 'tax') {
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
  assert(plot, '地块丢失')
  if (!plot.ownerId) {
    state.buySpaceId = space.id
    state.phase = 'buy'
    log(state, `${space.name} 还没人买`)
    return true
  }
  if (plot.ownerId === player.id) {
    log(state, `${player.name} 走到了自己的地`)
    return false
  }
  if (plot.mortgaged) {
    log(state, `${space.name} 押着，这趟不收租`)
    return false
  }

  let rent = 0
  if (mod === 'utility10' && space.type === 'utility') {
    const dice = rollDice(state, rand)
    state.lastDice = dice
    events.push({ type: 'dice', playerId: player.id, dice })
    rent = (dice[0] + dice[1]) * 10
    log(state, `两家公用都在手里，按骰子的十倍收租。掷出 ${dice[0]} 和 ${dice[1]}`)
  } else {
    const diceSum = state.lastDice ? state.lastDice[0] + state.lastDice[1] : 7
    rent = computeRent(state, space.id, diceSum)
    if (mod === 'rail2') rent *= 2
  }
  if (rent > 0) {
    state.stack.unshift(debt(player.id, rent, { type: 'player', id: plot.ownerId }, `${space.name}租金`))
  }
  return false
}

function drawCard(state: GameState, deck: 'chance' | 'chest', events: GameEvent[], rand: () => number): boolean {
  if (state.cardChain >= 8) {
    log(state, '牌抽太勤，这张先跳过')
    return false
  }
  state.cardChain += 1
  const id = drawFrom(state, deck, rand)
  if (!id) {
    log(state, deck === 'chance' ? '机会牌摸完了' : '公益牌摸完了')
    return false
  }
  const card = CARDS[id]
  assert(card, '牌面丢失')
  const player = must(state, state.currentId)
  state.lastCard = { id: card.id, deck: card.deck, text: card.text }
  events.push({ type: 'card', playerId: player.id, deck: card.deck, text: card.text })
  log(state, `${player.name} 抽到：${card.text}`)
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
      log(state, `${who.name} 要付 $${step.amount}（${step.reason}）。先凑钱，或者破产`)
      return
    }
    state.stack.shift()
    if (perform(state, step, events, rand)) return
  }
  if (guard >= 48) {
    log(state, '这一步太长，先停一下')
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
  const space = SPACES[spaceId]
  if (!space?.group) return true
  return state.plots.every((plot, id) => {
    if (SPACES[id]?.group !== space.group) return true
    return plot.houses === 0
  })
}

function finishAuction(state: GameState) {
  const auction = state.auction
  state.auction = null
  state.buySpaceId = null
  if (auction?.highBidderId && auction.highBid > 0) {
    const winner = must(state, auction.highBidderId)
    const name = SPACES[auction.spaceId]?.name ?? '这块地'
    if (winner.bankrupt || winner.money < auction.highBid) {
      log(state, `${winner.name} 付不起 $${auction.highBid}，${name} 流拍了`)
    } else {
      winner.money -= auction.highBid
      const plot = state.plots[auction.spaceId]
      if (plot) plot.ownerId = winner.id
      log(state, `${winner.name} 以 $${auction.highBid} 拍下${name}`)
    }
  } else if (auction) {
    log(state, `${SPACES[auction.spaceId]?.name ?? '这块地'} 流拍了`)
  }
  if (state.phase !== 'ended') state.phase = 'resolving'
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
    if (auction.passed.includes(id)) continue
    const bidder = must(state, id)
    if (bidder.money < auction.highBid + 1) {
      auction.passed.push(id)
      log(state, `${bidder.name} 钱不够，喊不了这个价`)
      continue
    }
    auction.turnId = id
    return true
  }
  return false
}

function startAuction(state: GameState) {
  const spaceId = state.buySpaceId
  assert(spaceId !== null, '没有在拍卖的地')
  state.auction = {
    spaceId,
    highBid: 0,
    highBidderId: null,
    turnId: state.currentId,
    passed: [],
  }
  state.phase = 'auction'
  log(state, `${SPACES[spaceId]?.name ?? '这块地'} 开始拍卖`)
  if (!setNextBidder(state)) finishAuction(state)
}

function sanitizeAuction(state: GameState) {
  const auction = state.auction
  if (!auction) return
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
    creditorPlayer.money += debtor.money
    debtor.money = 0
    let due = 0
    for (let i = 0; i < 40; i++) {
      const plot = state.plots[i]
      if (!plot || plot.ownerId !== debtorId) continue
      plot.ownerId = creditorPlayer.id
      if (plot.mortgaged) due += interestOf(SPACES[i]?.mortgage || 0)
    }
    creditorPlayer.heldCards.push(...debtor.heldCards)
    debtor.heldCards = []
    if (due > 0 && creditorPlayer.money >= due) {
      creditorPlayer.money -= due
      if (state.rules.freeParking) state.pot += due
      log(state, `${creditorPlayer.name} 付了抵押利息 $${due}`)
    } else if (due > 0) {
      log(state, `${creditorPlayer.name} 钱不够付利息，这些地先押着`)
    }
    log(state, `${debtor.name} 破产了，剩下的东西归 ${creditorPlayer.name}`)
  } else {
    debtor.money = 0
    for (let i = 0; i < 40; i++) {
      const plot = state.plots[i]
      if (!plot || plot.ownerId !== debtorId) continue
      plot.ownerId = null
      plot.mortgaged = false
    }
    for (const card of debtor.heldCards) {
      const discard = card.deck === 'chance' ? state.chanceDiscard : state.chestDiscard
      discard.push(card.id)
    }
    debtor.heldCards = []
    log(state, `${debtor.name} 破产了，家当归银行`)
  }
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
  if (state.phase === 'auction' || state.phase === 'buy' || state.phase === 'pre-roll' || state.phase === 'post-roll') return
  state.phase = 'resolving'
  runStack(state, events, rand)
}

function declareBankrupt(state: GameState, debtorId: string, events: GameEvent[], rand: () => number) {
  const step = state.stack[0]
  assert(state.phase === 'debt' && step?.type === 'debt' && step.playerId === debtorId, '现在还不用破产')
  state.stack.shift()
  liquidate(state, debtorId, step.creditor)
  continueAfterRemoval(state, debtorId, events, rand)
}

function groupBuildings(state: GameState, spaceId: number): number {
  const group = SPACES[spaceId]?.group
  if (!group) return state.plots[spaceId]?.houses ?? 0
  return state.plots.reduce((sum, plot, id) => (SPACES[id]?.group === group ? sum + plot.houses : sum), 0)
}

function takeCards(who: GamePlayer, ids: string[]): HeldCard[] {
  const taken: HeldCard[] = []
  for (const id of ids) {
    const index = who.heldCards.findIndex((card) => card.id === id)
    assert(index >= 0, '免罪卡已经不在了')
    taken.push(who.heldCards.splice(index, 1)[0]!)
  }
  return taken
}

function acceptTrade(state: GameState) {
  const trade = state.trade
  assert(trade, '没有要处理的交换')
  const from = must(state, trade.from)
  const to = must(state, trade.to)
  assert(!from.bankrupt && !to.bankrupt, '有人破产了，这单换不成')
  const offerMoney = trade.offer.money
  const wantMoney = trade.want.money
  assert(offerMoney >= 0 && wantMoney >= 0, '钱数不对')
  for (const id of [...trade.offer.spaceIds, ...trade.want.spaceIds]) {
    assert(ownedGroupClear(state, id) && groupBuildings(state, id) === 0, '带房子的一组地要先全部卖掉才能交换')
  }
  let interestForTo = 0
  let interestForFrom = 0
  for (const id of trade.offer.spaceIds) {
    const plot = state.plots[id]
    assert(plot?.ownerId === from.id, '这地已经不是对方的了')
    if (plot.mortgaged) interestForTo += interestOf(SPACES[id]?.mortgage || 0)
  }
  for (const id of trade.want.spaceIds) {
    const plot = state.plots[id]
    assert(plot?.ownerId === to.id, '这地已经不是你的了')
    if (plot.mortgaged) interestForFrom += interestOf(SPACES[id]?.mortgage || 0)
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
  assert(!empty, '空手换不了')

  const offerCards = takeCards(from, trade.offer.cardIds)
  const wantCards = takeCards(to, trade.want.cardIds)
  from.money = from.money - offerMoney + wantMoney - interestForFrom
  to.money = to.money - wantMoney + offerMoney - interestForTo
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
  log(state, `${from.name} 和 ${to.name} 换完了`)
}

function moneyOk(phase: Phase, kind: 'build' | 'sell' | 'mortgage' | 'unmortgage', playerId: string, state: GameState) {
  if (state.phase === 'debt') {
    const owing = state.stack[0]
    assert(owing?.type === 'debt' && owing.playerId === playerId, '现在只有欠钱的人能卖东西')
    assert(kind === 'sell' || kind === 'mortgage', '欠钱的时候只能卖房或抵押')
    return
  }
  if (state.phase === 'auction') {
    assert(kind !== 'build', '拍卖的时候不能盖房')
    assert(!must(state, playerId).bankrupt, '你已经破产了')
    return
  }
  assert(canManage(phase), '现在不能动这些')
  assertCurrent(state, playerId)
}

function actionRoll(state: GameState, playerId: string, events: GameEvent[], rand: () => number, fromJail = false) {
  assertCurrent(state, playerId)
  const player = must(state, playerId)
  if (fromJail) {
    assert(state.phase === 'pre-roll' && player.inJail, '现在出不去')
  } else {
    assert(!player.inJail, '你还在监狱里，先出来')
    const again = state.phase === 'post-roll' && state.extraRoll
    assert(state.phase === 'pre-roll' || again, '现在不能掷')
    assert(!state.trade, '先把交换处理完')
  }
  state.cardChain = 0
  const dice = rollDice(state, rand)
  state.lastDice = dice
  events.push({ type: 'dice', playerId, dice })
  const doubles = dice[0] === dice[1]
  log(state, `${player.name} 掷出 ${dice[0]} 和 ${dice[1]}`)

  if (fromJail) {
    const forced = player.jailTurns >= 2
    if (doubles || forced) {
      state.pendingExtra = false
      state.doublesStreak = 0
      const steps: Step[] = []
      if (!doubles) steps.push(debt(player.id, 50, BANK, '第三次出狱'))
      steps.push({ type: 'release-jail' }, { type: 'forward', steps: dice[0] + dice[1], collectGo: true }, { type: 'resolve-space' })
      if (doubles) log(state, `${player.name} 掷出双骰，出狱了`)
      else log(state, `${player.name} 第三次还是没出双骰，付 $50 再走`)
      state.phase = 'resolving'
      state.stack.unshift(...steps)
      runStack(state, events, rand)
      return
    }
    player.jailTurns += 1
    log(state, `${player.name} 没出双骰，还得待着（第 ${player.jailTurns} 次）`)
    state.phase = 'resolving'
    state.stack.unshift({ type: 'next-turn' })
    runStack(state, events, rand)
    return
  }

  if (doubles) {
    state.doublesStreak += 1
    if (state.doublesStreak >= 3) {
      log(state, `${player.name} 连续三次双骰，进监狱`)
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
  assert(state.players.some((p) => p.id === playerId), '你不在这局里')
  switch (action.type) {
    case 'debug-place':
      must(state, playerId).position = ((action.position % 40) + 40) % 40
      return
    case 'debug-own':
      for (const id of action.spaceIds) {
        const plot = state.plots[id]
        assert(plot && isDeed(SPACES[id]!), '这块地拿不到')
        plot.ownerId = playerId
        plot.mortgaged = false
        plot.houses = 0
      }
      return
    case 'debug-money':
      must(state, playerId).money = action.amount
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
    case 'roll':
      actionRoll(state, playerId, events, rand)
      return
    case 'jail-roll':
      actionRoll(state, playerId, events, rand, true)
      return
    case 'jail-pay': {
      assertCurrent(state, playerId)
      const player = must(state, playerId)
      assert(state.phase === 'pre-roll' && player.inJail, '现在不用交出狱的钱')
      state.phase = 'resolving'
      state.stack.unshift(debt(player.id, 50, BANK, '付费出狱'), { type: 'free-from-jail' })
      runStack(state, events, rand)
      return
    }
    case 'jail-card': {
      assertCurrent(state, playerId)
      const player = must(state, playerId)
      assert(state.phase === 'pre-roll' && player.inJail, '现在用不上免罪卡')
      const index = action.deck
        ? player.heldCards.findIndex((card) => card.deck === action.deck)
        : player.heldCards.length - 1
      assert(index >= 0, '你没有免罪卡')
      const [card] = player.heldCards.splice(index, 1)
      assert(card, '你没有免罪卡')
      const discard = card.deck === 'chance' ? state.chanceDiscard : state.chestDiscard
      discard.push(card.id)
      player.inJail = false
      player.jailTurns = 0
      state.phase = 'pre-roll'
      log(state, `${player.name} 用免罪卡出狱了`)
      return
    }
    case 'buy': {
      assertCurrent(state, playerId)
      assert(state.phase === 'buy' && state.buySpaceId !== null, '现在没有地可买')
      const space = SPACES[state.buySpaceId]!
      const plot = state.plots[state.buySpaceId]!
      const player = must(state, playerId)
      assert(isDeed(space) && space.price, '这块地不能买')
      assert(!plot.ownerId, '已经有人买了')
      assert(player.money >= space.price, '钱不够，可以先抵押再买')
      player.money -= space.price
      plot.ownerId = player.id
      plot.houses = 0
      plot.mortgaged = false
      log(state, `${player.name} 以 $${space.price} 买下${space.name}`)
      state.buySpaceId = null
      state.phase = 'resolving'
      runStack(state, events, rand)
      return
    }
    case 'decline': {
      assertCurrent(state, playerId)
      assert(state.phase === 'buy', '现在不用决定买不买')
      const name = SPACES[state.buySpaceId ?? -1]?.name ?? '这块地'
      if (state.rules.auction) {
        log(state, `${must(state, playerId).name} 不买 ${name}，拿去拍卖`)
        startAuction(state)
        if (!state.auction) {
          state.phase = 'resolving'
          runStack(state, events, rand)
        }
        return
      }
      log(state, `${must(state, playerId).name} 放过了 ${name}`)
      state.buySpaceId = null
      state.phase = 'resolving'
      runStack(state, events, rand)
      return
    }
    case 'bid': {
      const auction = state.auction
      assert(state.phase === 'auction' && auction, '现在没有拍卖')
      assert(auction.turnId === playerId, '还没轮到你出价')
      const amount = Math.floor(Number(action.amount))
      assert(Number.isInteger(amount) && amount > auction.highBid, '得比现在的价高')
      const bidder = must(state, playerId)
      assert(bidder.money >= amount, '你的钱不够这个价')
      auction.highBid = amount
      auction.highBidderId = playerId
      auction.passed = []
      auction.turnId = playerId
      log(state, `${bidder.name} 出价 $${amount}`)
      if (!setNextBidder(state)) {
        finishAuction(state)
        runStack(state, events, rand)
      }
      return
    }
    case 'pass': {
      const auction = state.auction
      assert(state.phase === 'auction' && auction, '现在没有拍卖')
      const actor = auction.turnId === playerId || !must(state, auction.turnId).connected ? auction.turnId : ''
      assert(actor, '还没轮到你放弃')
      if (auction.turnId !== playerId) assert(!must(state, auction.turnId).connected, '对方还在线')
      auction.passed.push(auction.turnId)
      log(state, `${must(state, auction.turnId).name} 不喊了`)
      if (!setNextBidder(state)) {
        finishAuction(state)
        runStack(state, events, rand)
      }
      return
    }
    case 'end-turn': {
      assertCurrent(state, playerId)
      assert(state.phase === 'post-roll' && !state.extraRoll, '这回合还不能结束')
      assert(!state.trade, '先把交换处理完')
      state.phase = 'resolving'
      state.stack.unshift({ type: 'next-turn' })
      runStack(state, events, rand)
      return
    }
    case 'build': {
      moneyOk(state.phase, 'build', playerId, state)
      const issue = buildIssue(state, playerId, action.spaceId)
      assert(!issue, issue || '不能建造')
      const space = SPACES[action.spaceId]!
      const plot = state.plots[action.spaceId]!
      const who = must(state, playerId)
      who.money -= space.houseCost!
      if (plot.houses === 4) {
        state.hotels -= 1
        state.houses += 4
        plot.houses = 5
        log(state, `${who.name} 在${space.name} 盖了旅馆`)
      } else {
        state.houses -= 1
        plot.houses += 1
        log(state, `${who.name} 在${space.name} 盖了一栋房子`)
      }
      return
    }
    case 'sell': {
      moneyOk(state.phase, 'sell', playerId, state)
      const issue = sellIssue(state, playerId, action.spaceId)
      assert(!issue, issue || '不能出售')
      const space = SPACES[action.spaceId]!
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
      who.money += refund
      log(state, `${who.name} 卖掉 ${space.name} 的一栋，拿回 $${refund}`)
      return
    }
    case 'mortgage': {
      moneyOk(state.phase, 'mortgage', playerId, state)
      const issue = mortgageIssue(state, playerId, action.spaceId)
      assert(!issue, issue || '不能抵押')
      const space = SPACES[action.spaceId]!
      const plot = state.plots[action.spaceId]!
      plot.mortgaged = true
      must(state, playerId).money += space.mortgage || 0
      log(state, `${must(state, playerId).name} 把 ${space.name} 押了，拿到 $${space.mortgage}`)
      return
    }
    case 'unmortgage': {
      moneyOk(state.phase, 'unmortgage', playerId, state)
      const issue = unmortgageIssue(state, playerId, action.spaceId)
      assert(!issue, issue || '不能赎回')
      const space = SPACES[action.spaceId]!
      const plot = state.plots[action.spaceId]!
      const cost = unmortgageCost(space)
      const who = must(state, playerId)
      if (state.auction?.highBidderId === playerId) {
        assert(who.money - cost >= state.auction.highBid, '赎了就付不起你喊的价')
      }
      who.money -= cost
      plot.mortgaged = false
      if (state.rules.freeParking) state.pot += cost - (space.mortgage || 0)
      log(state, `${must(state, playerId).name} 赎回 ${space.name}，付了 $${cost}`)
      return
    }
    case 'pay-debt': {
      const step = state.stack[0]
      assert(state.phase === 'debt' && step?.type === 'debt' && step.playerId === playerId, '现在没有要你付的账')
      const who = must(state, playerId)
      assert(who.money >= step.amount, '钱还不够')
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
      assert(state.phase === 'pre-roll' || state.phase === 'post-roll', '现在不能换')
      assert(!state.trade, '还有一笔交换没完')
      assert(action.to !== playerId, '不能跟自己换')
      const to = must(state, action.to)
      assert(!to.bankrupt, '对方已经破产了')
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
      log(state, `${must(state, playerId).name} 想跟 ${to.name} 换`)
      return
    }
    case 'cancel-trade':
      assert(state.trade?.from === playerId, '没有你提的交换')
      state.trade = null
      log(state, `${must(state, playerId).name} 把交换收回了`)
      return
    case 'respond-trade':
      assert(state.trade?.to === playerId, '没有给你的交换')
      if (!action.accept) {
        log(state, `${must(state, playerId).name} 拒绝了`)
        state.trade = null
        return
      }
      acceptTrade(state)
      return
    case 'skip-offline': {
      assert(must(state, playerId).connected && !must(state, playerId).bankrupt, '你现在不能代操作')
      if (state.phase === 'buy' && !must(state, state.currentId).connected) {
        dispatch(state, state.currentId, { type: 'decline' }, events, rand)
        return
      }
      if (state.phase === 'auction' && state.auction && !must(state, state.auction.turnId).connected) {
        dispatch(state, playerId, { type: 'pass' }, events, rand)
        return
      }
      if (state.phase === 'debt') {
        const owing = state.stack[0]
        assert(owing?.type === 'debt' && !must(state, owing.playerId).connected, '欠款的人还在线')
        declareBankrupt(state, owing.playerId, events, rand)
        return
      }
      assert(
        (state.phase === 'pre-roll' || state.phase === 'post-roll') && !must(state, state.currentId).connected,
        '当前玩家还在线',
      )
      const skipped = must(state, state.currentId)
      state.trade = null
      state.pendingExtra = false
      if (skipped.inJail && state.phase === 'pre-roll') skipped.jailTurns = Math.min(2, skipped.jailTurns + 1)
      log(state, `${skipped.name} 掉线了，这回合先跳过`)
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
  assert(seats.length >= 1 && seats.length <= 6, '一桌一到六个角色')
  assert(new Set(seats.map((s) => s.characterId)).size === seats.length, '角色不能重复')
  for (const seat of seats) assert(isCharacterId(seat.characterId), '有不认识的角色')
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
      heldCards: [],
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
    rules: structuredClone(rules),
    debugDice: [],
    cardChain: 0,
    buySpaceId: null,
  }
  const names = state.players.map((p) => p.name).join('、')
  log(state, `开局了。顺序是 ${names}，${state.players[0]?.name} 先走。`)
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
  try {
    dispatch(next, playerId, action, events, rand)
    return { ok: true, state: next, events }
  } catch (error) {
    if (error instanceof RuleError) return { ok: false, state, events: [], error: error.message }
    throw error
  }
}

export function ejectPlayer(state: GameState, playerId: string, rand: () => number = Math.random): ApplyResult {
  const next = structuredClone(state)
  const events: GameEvent[] = []
  const player = next.players.find((p) => p.id === playerId)
  if (!player || player.bankrupt) return { ok: true, state: next, events }
  next.stack = next.stack.filter((step) => !(step.type === 'debt' && step.playerId === playerId))
  liquidate(next, playerId, BANK)
  if (next.phase === 'buy' && next.currentId === playerId) {
    next.buySpaceId = null
    next.phase = 'resolving'
  }
  continueAfterRemoval(next, playerId, events, rand)
  return { ok: true, state: next, events }
}
