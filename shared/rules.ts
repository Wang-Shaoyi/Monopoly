import { RAILROAD_IDS, SPACES, UTILITY_IDS, isDeed, spacesInGroup } from './board.ts'
import type { GameState, GroupId, Space } from './types.ts'

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
  if (!space || !plot || !who) return '没有这块地'
  if (space.type !== 'property' || !space.group || !space.houseCost) return '这里不能盖房子'
  if (plot.ownerId !== playerId) return '这不是你的地'
  if (who.bankrupt) return '你已经破产了'
  if (!ownsFullGroup(state, playerId, space.group)) return '要先集齐这一组'
  if (groupHasMortgage(state, space.group)) return '这组还有地押着，先别盖'
  if (plot.houses >= 5) return '已经是旅馆了'
  const counts = spacesInGroup(space.group).map((s) => state.plots[s.id]?.houses ?? 0)
  const min = Math.min(...counts)
  if (plot.houses !== min) return '先给同组房子更少的地盖'
  if (who.money < space.houseCost) return '现金不够'
  if (plot.houses === 4) {
    if (state.hotels < 1) return '银行的旅馆没了'
  } else if (state.houses < 1) return '银行的房子没了'
  return null
}

export function sellIssue(state: GameState, playerId: string, spaceId: number): string | null {
  const space = SPACES[spaceId]
  const plot = state.plots[spaceId]
  if (!space || !plot) return '没有这块地'
  if (space.type !== 'property' || !space.group) return '这上面没房子'
  if (plot.ownerId !== playerId) return '这不是你的地'
  if (plot.houses <= 0) return '没有房子可卖'
  const counts = spacesInGroup(space.group).map((s) => state.plots[s.id]?.houses ?? 0)
  const max = Math.max(...counts)
  if (plot.houses !== max) return '先卖同组房子更多的地'
  if (plot.houses === 5 && state.houses < 4) return '银行房子不够，旅馆先拆不了'
  return null
}

export function mortgageIssue(state: GameState, playerId: string, spaceId: number): string | null {
  const space = SPACES[spaceId]
  const plot = state.plots[spaceId]
  if (!space || !plot) return '没有这块地'
  if (!isDeed(space) || !space.mortgage) return '这格不能抵押'
  if (plot.ownerId !== playerId) return '这不是你的地'
  if (plot.mortgaged) return '已经押过了'
  if (space.group && groupHouseTotal(state, space.group) > 0) return '先把这组的房子卖掉'
  return null
}

export function unmortgageIssue(state: GameState, playerId: string, spaceId: number): string | null {
  const space = SPACES[spaceId]
  const plot = state.plots[spaceId]
  const who = player(state, playerId)
  if (!space || !plot || !who) return '没有这块地'
  if (plot.ownerId !== playerId) return '这不是你的地'
  if (!plot.mortgaged) return '这地没抵押'
  if (who.money < unmortgageCost(space)) return '钱不够赎回'
  return null
}

export function topDebt(state: GameState) {
  const step = state.stack[0]
  if (state.phase === 'debt' && step?.type === 'debt') return step
  return null
}
