import { isMapId } from '../../shared/board.ts'
import fs from 'node:fs'
import path from 'node:path'
import { randomBytes } from 'node:crypto'
import { characterById, characterTitle, isCharacterId } from '../../shared/characters.ts'
import { DEFAULT_RULES, type MapId, type Action, type DrawState, type GameState, type Rules, type Seat, type SeatInput, type Snapshot } from '../../shared/types.ts'
import { apply, arrangeSeats, createGame, ejectPlayer, type ApplyResult } from './engine.ts'

export interface InternalSeat extends Seat {
  token: string
  socketId: string | null
}

export interface Room {
  code: string
  hostId: string
  seats: InternalSeat[]
  rules: Rules
  game: GameState | null
  draw: { state: DrawState; seats: SeatInput[] } | null
  rev: number
  touched: number
}

const rooms = new Map<string, Room>()
const sockets = new Map<string, { code: string; playerId: string }>()
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
const PUBLIC = new Set<Action['type']>([
  'hop', 'skip-hop', 'roll', 'buy', 'decline', 'bid', 'pass', 'end-turn', 'build', 'sell', 'mortgage', 'unmortgage',
  'jail-pay', 'jail-card', 'jail-roll', 'pay-debt', 'bankrupt', 'trade', 'respond-trade', 'cancel-trade', 'skip-offline',
])

let file = ''

export function initStore(dataFile: string) {
  file = dataFile
  try {
    if (!fs.existsSync(file)) return
    const parsed = JSON.parse(fs.readFileSync(file, 'utf8')) as { rooms?: Room[] }
    for (const room of parsed.rooms ?? []) {
      // Discard the removed field when restoring legacy room saves.
      delete (room as Room & { password?: unknown }).password
      room.rules = { ...DEFAULT_RULES, ...room.rules, mapId: isMapId(room.rules?.mapId) ? room.rules.mapId : 'china' }
      if (room.game) room.game.rules = { ...DEFAULT_RULES, ...room.game.rules, mapId: room.rules.mapId }
      for (const seat of room.seats as Array<InternalSeat & { characterId?: string | null }>) {
        if (!Array.isArray(seat.characterIds)) seat.characterIds = seat.characterId ? [seat.characterId] : []
        delete seat.characterId
        seat.connected = false
        seat.socketId = null
      }
      if (room.game) {
        for (const player of room.game.players) {
          if (!player.controllerId) player.controllerId = player.id
          player.hopUses ??= player.characterId === 'tutu' ? 2 : 0
          player.connected = false
        }
      }
      if (!room.draw?.seats || room.game) room.draw = null
      else {
        room.game = createGame(room.draw.seats, room.rules)
        room.draw = null
      }
      rooms.set(room.code, room)
    }
    if (rooms.size) console.log(`恢复了 ${rooms.size} 个还没散的房间`)
  } catch (error) {
    console.error('房间存档读不了，这局从空桌开始', error)
  }
}

function persist() {
  if (!file) return
  fs.mkdirSync(path.dirname(file), { recursive: true })
  const plain = [...rooms.values()].map((room) => ({
    ...room,
    seats: room.seats.map((seat) => ({ ...seat, socketId: null })),
  }))
  fs.writeFileSync(file, JSON.stringify({ rooms: plain }))
}

export function touch(room: Room) {
  room.touched = Date.now()
}

function codeOf() {
  let code = ''
  do {
    code = Array.from({ length: 4 }, () => ALPHABET[randomBytes(1)[0]! % ALPHABET.length]).join('')
  } while (rooms.has(code))
  return code
}

export function sanitizeName(input: unknown) {
  return String(input ?? '').replace(/[\u0000-\u001f]/g, '').replace(/\s+/g, ' ').trim().slice(0, 12)
}

function seat(room: Room, playerId: string) {
  return room.seats.find((item) => item.id === playerId)
}

function sync(room: Room) {
  if (!room.game) return
  for (const player of room.game.players) {
    const live = seat(room, player.controllerId || player.id)
    player.connected = Boolean(live?.connected)
  }
}

export function snapshot(room: Room, youId: string, events: Snapshot['events']): Snapshot {
  sync(room)
  const game = room.game ? structuredClone(room.game) : null
  if (game) game.debugDice = []
  return {
    rev: room.rev,
    code: room.code,
    hostId: room.hostId,
    youId,
    seats: room.seats.map((item) => ({
      id: item.id,
      name: item.name,
      characterIds: item.characterIds,
      connected: item.connected,
    })),
    rules: room.rules,
    draw: room.draw?.state ?? null,
    game,
    events,
  }
}

function bind(room: Room, person: InternalSeat, socketId: string) {
  person.socketId = socketId
  person.connected = true
  sockets.set(socketId, { code: room.code, playerId: person.id })
  touch(room)
}

