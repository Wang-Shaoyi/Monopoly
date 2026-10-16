import { RAILROAD_IDS, SPACES, UTILITY_IDS, isDeed, spacesInGroup } from './board.ts'
import type { GameState, GroupId, Space } from './types.ts'

export function isTradeWindow(game: GameState): boolean {
  return game.phase === 'post-roll' && !game.extraRoll
}

export function purchasePrice(state: GameState, playerId: string, spaceId: number): number {
  const space = SPACES[spaceId]
  if (!space?.price) return 0
  const buyer = state.players.find((p) => p.id === playerId)
  if (buyer?.characterId !== 'ginger' || !space.group) return space.price
  const prices = spacesInGroup(space.group).map((s) => s.price!)
  return space.price === Math.max(...prices) ? Math.min(...prices) : space.price
}

export function rentForPlayer(state: GameState, spaceId: number, diceSum: number, playerId: string): number {
  const rent = computeRent(state, spaceId, diceSum)
  const payer = state.players.find((p) => p.id === playerId)
  return payer?.characterId === 'erchai' && state.plots[spaceId]?.houses === 5
    ? Math.ceil(rent * 0.7) : rent
}

export function interestOf(mortgage: number): number {
  return Math.ceil(mortgage / 10)
}

export function unmortgageCost(space: Space): number {
  return (space.mortgage || 0) + interestOf(space.mortgage || 0)
}

export function nearestAhead(from: number, targets: number[]): number {
  let best = targets[0] ?? from
  let dist = 99
  for (const target of targets) {
    const d = (target - from + 40) % 40
    if (d === 0) continue
    if (d < dist) {
      dist = d
      best = target
    }
  }
  return best
}

export function ownsFullGroup(state: GameState, playerId: string, group: GroupId): boolean {
  return spacesInGroup(group).every((s) => state.plots[s.id]?.ownerId === playerId)
}

export function groupHasMortgage(state: GameState, group: GroupId): boolean {
  return spacesInGroup(group).some((s) => state.plots[s.id]?.mortgaged)
}

export function groupHouseTotal(state: GameState, group: GroupId): number {
  return spacesInGroup(group).reduce((sum, s) => sum + (state.plots[s.id]?.houses || 0), 0)
}

/** 同色组全部在手，且没有一块被抵押，空地租金才加倍。 */
export function rentMonopoly(state: GameState, playerId: string, group: GroupId): boolean {
  return ownsFullGroup(state, playerId, group) && !groupHasMortgage(state, group)
}

export function computeRent(state: GameState, spaceId: number, diceSum: number): number {
  const space = SPACES[spaceId]
  const plot = state.plots[spaceId]
  if (!space || !plot?.ownerId || plot.mortgaged) return 0
  if (space.type === 'railroad') {
    const owned = RAILROAD_IDS.filter((id) => state.plots[id]?.ownerId === plot.ownerId).length
    return 25 * 2 ** Math.max(0, owned - 1)
  }
  if (space.type === 'utility') {
    const owned = UTILITY_IDS.filter((id) => state.plots[id]?.ownerId === plot.ownerId).length
    return (owned >= 2 ? 10 : 4) * diceSum
  }
  if (space.type !== 'property' || !space.rent || !space.group) return 0
  if (plot.houses > 0) return space.rent[plot.houses] ?? 0
  const doubled = rentMonopoly(state, plot.ownerId, space.group)
  return space.rent[0] * (doubled ? 2 : 1)
}

function player(state: GameState, id: string) {
  return state.players.find((p) => p.id === id)
}

export function buildIssue(state: GameState, playerId: string, spaceId: number): string | null {
  const space = SPACES[spaceId]
  const plot = state.plots[spaceId]
  const who = player(state, playerId)
  if (!space || !plot || !who) return '找不到该地块'
  if (space.type !== 'property' || !space.group || !space.houseCost) return '该地块无法建造房屋'
  if (plot.ownerId !== playerId) return '该房产不属于你'
  if (who.bankrupt) return '你已经破产了'
  if (!ownsFullGroup(state, playerId, space.group)) return '请先集齐该颜色组的所有房产'
  if (groupHasMortgage(state, space.group)) return '同组有房产已抵押，请先全部赎回'
  if (plot.houses >= 5) return '该地块已建有旅馆'
  const counts = spacesInGroup(space.group).map((s) => state.plots[s.id]?.houses ?? 0)
  const min = Math.min(...counts)
  if (plot.houses !== min) return '请先在同组房屋较少的地块建造'
  if (who.money < space.houseCost) return '现金不够'
  if (plot.houses === 4) {
    if (state.hotels < 1) return '银行已无可用旅馆'
  } else if (state.houses < 1) return '银行已无可用房屋'
  return null
}

export function sellIssue(state: GameState, playerId: string, spaceId: number): string | null {
  const space = SPACES[spaceId]
  const plot = state.plots[spaceId]
  if (!space || !plot) return '找不到该地块'
  if (space.type !== 'property' || !space.group) return '该地块没有可出售的建筑'
  if (plot.ownerId !== playerId) return '该房产不属于你'
  if (plot.houses <= 0) return '没有可出售的建筑'
  const counts = spacesInGroup(space.group).map((s) => state.plots[s.id]?.houses ?? 0)
  const max = Math.max(...counts)
  if (plot.houses !== max) return '请先出售同组房屋较多地块上的建筑'
  if (plot.houses === 5 && state.houses < 4) return '银行房屋不足，暂时无法将旅馆换回四栋房屋'
  return null
}

export function mortgageIssue(state: GameState, playerId: string, spaceId: number): string | null {
  const space = SPACES[spaceId]
  const plot = state.plots[spaceId]
  if (!space || !plot) return '找不到该地块'
  if (!isDeed(space) || !space.mortgage) return '该地块无法抵押'
  if (plot.ownerId !== playerId) return '该房产不属于你'
  if (plot.mortgaged) return '该房产已抵押'
  if (space.group && groupHouseTotal(state, space.group) > 0) return '请先出售该颜色组的所有建筑'
  return null
}

export function unmortgageIssue(state: GameState, playerId: string, spaceId: number): string | null {
  const space = SPACES[spaceId]
  const plot = state.plots[spaceId]
  const who = player(state, playerId)
  if (!space || !plot || !who) return '找不到该地块'
  if (plot.ownerId !== playerId) return '该房产不属于你'
  if (!plot.mortgaged) return '该房产未抵押'
  if (who.money < unmortgageCost(space)) return '现金不足，无法赎回房产'
  return null
}

export function topDebt(state: GameState) {
  const step = state.stack[0]
  if (state.phase === 'debt' && step?.type === 'debt') return step
  return null
}
