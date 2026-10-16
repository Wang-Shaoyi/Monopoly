import { purchasePrice, rentForPlayer } from '../../shared/rules.ts'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { createRoom, joinRoom, setRules, snapshot, selectCharacter, start, commitDraw, initStore, roomByCode } from './store.ts'
import { translate } from '../../shared/phrases.ts'
import assert from 'node:assert/strict'
import { CARD_LIST, cardForMap } from '../../shared/cards.ts'
import { SPACES, spacesForMap, spaceLabel, propertyRegion } from '../../shared/board.ts'
import { DEFAULT_RULES, type Action, type GameState, type CharacterId } from '../../shared/types.ts'
import { apply, arrangeSeats, createGame } from './engine.ts'

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

test('抽签后同一个人的角色会岔开', () => {
  let n = 0
  const rand = () => {
    n += 1
    return (n % 5) / 5
  }
  const table = [
    { id: 'h1:pig', controllerId: 'h1', name: '柴猪 Shibagy', characterId: 'shibagy' as const, connected: true },
    { id: 'h1:bear', controllerId: 'h1', name: '果熊 Ada', characterId: 'ada' as const, connected: true },
    { id: 'h2:chai', controllerId: 'h2', name: '二柴 Erchai', characterId: 'erchai' as const, connected: true },
    { id: 'h2:rabbit', controllerId: 'h2', name: '兔兔 Tutu', characterId: 'tutu' as const, connected: true },
  ]
  const arranged = arrangeSeats(table, rand)
  assert.equal(arranged.seats.length, 4)
  for (let i = 0; i < arranged.seats.length - 1; i++) {
    assert.notEqual(arranged.seats[i]!.controllerId, arranged.seats[i + 1]!.controllerId)
  }
  assert.equal(new Set(arranged.lots.map((lot) => lot.lot)).size, 2)
  assert.deepEqual(arranged.lots.map((lot) => lot.lot).sort(), [1, 2])
})

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
  state = ok(state, 'b', { type: 'skip-hop' })
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


test('两张地图各有中英名称，价格和棋盘规则保持一致', () => {
  const china = spacesForMap('china')
  const usa = spacesForMap('usa')
  assert.equal(spaceLabel(china[39], 'zh'), '上海')
  assert.equal(spaceLabel(china[39], 'en'), 'Shanghai')
  assert.equal(spaceLabel(usa[39], 'zh'), '纽约')
  assert.equal(spaceLabel(usa[39], 'en'), 'New York')
  assert.equal(spaceLabel(usa[37], 'zh'), '华盛顿特区')
  assert.equal(spaceLabel(usa[37], 'en'), 'Washington, D.C.')
  assert.equal(spaceLabel(china[5], 'en'), 'Hefei South Railway Station')
  assert.equal(spaceLabel(usa[5], 'zh'), '达拉斯沃思堡国际机场')
  for (let id = 0; id < 40; id++) {
    const { name, short, en, enShort, ...chinaRules } = china[id]!
    const { name: n, short: sh, en: e, enShort: es, ...usaRules } = usa[id]!
    assert.ok(name && short && en && enShort && n && sh && e && es)
    assert.deepEqual(chinaRules, usaRules)
  }
})

test('所有卡牌的中英地名和交通类型跟随地图，效果不变', () => {
  for (const mapId of ['china', 'usa'] as const) {
    const spaces = spacesForMap(mapId)
    for (const original of CARD_LIST) {
      const card = cardForMap(original.id, mapId)!
      assert.deepEqual(card.effect, original.effect)
      assert.equal(card.id, original.id)
      assert.equal(card.deck, original.deck)
      if (card.effect.type === 'goto' && card.effect.space !== 0) {
        assert.ok(card.text.includes(spaces[card.effect.space]!.name))
        assert.ok(card.en.includes(spaces[card.effect.space]!.enShort))
      }
    }
    assert.ok(cardForMap('c5', mapId)!.text.includes(mapId === 'usa' ? '机场' : '火车站'))
    assert.ok(cardForMap('c6', mapId)!.en.includes(mapId === 'usa' ? 'airport' : 'railway station'))
  }
})

