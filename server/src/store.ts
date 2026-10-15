import fs from 'node:fs'
import path from 'node:path'
import { randomBytes } from 'node:crypto'
import { characterById, characterTitle, isCharacterId } from '../../shared/characters.ts'
import { DEFAULT_RULES, type Action, type GameState, type Rules, type Seat, type Snapshot } from '../../shared/types.ts'
import { apply, createGame, ejectPlayer, type ApplyResult } from './engine.ts'

export interface InternalSeat extends Seat {
  token: string
  socketId: string | null
}

export interface Room {
  code: string
  password: string | null
  hostId: string
  seats: InternalSeat[]
  rules: Rules
  game: GameState | null
  rev: number
  touched: number
}

const rooms = new Map<string, Room>()
const sockets = new Map<string, { code: string; playerId: string }>()
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
const PUBLIC = new Set<Action['type']>([
  'roll', 'buy', 'decline', 'bid', 'pass', 'end-turn', 'build', 'sell', 'mortgage', 'unmortgage',
  'jail-pay', 'jail-card', 'jail-roll', 'pay-debt', 'bankrupt', 'trade', 'respond-trade', 'cancel-trade', 'skip-offline',
])

let file = ''

export function initStore(dataFile: string) {
  file = dataFile
  try {
    if (!fs.existsSync(file)) return
    const parsed = JSON.parse(fs.readFileSync(file, 'utf8')) as { rooms?: Room[] }
    for (const room of parsed.rooms ?? []) {
      for (const seat of room.seats as Array<InternalSeat & { characterId?: string | null }>) {
        if (!Array.isArray(seat.characterIds)) seat.characterIds = seat.characterId ? [seat.characterId] : []
        delete seat.characterId
        seat.connected = false
        seat.socketId = null
      }
      if (room.game) {
        for (const player of room.game.players) {
          if (!player.controllerId) player.controllerId = player.id
          player.connected = false
        }
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
    hasPassword: Boolean(room.password),
    seats: room.seats.map((item) => ({
      id: item.id,
      name: item.name,
      characterIds: item.characterIds,
      connected: item.connected,
    })),
    rules: room.rules,
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

export function createRoom(name: string, password: string, socketId: string) {
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
    password: password || null,
    hostId: person.id,
    seats: [person],
    rules: { ...DEFAULT_RULES },
    game: null,
    rev: 1,
    touched: Date.now(),
  }
  rooms.set(room.code, room)
  bind(room, person, socketId)
  persist()
  return { room, person }
}

export function joinRoom(code: string, name: string, password: string, socketId: string) {
  const room = rooms.get(code)
  if (!room) return { error: '没有这个房间', fatal: true }
  if ((room.password || '') !== password) return { error: '房间密码不对' }
  if (room.game) return { error: '这局已经开始了，只有原来的人能回来' }
  if (room.seats.length >= 6) return { error: '人满了' }
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
  if (!room) return { error: '房间已经散了', fatal: true }
  const person = room.seats.find((item) => item.token === token)
  if (!person) return { error: '这个位子不在了', fatal: true }
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
  if (room.game) return '开局之后就不能换了'
  if (!characterId) {
    person.characterIds = []
    bump(room)
    return null
  }
  if (!isCharacterId(characterId)) return '没有这个角色'
  const taken = room.seats.find((item) => item.id !== person.id && item.characterIds.includes(characterId))
  if (taken) return `${taken.name} 已经选了`
  if (person.characterIds.includes(characterId)) person.characterIds = person.characterIds.filter((id) => id !== characterId)
  else person.characterIds.push(characterId)
  bump(room)
  return null
}

export function rename(room: Room, person: InternalSeat, name: string) {
  if (!name) return '名字不能空'
  person.name = name
  bump(room)
  return null
}

export function setRules(room: Room, person: InternalSeat, patch: Partial<Rules>) {
  if (room.hostId !== person.id) return '只有房主能改'
  if (room.game) return '开局之后就不能改了'
  const allowed = [1000, 1500, 2000, 2500]
  if (patch.startingMoney !== undefined) {
    if (!allowed.includes(patch.startingMoney)) return '这个金额不能选'
    room.rules.startingMoney = patch.startingMoney
  }
  if (patch.auction !== undefined) room.rules.auction = Boolean(patch.auction)
  if (patch.freeParking !== undefined) room.rules.freeParking = Boolean(patch.freeParking)
  bump(room)
  return null
}

export function kick(room: Room, person: InternalSeat, playerId: string) {
  if (room.hostId !== person.id) return { error: '只有房主能请人走' }
  if (room.game) return { error: '开局之后就不能请人走了' }
  if (playerId === person.id) return { error: '不能把自己请走' }
  const target = seat(room, playerId)
  if (!target) return { error: '没有这个位子' }
  const kickedSocketId = target.socketId
  if (target.socketId) sockets.delete(target.socketId)
  room.seats = room.seats.filter((item) => item.id !== playerId)
  bump(room)
  return { kickedSocketId }
}

export function start(room: Room, person: InternalSeat) {
  if (room.hostId !== person.id) return '只有房主能开始'
  if (room.game) return '已经开始了'
  if (room.seats.some((item) => !item.connected)) return '还有人没连上。等等，或者先请他们离开。'
  if (room.seats.some((item) => item.characterIds.length === 0)) return '还有人没选角色'
  const seated = room.seats.flatMap((item) =>
    item.characterIds.flatMap((characterId) => {
      if (!isCharacterId(characterId)) return []
      const character = characterById(characterId)
      if (!character) return []
      return [{ id: `${item.id}:${characterId}`, controllerId: item.id, name: characterTitle(character), characterId, connected: true }]
    }),
  )
  if (!seated.length) return '先选角色'
  if (seated.length > 6) return '一桌最多六个角色'
  room.game = createGame(seated, room.rules)
  bump(room)
  return null
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
  if (!room.game) return { error: '还没开始' }
  if (!PUBLIC.has(action.type)) return { error: '这个操作不能用' }
  const actor = actorFor(room.game, person.id, action)
  if (!actor) return { error: '现在轮不到你' }
  const result = apply(room.game, actor, action)
  if (!result.ok) return { error: result.error || '做不到' }
  room.game = result.state
  bump(room, result.events)
  return { result }
}

export function disband(room: Room, person: InternalSeat) {
  if (room.hostId !== person.id) return '只有房主能解散'
  room.game = null
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