export function createRoom(name: string, socketId: string, mapId: MapId = 'china') {
  const person: InternalSeat = {
    id: randomBytes(8).toString('hex'),
    token: randomBytes(18).toString('hex'),
    name,
    characterIds: [],
    connected: true,
    socketId,
  }
  const room: Room = {
    code: codeOf(),
    hostId: person.id,
    seats: [person],
    rules: { ...DEFAULT_RULES, mapId },
    game: null,
    draw: null,
    rev: 1,
    touched: Date.now(),
  }
  rooms.set(room.code, room)
  bind(room, person, socketId)
  persist()
  return { room, person }
}

export function joinRoom(code: string, name: string, socketId: string) {
  const room = rooms.get(code)
  if (!room) return { error: '找不到该房间', fatal: true }
  if (room.game) return { error: '本局已开始，仅限原有玩家重新加入' }
  if (room.seats.length >= 6) return { error: '房间已满' }
  const person: InternalSeat = {
    id: randomBytes(8).toString('hex'),
    token: randomBytes(18).toString('hex'),
    name,
    characterIds: [],
    connected: true,
    socketId,
  }
  room.seats.push(person)
  bind(room, person, socketId)
  room.rev += 1
  persist()
  return { room, person }
}

export function resume(code: string, token: string, socketId: string) {
  const room = rooms.get(code)
  if (!room) return { error: '房间已关闭', fatal: true }
  const person = room.seats.find((item) => item.token === token)
  if (!person) return { error: '你已不在该房间，请重新加入', fatal: true }
  bind(room, person, socketId)
  room.rev += 1
  persist()
  return { room, person }
}

export function disconnect(socketId: string) {
  const loc = sockets.get(socketId)
  sockets.delete(socketId)
  if (!loc) return null
  const room = rooms.get(loc.code)
  if (!room) return null
  const person = seat(room, loc.playerId)
  if (!person || person.socketId !== socketId) return null
  person.connected = false
  person.socketId = null
  touch(room)
  room.rev += 1
  persist()
  return room
}

export function leave(socketId: string) {
  const loc = sockets.get(socketId)
  if (!loc) return { room: null as Room | null, events: [] as Snapshot['events'] }
  sockets.delete(socketId)
  const room = rooms.get(loc.code)
  if (!room) return { room: null, events: [] as Snapshot['events'] }
  const person = seat(room, loc.playerId)
  if (!person) return { room, events: [] as Snapshot['events'] }
  let events: Snapshot['events'] = []
  if (room.game) {
    const ids = room.game.players.filter((player) => (player.controllerId || player.id) === person.id).map((player) => player.id)
    for (const id of ids) {
      if (!room.game) break
      const result = ejectPlayer(room.game, id)
      room.game = result.state
      events.push(...result.events)
    }
  }
  room.seats = room.seats.filter((item) => item.id !== person.id)
  if (!room.seats.length) {
    rooms.delete(room.code)
    persist()
    return { room: null, events }
  }
  if (room.hostId === person.id) room.hostId = room.seats[0]!.id
  room.rev += 1
  touch(room)
  persist()
  return { room, events }
}

export function locate(socketId: string) {
  const loc = sockets.get(socketId)
  if (!loc) return null
  const room = rooms.get(loc.code)
  if (!room) return null
  const person = seat(room, loc.playerId)
  if (!person) return null
  return { room, person }
}

function bump(room: Room, events: Snapshot['events'] = []) {
  sync(room)
  room.rev += 1
  touch(room)
  persist()
  return events
}

export function selectCharacter(room: Room, person: InternalSeat, characterId: string | null) {
  if (room.draw) return '正在抽签，暂时无法更换角色'
  if (room.game) return '游戏开始后无法更换角色'
  if (!characterId) {
    person.characterIds = []
    bump(room)
    return null
  }
  if (!isCharacterId(characterId)) return '找不到该角色'
  const taken = room.seats.find((item) => item.id !== person.id && item.characterIds.includes(characterId))
  if (taken) return `该角色已被 ${taken.name} 选中`
  if (person.characterIds.includes(characterId)) person.characterIds = person.characterIds.filter((id) => id !== characterId)
  else person.characterIds.push(characterId)
  bump(room)
  return null
}

export function rename(room: Room, person: InternalSeat, name: string) {
  if (!name) return '请输入名字'
  person.name = name
  bump(room)
  return null
}

export function setRules(room: Room, person: InternalSeat, patch: Partial<Rules>) {
  if (room.hostId !== person.id) return '只有房主可以修改设置'
  if (room.draw) return '正在抽签，请稍候'
  if (room.game) return '游戏开始后无法修改规则'
  if (patch.mapId !== undefined && !isMapId(patch.mapId)) return '请选择有效地图'
  const allowed = [1000, 1500, 2000, 2500]
  if (patch.startingMoney !== undefined) {
    if (!allowed.includes(patch.startingMoney)) return '请选择有效金额'
    room.rules.startingMoney = patch.startingMoney
  }
  if (patch.mapId !== undefined) room.rules.mapId = patch.mapId
  if (patch.auction !== undefined) room.rules.auction = Boolean(patch.auction)
  if (patch.freeParking !== undefined) room.rules.freeParking = Boolean(patch.freeParking)
  bump(room)
  return null
}