test('购买、拍卖、收租日志使用本局地图的两种语言', () => {
  for (const mapId of ['china', 'usa'] as const) {
    const space = spacesForMap(mapId)[1]!
    let state = createGame(seats, { ...DEFAULT_RULES, mapId }, () => 0.25)
    state = ok(state, 'a', { type: 'debug-place', position: 39 })
    state = ok(state, 'a', { type: 'debug-roll', dice: [1, 1] })
    assert.ok(state.log.some((line) => line.text.includes(space.name) && line.en?.includes(space.en)))
    state = ok(state, 'a', { type: 'decline' })
    state = ok(state, 'b', { type: 'bid', amount: 50 })
    state = ok(state, 'a', { type: 'pass' })
    assert.ok(state.log.some((line) => line.text.includes('拍下' + space.name) && line.en?.includes(space.en)))
    let bought = createGame(seats, { ...DEFAULT_RULES, mapId }, () => 0.25)
    bought = ok(bought, 'a', { type: 'debug-place', position: 39 })
    bought = ok(bought, 'a', { type: 'debug-roll', dice: [1, 1] })
    bought = ok(bought, 'a', { type: 'buy' })
    assert.ok(bought.log.some((line) => line.en?.includes('bought ' + space.en)))
    assert.equal(translate('en', space.name + '租金', mapId), space.en + ' rent')
    state = createGame(seats, { ...DEFAULT_RULES, mapId }, () => 0.25)
    state.plots[1]!.ownerId = 'b'
    state = ok(state, 'a', { type: 'debug-place', position: 39 })
    state = ok(state, 'a', { type: 'debug-roll', dice: [1, 1] })
    assert.ok(state.log.some((line) => line.text.includes(space.name + '租金') && line.en?.includes(space.en + ' rent')))
  }
})

test('抽牌事件、展示和目的地使用同一地图，保存后继续沿用', () => {
  for (const mapId of ['china', 'usa'] as const) {
    let state = createGame(seats, { ...DEFAULT_RULES, mapId }, () => 0.25)
    state.chance = ['c2']
    state = ok(state, 'a', { type: 'debug-place', position: 5 })
    const result = apply(state, 'a', { type: 'debug-roll', dice: [1, 1] }, () => 0.25)
    assert.ok(result.ok)
    state = result.state
    const card = cardForMap('c2', mapId)!
    assert.equal(state.lastCard?.text, card.text)
    assert.equal(state.lastCard?.en, card.en)
    assert.ok(result.events.some((event) => event.type === 'card' && event.text === card.text && event.en === card.en))
    assert.equal(state.players[0]!.position, 24)
    state = JSON.parse(JSON.stringify(state))
    assert.equal(state.rules.mapId, mapId)
    state = ok(state, 'a', { type: 'buy' })
    assert.ok(state.log.at(-1)?.en?.includes(spacesForMap(mapId)[24]!.en))
  }
})

test('房主选择地图同步给全房间，抽签及开局后禁止修改', () => {
  const { room, person } = createRoom('Host', 'map-host', 'usa')
  const joined = joinRoom(room.code, 'Guest', 'map-guest')
  assert.ok(!('error' in joined))
  if ('error' in joined) throw Error(String(joined.error))
  assert.equal(snapshot(room, joined.person.id, []).rules.mapId, 'usa')
  assert.equal(setRules(room, joined.person, { mapId: 'china' }), '只有房主可以修改设置')
  assert.equal(setRules(room, person, { mapId: 'invalid' as never }), '请选择有效地图')
  assert.equal(room.rules.mapId, 'usa')
  assert.equal(setRules(room, person, { mapId: 'china' }), null)
  assert.equal(snapshot(room, joined.person.id, []).rules.mapId, 'china')
  assert.equal(setRules(room, person, { mapId: 'usa' }), null)
  assert.equal(selectCharacter(room, person, 'ada'), null)
  assert.equal(selectCharacter(room, joined.person, 'ginger'), null)
  assert.equal(start(room, person), null)
  assert.equal(setRules(room, person, { mapId: 'china' }), '正在抽签，请稍候')
  assert.equal(commitDraw(room), true)
  assert.equal(room.game?.rules.mapId, 'usa')
  assert.equal(setRules(room, person, { mapId: 'china' }), '游戏开始后无法修改规则')
  const guestSnap = snapshot(room, joined.person.id, [])
  assert.equal(guestSnap.game?.rules.mapId, 'usa')
  assert.equal(guestSnap.rules.mapId, 'usa')
})


