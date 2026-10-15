import assert from 'node:assert/strict'
import { CARD_LIST } from '../../shared/cards.ts'
import { SPACES } from '../../shared/board.ts'
import { DEFAULT_RULES, type Action, type GameState } from '../../shared/types.ts'
import { apply, createGame } from './engine.ts'

const seats = [
  { id: 'a', name: 'Ada', characterId: 'ada' as const, connected: true },
  { id: 'b', name: 'Tutu', characterId: 'tutu' as const, connected: true },
]

function boot() {
  return createGame(seats, DEFAULT_RULES, () => 0.25)
}

function ok(state: GameState, id: string, action: Action) {
  const result = apply(state, id, action, () => 0.25)
  if (!result.ok) throw new Error(result.error)
  return result.state
}

function fail(state: GameState, id: string, action: Action) {
  const result = apply(state, id, action, () => 0.25)
  assert.equal(result.ok, false)
  return result.error
}

let passed = 0
function test(name: string, fn: () => void) {
  fn()
  passed += 1
  console.log('ok', name)
}

test('棋盘和牌堆是完整的', () => {
  assert.equal(SPACES.length, 40)
  SPACES.forEach((space, index) => assert.equal(space.id, index))
  assert.equal(CARD_LIST.filter((c) => c.deck === 'chance').length, 16)
  assert.equal(CARD_LIST.filter((c) => c.deck === 'chest').length, 16)
  assert.equal(new Set(CARD_LIST.map((c) => c.id)).size, 32)
})

test('同色组空地收双倍租金，经过起点领薪', () => {
  let state = boot()
  state = ok(state, 'a', { type: 'debug-own', spaceIds: [1, 3] })
  state = ok(state, 'a', { type: 'debug-end' })
  state = ok(state, 'b', { type: 'debug-place', position: 39 })
  state = ok(state, 'b', { type: 'debug-roll', dice: [1, 1] })
  const ada = state.players.find((p) => p.id === 'a')!
  const tutu = state.players.find((p) => p.id === 'b')!
  assert.equal(tutu.position, 1)
  assert.equal(tutu.money, 1500 + 200 - 4)
  assert.equal(ada.money, 1504)
  assert.equal(state.extraRoll, true)
})

test('盖房子必须均匀', () => {
  let state = boot()
  state = ok(state, 'a', { type: 'debug-money', amount: 5000 })
  state = ok(state, 'a', { type: 'debug-own', spaceIds: [1] })
  assert.match(fail(state, 'a', { type: 'build', spaceId: 1 }) || '', /集齐/)
  state = ok(state, 'a', { type: 'debug-own', spaceIds: [1, 3] })
  state = ok(state, 'a', { type: 'build', spaceId: 1 })
  assert.equal(state.plots[1]!.houses, 1)
  assert.match(fail(state, 'a', { type: 'build', spaceId: 1 }) || '', /同组/)
  state = ok(state, 'a', { type: 'build', spaceId: 3 })
  assert.equal(state.plots[3]!.houses, 1)
})

test('放弃购买后可以拍卖', () => {
  let state = boot()
  state = ok(state, 'a', { type: 'debug-place', position: 39 })
  state = ok(state, 'a', { type: 'debug-roll', dice: [1, 1] })
  assert.equal(state.phase, 'buy')
  state = ok(state, 'a', { type: 'decline' })
  assert.equal(state.phase, 'auction')
  assert.equal(state.auction?.turnId, 'b')
  state = ok(state, 'b', { type: 'bid', amount: 50 })
  state = ok(state, 'a', { type: 'pass' })
  assert.equal(state.plots[1]!.ownerId, 'b')
  assert.equal(state.players.find((p) => p.id === 'b')!.money, 1450)
})

test('连续三次双骰进监狱', () => {
  let state = boot()
  state = ok(state, 'a', { type: 'debug-place', position: 18 })
  state = ok(state, 'a', { type: 'debug-roll', dice: [1, 1] })
  state = ok(state, 'a', { type: 'debug-place', position: 18 })
  state = ok(state, 'a', { type: 'debug-roll', dice: [2, 2] })
  state = ok(state, 'a', { type: 'debug-place', position: 18 })
  state = ok(state, 'a', { type: 'debug-roll', dice: [3, 3] })
  const ada = state.players.find((p) => p.id === 'a')!
  assert.equal(ada.inJail, true)
  assert.equal(ada.position, 10)
  assert.equal(state.currentId, 'b')
  assert.equal(state.phase, 'pre-roll')
})

test('没轮到的人不能掷骰', () => {
  const state = boot()
  assert.match(fail(state, 'b', { type: 'roll' }) || '', /轮到/)
})

test('付不起税就进入筹款', () => {
  let state = boot()
  state = ok(state, 'a', { type: 'debug-money', amount: 0 })
  state = ok(state, 'a', { type: 'debug-place', position: 2 })
  state = ok(state, 'a', { type: 'debug-roll', dice: [1, 1] })
  assert.equal(state.phase, 'debt')
  assert.equal(state.stack[0]?.type, 'debt')
  if (state.stack[0]?.type === 'debt') assert.equal(state.stack[0].amount, 200)
  state = ok(state, 'a', { type: 'debug-money', amount: 200 })
  state = ok(state, 'a', { type: 'pay-debt' })
  assert.equal(state.players.find((p) => p.id === 'a')!.money, 0)
  assert.notEqual(state.phase, 'debt')
})

console.log(`\n${passed} tests passed`)