export function kick(room: Room, person: InternalSeat, playerId: string) {
  if (room.hostId !== person.id) return { error: '只有房主可以移出玩家' }
  if (room.game) return { error: '游戏开始后无法移出玩家' }
  if (playerId === person.id) return { error: '无法移出自己，请使用离开按钮' }
  const target = seat(room, playerId)
  if (!target) return { error: '该玩家已离开房间' }
  const kickedSocketId = target.socketId
  if (target.socketId) sockets.delete(target.socketId)
  room.seats = room.seats.filter((item) => item.id !== playerId)
  if (!room.game) room.draw = null
  bump(room)
  return { kickedSocketId }
}

export function start(room: Room, person: InternalSeat) {
  if (room.hostId !== person.id) return '只有房主可以开始游戏'
  if (room.draw) return '正在抽签，请稍候'
  if (room.game) return '游戏已经开始'
  if (room.seats.some((item) => !item.connected)) return '还有玩家未连接，请等待重连，或将其移出房间后开始。'
  if (room.seats.some((item) => item.characterIds.length === 0)) return '请等待所有玩家选好角色'
  const seated = room.seats.flatMap((item) =>
    item.characterIds.flatMap((characterId) => {
      if (!isCharacterId(characterId)) return []
      const character = characterById(characterId)
      if (!character) return []
      return [{ id: `${item.id}:${characterId}`, controllerId: item.id, name: characterTitle(character), characterId, connected: true }]
    }),
  )
  if (!seated.length) return '请先选择角色'
  if (seated.length > 6) return '每局最多可选六个角色'
  const arranged = arrangeSeats(seated, Math.random)
  const revealStartMs = 480
  const revealStepMs = 680
  room.draw = {
    state: {
      people: arranged.lots.map((lot) => ({
        seatId: lot.controllerId,
        name: room.seats.find((item) => item.id === lot.controllerId)?.name || '玩家',
        lot: lot.lot,
        names: lot.characterIds.map((id) => {
          const character = characterById(id)
          return character ? characterTitle(character) : ''
        }).filter(Boolean),
      })),
      order: arranged.seats.map((seat) => ({ id: seat.id, name: seat.name, characterId: seat.characterId })),
      revealStartMs,
      revealStepMs,
      holdMs: revealStartMs + arranged.lots.length * revealStepMs + 1700,
    },
    seats: arranged.seats,
  }
  bump(room)
  return null
}

export function commitDraw(room: Room) {
  if (!room.draw || room.game) return false
  room.game = createGame(room.draw.seats, room.rules)
  room.draw = null
  bump(room)
  return true
}

export function roomByCode(code: string) {
  return rooms.get(code) ?? null
}

function actorFor(game: GameState, humanId: string, action: Action) {
  const mine = game.players.filter((player) => player.controllerId === humanId && !player.bankrupt)
  const has = (id?: string | null) => Boolean(id && mine.some((player) => player.id === id))
  if (action.type === 'build' || action.type === 'sell' || action.type === 'mortgage' || action.type === 'unmortgage') {
    const owner = game.plots[action.spaceId]?.ownerId
    return has(owner) ? owner! : null
  }
  if (action.type === 'respond-trade') return has(game.trade?.to) ? game.trade!.to : null
  if (action.type === 'cancel-trade') return has(game.trade?.from) ? game.trade!.from : null
  if (action.type === 'bid' || action.type === 'pass') return has(game.auction?.turnId) ? game.auction!.turnId : null
  if (action.type === 'pay-debt' || action.type === 'bankrupt') {
    const step = game.stack[0]
    return step?.type === 'debt' && has(step.playerId) ? step.playerId : null
  }
  if (action.type === 'skip-offline') return mine.find((player) => player.connected)?.id ?? null
  const current = game.players.find((player) => player.id === game.currentId)
  return current && current.controllerId === humanId ? current.id : null
}

export function act(room: Room, person: InternalSeat, action: Action): { error?: string; result?: ApplyResult } {
  if (!room.game) return { error: '游戏尚未开始' }
  if (!PUBLIC.has(action.type)) return { error: '此操作不可用' }
  const actor = actorFor(room.game, person.id, action)
  if (!actor) return { error: '还没轮到你操作' }
  const result = apply(room.game, actor, action)
  if (!result.ok) return { error: result.error || '暂时无法完成此操作' }
  room.game = result.state
  bump(room, result.events)
  return { result }
}

export function disband(room: Room, person: InternalSeat) {
  if (room.hostId !== person.id) return '只有房主可以结束本局'
  room.game = null
  room.draw = null
  bump(room)
  return null
}

export function swept() {
  const now = Date.now()
  let changed = false
  for (const [code, room] of rooms) {
    if (room.seats.some((item) => item.connected)) continue
    if (now - room.touched > 30 * 60 * 1000) {
      rooms.delete(code)
      changed = true
    }
  }
  if (changed) persist()
}

export function targets(room: Room) {
  return room.seats.filter((item) => item.socketId)
}