test('地契按地图显示省州，香港和最后一组使用各自地区名称', () => {
  const expected = {
    china: ['江西省', '安徽省', '四川省', '山东省', '浙江省', '江苏省', '广东省', '直辖市'],
    usa: ['德克萨斯州', '佛罗里达州', '阿拉斯加州', '内华达州', '夏威夷州', '华盛顿州', '加利福尼亚州', '美国东部'],
  }
  for (const mapId of ['china', 'usa'] as const) {
    const spaces = spacesForMap(mapId)
    for (const [index, id] of [1, 6, 12, 16, 21, 26, 31, 37].entries()) {
      assert.equal(propertyRegion(spaces[id]!, mapId, 'zh'), expected[mapId][index])
      assert.ok(propertyRegion(spaces[id]!, mapId, 'en'))
    }
  }
  assert.equal(propertyRegion(spacesForMap('china')[34]!, 'china', 'zh'), '香港特别行政区')
  assert.equal(propertyRegion(spacesForMap('china')[39]!, 'china', 'en'), 'Municipalities')
  assert.equal(propertyRegion(spacesForMap('usa')[37]!, 'usa', 'en'), 'Eastern U.S.')
  assert.equal(propertyRegion(spacesForMap('usa')[39]!, 'usa', 'en'), 'Eastern U.S.')
})

test('抽公益金后结束回合会清掉展示卡牌', () => {
  let state = boot()
  state.chest = ['h16']
  state = ok(state, 'a', { type: 'debug-place', position: 30 })
  state = ok(state, 'a', { type: 'debug-roll', dice: [1, 2] })
  assert.equal(state.lastCard?.id, 'h16')
  state = ok(state, 'a', { type: 'end-turn' })
  assert.equal(state.currentId, 'b')
  assert.equal(state.lastCard, null)
})

test('抽牌后双骰再掷也会清掉上一张卡，避免动画结束恢复旧提示', () => {
  for (const deck of ['chance', 'chest'] as const) {
    let state = boot()
    const start = deck === 'chance' ? 5 : 31
    const id = deck === 'chance' ? 'c7' : 'h16'
    state[deck] = [id]
    state = ok(state, 'a', { type: 'debug-place', position: start })
    state = ok(state, 'a', { type: 'debug-roll', dice: [1, 1] })
    assert.equal(state.lastCard?.id, id)
    assert.equal(state.extraRoll, true)
    state = ok(state, 'a', { type: 'debug-roll', dice: [1, 1] })
    assert.equal(state.lastCard, null)
    assert.equal(state.phase, 'buy')
  }
})


test('旧存档中的房间密码会被移除，加入和快照都不再依赖密码', () => {
  const { room } = createRoom('Legacy host', 'legacy-host')
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'monopoly-room-test-'))
  const file = path.join(dir, 'rooms.json')
  try {
    fs.writeFileSync(file, JSON.stringify({ rooms: [{ ...room, password: 'old-password' }] }))
    initStore(file)
    const restored = roomByCode(room.code)!
    assert.equal('password' in restored, false)
    const joined = joinRoom(room.code, 'Guest', 'legacy-guest')
    assert.ok(!('error' in joined))
    if ('error' in joined) throw Error(String(joined.error))
    assert.equal('hasPassword' in snapshot(restored, joined.person.id, []), false)
    const saved = JSON.parse(fs.readFileSync(file, 'utf8')) as { rooms: Record<string, unknown>[] }
    assert.ok(saved.rooms.every((item) => !('password' in item)))
  } finally {
    initStore('')
    fs.rmSync(file, { force: true })
    fs.rmdirSync(dir)
  }
})


test('只有可结束回合的当前角色可以发起交易', () => {
  const trade: Action = { type: 'trade', to: 'b', offer: { money: 10, spaceIds: [], cardIds: [] }, want: { money: 0, spaceIds: [], cardIds: [] } }
  for (const phase of ['pre-roll', 'buy', 'auction', 'debt', 'resolving', 'ended'] as const) {
    const state = boot()
    state.phase = phase
    assert.match(fail(state, 'a', trade) || '', /无法发起交易/)
  }
  let state = boot()
  state = ok(state, 'a', { type: 'debug-place', position: 18 })
  state = ok(state, 'a', { type: 'debug-roll', dice: [1, 1] })
  assert.equal(state.phase, 'post-roll')
  assert.equal(state.extraRoll, true)
  assert.match(fail(state, 'a', trade) || '', /无法发起交易/)
  state = boot()
  state = ok(state, 'a', { type: 'debug-place', position: 17 })
  state = ok(state, 'a', { type: 'debug-roll', dice: [1, 2] })
  assert.equal(state.phase, 'post-roll')
  assert.match(fail(state, 'b', { ...trade, to: 'a' }) || '', /轮到/)
  state = ok(state, 'a', trade)
  assert.equal(state.trade?.from, 'a')
  assert.match(fail(state, 'a', { type: 'end-turn' }) || '', /处理当前交易/)
  state = ok(state, 'b', { type: 'respond-trade', accept: true })
  assert.equal(state.players[0]!.money, 1490)
  assert.equal(state.players[1]!.money, 1510)
  state = ok(state, 'a', { type: 'end-turn' })
  assert.equal(state.currentId, 'b')
  assert.match(fail(state, 'b', { ...trade, to: 'a' }) || '', /无法发起交易/)
})

