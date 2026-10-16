export type GroupId =
  | 'brown'
  | 'lightblue'
  | 'pink'
  | 'orange'
  | 'red'
  | 'yellow'
  | 'green'
  | 'navy'

export type Deck = 'chance' | 'chest'

export type SpaceType =
  | 'go'
  | 'property'
  | 'chest'
  | 'tax'
  | 'railroad'
  | 'chance'
  | 'jail'
  | 'utility'
  | 'parking'
  | 'gotojail'

export interface Space {
  id: number
  name: string
  short: string
  en: string
  enShort: string
  type: SpaceType
  group?: GroupId
  price?: number
  rent?: number[]
  houseCost?: number
  mortgage?: number
  tax?: number
}

export type CharacterId = 'shibagy' | 'ada' | 'erchai' | 'orangie' | 'tutu' | 'ginger'

export interface Character {
  id: CharacterId
  name: string
  english: string
  color: string
  ink: string
  blurb: string
}

export type MapId = 'china' | 'usa'

export interface Rules {
  mapId: MapId
  startingMoney: number
  salary: number
  auction: boolean
  freeParking: boolean
}

export const DEFAULT_RULES: Rules = {
  mapId: 'china',
  startingMoney: 1500,
  salary: 200,
  auction: true,
  freeParking: false,
}

export type CardEffect =
  | { type: 'money'; amount: number }
  | { type: 'goto'; space: number }
  | { type: 'nearest'; kind: 'railroad' | 'utility' }
  | { type: 'back'; steps: number }
  | { type: 'jail' }
  | { type: 'jail-card' }
  | { type: 'repairs'; house: number; hotel: number }
  | { type: 'pay-each'; amount: number }
  | { type: 'collect-each'; amount: number }

export interface Card {
  id: string
  deck: Deck
  text: string
  en: string
  effect: CardEffect
}

export interface Plot {
  ownerId: string | null
  houses: number
  mortgaged: boolean
}

export interface HeldCard {
  id: string
  deck: Deck
}

export interface GamePlayer {
  id: string
  controllerId: string
  name: string
  characterId: CharacterId
  money: number
  position: number
  inJail: boolean
  jailTurns: number
  heldCards: HeldCard[]
  bankrupt: boolean
  connected: boolean
}

export type Creditor = { type: 'bank' } | { type: 'player'; id: string }

export interface DebtStep {
  type: 'debt'
  playerId: string
  amount: number
  creditor: Creditor
  reason: string
}

export type Step =
  | DebtStep
  | { type: 'forward'; steps: number; collectGo: boolean }
  | { type: 'advance'; target: number; collectGo: boolean }
  | { type: 'back'; steps: number }
  | { type: 'resolve-space' }
  | { type: 'draw'; deck: Deck }
  | { type: 'go-jail' }
  | { type: 'next-turn' }
  | { type: 'free-from-jail' }
  | { type: 'release-jail' }
  | { type: 'collect'; playerId: string; amount: number; reason: string }

export interface Auction {
  spaceId: number
  highBid: number
  highBidderId: string | null
  turnId: string
  passed: string[]
}

export interface TradePack {
  money: number
  spaceIds: number[]
  cardIds: string[]
}

export interface Trade {
  id: string
  from: string
  to: string
  offer: TradePack
  want: TradePack
}

export interface ShownCard {
  id: string
  deck: Deck
  text: string
  en?: string
}

export interface LogLine {
  id: number
  text: string
  en?: string
  at: number
}

export type Phase = 'pre-roll' | 'post-roll' | 'buy' | 'auction' | 'debt' | 'ended' | 'resolving'

export interface GameState {
  players: GamePlayer[]
  order: string[]
  currentId: string
  phase: Phase
  extraRoll: boolean
  pendingExtra: boolean
  doublesStreak: number
  plots: Plot[]
  chance: string[]
  chanceDiscard: string[]
  chest: string[]
  chestDiscard: string[]
  houses: number
  hotels: number
  pot: number
  lastDice: [number, number] | null
  lastCard: ShownCard | null
  landingMod: null | 'rail2' | 'utility10'
  stack: Step[]
  auction: Auction | null
  trade: Trade | null
  log: LogLine[]
  logSeq: number
  winnerId: string | null
  rules: Rules
  debugDice: number[]
  cardChain: number
  buySpaceId: number | null
}

export type GameEvent =
  | { type: 'dice'; playerId: string; dice: [number, number] }
  | { type: 'move'; playerId: string; path: number[]; jump?: boolean }
  | { type: 'card'; playerId: string; deck: Deck; text: string; en: string }
  | { type: 'jail'; playerId: string }

export type Action =
  | { type: 'roll' }
  | { type: 'buy' }
  | { type: 'decline' }
  | { type: 'bid'; amount: number }
  | { type: 'pass' }
  | { type: 'end-turn' }
  | { type: 'build'; spaceId: number }
  | { type: 'sell'; spaceId: number }
  | { type: 'mortgage'; spaceId: number }
  | { type: 'unmortgage'; spaceId: number }
  | { type: 'jail-pay' }
  | { type: 'jail-card'; deck?: Deck }
  | { type: 'jail-roll' }
  | { type: 'pay-debt' }
  | { type: 'bankrupt' }
  | { type: 'trade'; to: string; offer: TradePack; want: TradePack }
  | { type: 'respond-trade'; accept: boolean }
  | { type: 'cancel-trade' }
  | { type: 'skip-offline' }
  | { type: 'debug-place'; position: number }
  | { type: 'debug-roll'; dice: [number, number] }
  | { type: 'debug-own'; spaceIds: number[] }
  | { type: 'debug-money'; amount: number }
  | { type: 'debug-end' }

export interface Seat {
  id: string
  name: string
  characterIds: string[]
  connected: boolean
}

export interface DrawPerson {
  seatId: string
  name: string
  lot: number
  names: string[]
}

export interface DrawTurn {
  id: string
  name: string
  characterId: CharacterId
}

export interface DrawState {
  people: DrawPerson[]
  order: DrawTurn[]
  revealStartMs: number
  revealStepMs: number
  holdMs: number
}

export interface Snapshot {
  rev: number
  code: string
  hostId: string
  youId: string
  seats: Seat[]
  rules: Rules
  draw: DrawState | null
  game: GameState | null
  events: GameEvent[]
}

export interface SeatInput {
  id: string
  controllerId?: string
  name: string
  characterId: CharacterId
  connected: boolean
}