test('过期交易不可成交，取消交易后仍可继续结束回合', () => {
  let state = boot()
  state.phase = 'post-roll'
  state = ok(state, 'a', { type: 'trade', to: 'b', offer: { money: 10, spaceIds: [], cardIds: [] }, want: { money: 0, spaceIds: [], cardIds: [] } })
  const stale = structuredClone(state)
  stale.phase = 'pre-roll'
  assert.match(fail(stale, 'b', { type: 'respond-trade', accept: true }) || '', /无法完成交易/)
  state = ok(state, 'a', { type: 'cancel-trade' })
  assert.equal(state.trade, null)
  state = ok(state, 'a', { type: 'end-turn' })
  assert.equal(state.currentId, 'b')
})


function skillGame(...ids: CharacterId[]) {
  return createGame(ids.map((characterId, i) => ({ id: String(i), name: characterId, characterId, connected: true })), DEFAULT_RULES, () => 0.25)
}

test('Orangie 开局持有两张出狱卡，牌堆不重复，使用后归还', () => {
  let state = skillGame('orangie', 'ada')
  assert.deepEqual(state.players[0]!.heldCards.map((c) => c.id), ['c8', 'h5'])
  assert.ok(!state.chance.includes('c8') && !state.chest.includes('h5'))
  assert.equal(state.chance.length + state.chest.length + state.players[0]!.heldCards.length, 32)
  state.players[0]!.inJail = true
  state = ok(state, '0', { type: 'jail-card', deck: 'chance' })
  assert.equal(state.chanceDiscard.filter((id) => id === 'c8').length, 1)
  state.players[0]!.inJail = true
  state = ok(state, '0', { type: 'jail-card', deck: 'chest' })
  assert.equal(state.players[0]!.heldCards.length, 0)
  assert.ok(state.chestDiscard.includes('h5'))
})

test('Orangie 自带的出狱卡可正常交易', () => {
  let state = skillGame('orangie', 'ada')
  state.phase = 'post-roll'
  state = ok(state, '0', { type: 'trade', to: '1', offer: { money: 0, spaceIds: [], cardIds: ['c8'] }, want: { money: 0, spaceIds: [], cardIds: [] } })
  state = ok(state, '1', { type: 'respond-trade', accept: true })
  assert.deepEqual(state.players[0]!.heldCards.map((c) => c.id), ['h5'])
  assert.deepEqual(state.players[1]!.heldCards.map((c) => c.id), ['c8'])
})

test('Ada 免奢侈税，但仍正常缴纳所得税', () => {
  let state = skillGame('ada', 'ginger')
  state.players[0]!.position = 35
  state = ok(state, '0', { type: 'debug-roll', dice: [1, 2] })
  assert.equal(state.players[0]!.money, 1500)
  assert.ok(state.log.some((l) => l.en?.includes('Luxury Tax waived')))
  state = ok(state, '0', { type: 'debug-end' })
  state = ok(state, '1', { type: 'debug-end' })
  state.players[0]!.position = 1
  state = ok(state, '0', { type: 'debug-roll', dice: [1, 2] })
  assert.equal(state.players[0]!.money, 1300)
})

test('Erchai 酒店租金付七折，房屋和抵押地块不受影响', () => {
  let state = skillGame('erchai', 'ginger')
  state.plots[39] = { ownerId: '1', houses: 5, mortgaged: false }
  assert.equal(rentForPlayer(state, 39, 3, '0'), 1400)
  assert.equal(rentForPlayer(state, 39, 3, '1'), 2000)
  state.players[0]!.position = 36
  state = ok(state, '0', { type: 'debug-roll', dice: [1, 2] })
  assert.equal(state.players[0]!.money, 100)
  assert.equal(state.players[1]!.money, 2900)
  state.plots[39]!.houses = 4
  assert.equal(rentForPlayer(state, 39, 3, '0'), 1700)
  state.plots[39]!.mortgaged = true
  assert.equal(rentForPlayer(state, 39, 3, '0'), 0)
})

test('Ginger 各组最贵城市按最低价购买，其他地块原价', () => {
  let state = skillGame('ginger', 'ada')
  for (const id of [1, 3, 9, 14, 19, 24, 29, 34, 39]) {
    const space = SPACES[id]!
    const group = SPACES.filter((s) => s.group === space.group)
    assert.equal(purchasePrice(state, '0', id), Math.min(...group.map((s) => s.price!)))
    assert.equal(purchasePrice(state, '1', id), space.price)
  }
  assert.equal(purchasePrice(state, '0', 23), 220)
  assert.equal(purchasePrice(state, '0', 5), 200)
  state.players[0]!.position = 36
  state = ok(state, '0', { type: 'debug-roll', dice: [1, 2] })
  state.players[0]!.money = 350
  state = ok(state, '0', { type: 'buy' })
  assert.equal(state.players[0]!.money, 0)
  assert.equal(state.plots[39]!.ownerId, '0')
  assert.ok(state.log.at(-1)?.en?.includes('$350'))
})

test('Ginger 拍卖仍支付实际出价', () => {
  let state = skillGame('ginger', 'ada')
  state.players[0]!.position = 36
  state = ok(state, '0', { type: 'debug-roll', dice: [1, 2] })
  state = ok(state, '0', { type: 'decline' })
  state = ok(state, '1', { type: 'pass' })
  state = ok(state, '0', { type: 'bid', amount: 400 })
  state = ok(state, '1', { type: 'pass' })
  assert.equal(state.players[0]!.money, 1100)
  assert.equal(state.plots[39]!.ownerId, '0')
})

test('遇到 Shibagy 立即付款，然后再结算地块', () => {
  let state = skillGame('ada', 'shibagy')
  state.players[1]!.position = 3
  state = ok(state, '0', { type: 'debug-roll', dice: [1, 2] })
  assert.equal(state.players[0]!.money, 1480)
  assert.equal(state.players[1]!.money, 1520)
  assert.equal(state.phase, 'buy')
  state = ok(state, '0', { type: 'buy' })
  assert.equal(state.players[0]!.money, 1420)
})

test('Shibagy 移到其他角色格子，所有同格角色各支付一次', () => {
  let state = skillGame('shibagy', 'ada', 'ginger')
  state.players[1]!.position = state.players[2]!.position = 3
  state = ok(state, '0', { type: 'debug-roll', dice: [1, 2] })
  assert.deepEqual(state.players.map((p) => p.money), [1540, 1480, 1480])
})

test('Shibagy 不对路过或监狱内相遇收费', () => {
  let state = skillGame('ada', 'shibagy')
  state.players[1]!.position = 1
  state = ok(state, '0', { type: 'debug-roll', dice: [1, 2] })
  assert.deepEqual(state.players.map((p) => p.money), [1500, 1500])
  state = skillGame('ada', 'shibagy')
  state.players[1]!.position = 10
  state.players[0]!.position = 7
  state = ok(state, '0', { type: 'debug-roll', dice: [1, 2] })
  assert.deepEqual(state.players.map((p) => p.money), [1500, 1500])
})

test('Shibagy 技能欠款可筹款偿还，恢复结算时不重复收费', () => {
  let state = skillGame('ada', 'shibagy')
  state.players[0]!.money = 10
  state.players[1]!.position = 3
  state = ok(state, '0', { type: 'debug-roll', dice: [1, 2] })
  assert.equal(state.phase, 'debt')
  assert.equal(state.players[1]!.money, 1500)
  state = ok(state, '0', { type: 'debug-money', amount: 20 })
  state = ok(state, '0', { type: 'pay-debt' })
  assert.equal(state.phase, 'buy')
  assert.equal(state.players[1]!.money, 1520)
  assert.equal(state.players[0]!.money, 0)
})

test('Tutu 移动后选择跳跃，结算新落点而非原落点，全局只有两次', () => {
  let state = skillGame('tutu', 'ada')
  state.rules.auction = false
  state.players[0]!.position = 1
  state = ok(state, '0', { type: 'debug-roll', dice: [1, 2] })
  assert.equal(state.phase, 'hop')
  assert.equal(state.players[0]!.position, 4)
  assert.equal(state.players[0]!.money, 1500)
  assert.match(fail(state, '1', { type: 'hop' }) || '', /轮到/)
  state = ok(state, '0', { type: 'hop' })
  assert.equal(state.players[0]!.position, 5)
  assert.equal(state.players[0]!.hopUses, 1)
  assert.equal(state.phase, 'buy')
  assert.match(fail(state, '0', { type: 'hop' }) || '', /无法发动/)
  state = ok(state, '0', { type: 'decline' })
  state = ok(state, '0', { type: 'end-turn' })
  state = ok(state, '1', { type: 'debug-end' })
  state.players[0]!.position = 35
  state = ok(state, '0', { type: 'debug-roll', dice: [1, 2] })
  state = JSON.parse(JSON.stringify(state))
  state = ok(state, '0', { type: 'hop' })
  assert.equal(state.players[0]!.hopUses, 0)
  assert.equal(state.players[0]!.position, 39)
  state = ok(state, '0', { type: 'decline' })
  state = ok(state, '0', { type: 'end-turn' })
  state = ok(state, '1', { type: 'debug-end' })
  state.players[0]!.position = 1
  state = ok(state, '0', { type: 'debug-roll', dice: [1, 2] })
  assert.equal(state.phase, 'post-roll')
  assert.equal(state.players[0]!.money, 1300)
})

test('Tutu 不发动保留次数，跨起点跳跃正常领钱', () => {
  let state = skillGame('tutu', 'ada')
  state.players[0]!.position = 1
  state = ok(state, '0', { type: 'debug-roll', dice: [1, 2] })
  state = ok(state, '0', { type: 'skip-hop' })
  assert.equal(state.players[0]!.hopUses, 2)
  assert.equal(state.players[0]!.money, 1300)
  state = skillGame('tutu', 'ada')
  state.players[0]!.position = 36
  state = ok(state, '0', { type: 'debug-roll', dice: [1, 2] })
  state = ok(state, '0', { type: 'hop' })
  assert.equal(state.players[0]!.position, 0)
  assert.equal(state.players[0]!.money, 1700)
})

test('Tutu 跳跃不会丢失双骰奖励，卡牌移动后也能决定跳跃', () => {
  let state = skillGame('tutu', 'ada')
  state.players[0]!.position = 18
  state = ok(state, '0', { type: 'debug-roll', dice: [1, 1] })
  state = ok(state, '0', { type: 'skip-hop' })
  assert.equal(state.extraRoll, true)
  state = skillGame('tutu', 'ada')
  state.players[0]!.position = 4
  state.chance = ['c2']
  state = ok(state, '0', { type: 'debug-roll', dice: [1, 2] })
  state = ok(state, '0', { type: 'skip-hop' })
  assert.equal(state.phase, 'hop')
  assert.equal(state.players[0]!.position, 24)
  state = ok(state, '0', { type: 'hop' })
  assert.equal(state.players[0]!.position, 25)
  assert.equal(state.players[0]!.hopUses, 1)
})


test('Orangie 破产给银行时，初始出狱卡归还牌堆', () => {
  let state = skillGame('orangie', 'ada', 'ginger')
  state.players[0]!.position = 1
  state.players[0]!.money = 0
  state = ok(state, '0', { type: 'debug-roll', dice: [1, 2] })
  state = ok(state, '0', { type: 'bankrupt' })
  assert.ok(state.chanceDiscard.includes('c8'))
  assert.ok(state.chestDiscard.includes('h5'))
  assert.equal(state.players[0]!.heldCards.length, 0)
})

test('Tutu 等待跳跃时离线，其他在线玩家可跳过技能继续结算', () => {
  let state = skillGame('tutu', 'ada')
  state.players[0]!.position = 17
  state = ok(state, '0', { type: 'debug-roll', dice: [1, 2] })
  assert.equal(state.phase, 'hop')
  state.players[0]!.connected = false
  state = ok(state, '1', { type: 'skip-offline' })
  assert.equal(state.phase, 'post-roll')
  assert.equal(state.players[0]!.hopUses, 2)
})

console.log(`\n${passed} tests passed`)
