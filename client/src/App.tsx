import { useEffect, useMemo, useState } from 'react'
import { characterById, characterTitle } from '@shared/characters.ts'
import { SPACES, isDeed } from '@shared/board.ts'
import type { Action, GameState, Seat, TradePack } from '@shared/types.ts'
import { Board, type Piece } from './Board'
import { useFx } from './fx'
import { useNet } from './net'
import { Bills, Deed, DicePair, Drawer, Log, Rules, debtOf, usd } from './widgets'

const EMPTY: TradePack = { money: 0, spaceIds: [], cardIds: [] }

export function App() {
  const net = useNet()
  const fx = useFx(net.snap)
  const [name, setName] = useState('')
  const [code, setCode] = useState(() => new URLSearchParams(location.search).get('room')?.toUpperCase() || '')
  const [roomPassword, setRoomPassword] = useState('')
  const [gate, setGate] = useState('')
  const [selected, setSelected] = useState<number | null>(null)
  const [rulesOpen, setRulesOpen] = useState(false)
  const [copied, setCopied] = useState('')
  const [tradeOpen, setTradeOpen] = useState(false)
  const [tradeTo, setTradeTo] = useState('')
  const [offer, setOffer] = useState<TradePack>(EMPTY)
  const [want, setWant] = useState<TradePack>(EMPTY)
  const [bid, setBid] = useState(10)
  const [confirmLeave, setConfirmLeave] = useState(false)

  const snap = net.snap
  const game = snap?.game ?? null
  const youId = snap?.youId ?? null
  const screen = !net.metaReady ? 'loading' : net.siteRequired && !net.sitePassword ? 'gate' : net.booting ? 'loading' : !snap ? 'home' : game ? 'game' : 'lobby'
  const busy = net.pending || fx.animating
  const controlled = game?.players.filter((p) => p.controllerId === youId) ?? []
  const currentPiece = game?.players.find((p) => p.id === game.currentId) ?? null
  const yourTurn = Boolean(currentPiece && currentPiece.controllerId === youId && !currentPiece.bankrupt && game && game.phase !== 'ended')
  const debtNow = game ? debtOf(game) : null
  const you =
    (yourTurn ? currentPiece : null) ??
    controlled.find((p) => debtNow?.playerId === p.id) ??
    controlled.find((p) => game?.auction?.turnId === p.id) ??
    controlled.find((p) => !p.bankrupt) ??
    controlled[0] ??
    null

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const tag = (event.target as HTMLElement | null)?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA') return
      if ((event.key === 'r' || event.key === 'R') && yourTurn && game && !busy) {
        if (game.phase === 'pre-roll' && !you?.inJail) net.send({ type: 'roll' })
        if (game.phase === 'post-roll' && game.extraRoll) net.send({ type: 'roll' })
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [yourTurn, game, busy, you?.inJail, net])

  const pieces = useMemo<Piece[]>(() => {
    if (game) {
      return game.players.filter((p) => !p.bankrupt).map((p) => ({
        id: p.id,
        characterId: p.characterId,
        position: fx.tokens[p.id] ?? p.position,
        inJail: p.inJail,
        active: p.id === game.currentId && game.phase !== 'ended',
        yours: p.controllerId === youId,
      }))
    }
    return (snap?.seats ?? []).flatMap((s) =>
      s.characterIds.map((characterId) => ({
        id: `${s.id}:${characterId}`,
        characterId,
        position: 0,
        inJail: false,
        active: false,
        yours: s.id === youId,
      })),
    )
  }, [game, fx.tokens, snap?.seats, youId])

  async function copy(text: string, label: string) {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(label)
      window.setTimeout(() => setCopied(''), 1600)
    } catch {
      setCopied('复制失败')
    }
  }

  return (
    <div className={`shell ${screen}`}>
      <header className="topbar">
        <div className="brand-lockup">
          <strong>木匣</strong>
          <span>自制大富翁</span>
        </div>
        <div className="top-meta">
          {snap && <em>房间 {snap.code}</em>}
          <i className={net.online ? 'dot on' : 'dot'} />
          <button type="button" onClick={() => setRulesOpen(true)}>玩法</button>
          {snap && (
            <button type="button" onClick={() => (game ? setConfirmLeave(true) : net.leave())}>
              离开
            </button>
          )}
        </div>
      </header>

      {screen === 'gate' && (
        <form
          className="gate"
          onSubmit={(event) => {
            event.preventDefault()
            if (gate.trim()) net.setSitePassword(gate.trim())
          }}
        >
          <h1>家里的口令</h1>
          <p>不是账号，家里人知道就行。</p>
          <input value={gate} onChange={(event) => setGate(event.target.value)} type="password" placeholder="口令" autoFocus />
          <button className="solid" type="submit">进入</button>
          {net.error && <p className="error">{net.error}</p>}
        </form>
      )}

      {screen !== 'gate' && (
        <div className="stage">
          {screen === 'game' && game && you && (
            <aside className="panel left">
              {controlled.length > 1 && <p className="bankline">{you.name} 手头的钱</p>}
              <Bills amount={you.money} />
              <p className="bankline">银行还剩 {game.houses} 栋房子 · {game.hotels} 座旅馆</p>
              {game.rules.freeParking && <p className="bankline">停车奖金 {usd(game.pot)}</p>}
              <Log lines={game.log} />
            </aside>
          )}

          <div className="board-slot">
            <Board pieces={pieces} selected={selected} game={game} onSelect={screen === 'game' ? setSelected : undefined}>
              {screen === 'loading' && <p className="quiet">正在摆桌子……</p>}
              {screen === 'home' && (
                <HomeMenu
                  name={name}
                  setName={setName}
                  code={code}
                  setCode={setCode}
                  roomPassword={roomPassword}
                  setRoomPassword={setRoomPassword}
                  error={net.error}
                  onCreate={() => net.create(name.trim(), roomPassword)}
                  onJoin={() => net.join(code.trim(), name.trim(), roomPassword)}
                />
              )}
              {screen === 'lobby' && snap && (
                <Lobby
                  code={snap.code}
                  youId={snap.youId}
                  host={snap.hostId === snap.youId}
                  seats={snap.seats}
                  rules={snap.rules}
                  copied={copied}
                  error={net.error}
                  onCopyCode={() => copy(snap.code, '房间号已复制')}
                  onCopyLink={() => copy(`${location.origin}/?room=${snap.code}`, '链接已复制')}
                  onRules={(patch) => net.emit('rules', patch)}
                  onStart={() => net.emit('start')}
                  onKick={(playerId) => net.emit('kick', { playerId })}
                />
              )}
              {screen === 'game' && game && (
                <Center
                  game={game}
                  youId={youId || ''}
                  dice={fx.dice}
                  rolling={fx.rolling}
                  card={fx.card}
                  busy={busy}
                  error={net.error}
                  bid={bid}
                  setBid={setBid}
                  onAction={net.send}
                />
              )}
            </Board>
          </div>

          {screen === 'game' && game && youId && (
            <aside className="panel right">
              {selected !== null && <Deed spaceId={selected} game={game} youId={youId} busy={busy} onAction={net.send} />}
              {selected === null && <p className="hint">点一格，看地契、盖房或者抵押。</p>}
              <Portfolio game={game} youId={youId} onPick={setSelected} />
              <TradeBox
                open={tradeOpen}
                setOpen={setTradeOpen}
                game={game}
                youId={youId}
                tradeTo={tradeTo}
                setTradeTo={setTradeTo}
                offer={offer}
                want={want}
                setOffer={setOffer}
                setWant={setWant}
                busy={busy}
                onAction={net.send}
              />
              {snap?.hostId === youId && (
                <button type="button" className="text-button danger" onClick={() => net.emit('disband')}>
                  解散这局
                </button>
              )}
            </aside>
          )}
        </div>
      )}

      {screen !== 'gate' && (
        <Drawer
          mode={screen === 'lobby' ? 'pick' : screen === 'game' ? 'status' : 'showcase'}
          seats={snap?.seats ?? []}
          game={game}
          youId={youId}
          onPick={(id) => net.emit('select-character', { characterId: id })}
        />
      )}

      {rulesOpen && <Rules onClose={() => setRulesOpen(false)} />}
      {confirmLeave && (
        <div className="modal" role="dialog">
          <article className="booklet confirm">
            <h2>要走了吗？</h2>
            <p>你带的角色会破产离场，别人继续玩。</p>
            <div className="row">
              <button type="button" className="solid" onClick={() => net.leave()}>离开</button>
              <button type="button" onClick={() => setConfirmLeave(false)}>留下</button>
            </div>
          </article>
        </div>
      )}
    </div>
  )
}

function HomeMenu(props: {
  name: string
  setName: (v: string) => void
  code: string
  setCode: (v: string) => void
  roomPassword: string
  setRoomPassword: (v: string) => void
  error: string | null
  onCreate: () => void
  onJoin: () => void
}) {
  return (
    <form
      className="menu"
      onSubmit={(event) => {
        event.preventDefault()
        props.onCreate()
      }}
    >
      <p className="eyebrow">PRIVATE TABLE</p>
      <h1>叫上朋友，开一局</h1>
      <input value={props.name} onChange={(event) => props.setName(event.target.value)} maxLength={12} placeholder="你的名字" required />
      <input value={props.roomPassword} onChange={(event) => props.setRoomPassword(event.target.value)} maxLength={32} placeholder="房间密码，没有就留空" type="password" />
      <button className="solid big" type="submit">开一桌</button>
      <div className="join-row">
        <input
          value={props.code}
          onChange={(event) => props.setCode(event.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 4))}
          placeholder="房间号"
          aria-label="房间号"
        />
        <button
          type="button"
          onClick={props.onJoin}
        >
          进去
        </button>
      </div>
      {props.error && <p className="error">{props.error}</p>}
    </form>
  )
}

function Lobby(props: {
  code: string
  youId: string
  host: boolean
  seats: Seat[]
  rules: GameState['rules']
  copied: string
  error: string | null
  onCopyCode: () => void
  onCopyLink: () => void
  onRules: (patch: Partial<GameState['rules']>) => void
  onStart: () => void
  onKick: (id: string) => void
}) {
  const picked = props.seats.reduce((sum, seat) => sum + seat.characterIds.length, 0)
  const ready = props.seats.length >= 1 && props.seats.every((seat) => seat.characterIds.length > 0 && seat.connected)
  return (
    <div className="menu lobby">
      <p className="eyebrow">ROOM</p>
      <h1>{props.code}</h1>
      <div className="row">
        <button type="button" onClick={props.onCopyCode}>复制房号</button>
        <button type="button" onClick={props.onCopyLink}>复制链接</button>
      </div>
      {props.copied && <p className="quiet">{props.copied}</p>}
      <p className="quiet">点下面的角色，想带几个就点几个。再点一下就取消。</p>
      <ul className="seat-list">
        {props.seats.map((seat) => {
          const names = seat.characterIds.map((id) => {
            const character = characterById(id)
            return character ? characterTitle(character) : ''
          }).filter(Boolean)
          const tag = names.length ? names.join('、') : '还没选'
          return (
            <li key={seat.id}>
              <span>{seat.name}</span>
              <em>{tag}{seat.connected ? '' : ' · 掉线'}</em>
              {props.host && seat.id !== props.youId && <button type="button" onClick={() => props.onKick(seat.id)}>请出去</button>}
            </li>
          )
        })}
      </ul>
      <div className="rules-toggles">
        <label>
          <span>开局的钱</span>
          <select
            value={props.rules.startingMoney}
            disabled={!props.host}
            onChange={(event) => props.onRules({ startingMoney: Number(event.target.value) })}
          >
            {[1000, 1500, 2000, 2500].map((n) => (
              <option key={n} value={n}>{usd(n)}</option>
            ))}
          </select>
        </label>
        <label>
          <input type="checkbox" checked={props.rules.auction} disabled={!props.host} onChange={(event) => props.onRules({ auction: event.target.checked })} />
          <span>不买就拿去拍卖</span>
        </label>
        <label>
          <input type="checkbox" checked={props.rules.freeParking} disabled={!props.host} onChange={(event) => props.onRules({ freeParking: event.target.checked })} />
          <span>停车格发奖金</span>
        </label>
      </div>
      {props.host ? (
        <button className="solid big" type="button" disabled={!ready} onClick={props.onStart}>
          {picked < 2 ? '就一个角色，先随便走走' : '开始'}
        </button>
      ) : (
        <p className="quiet">等房主开始。</p>
      )}
      {props.error && <p className="error">{props.error}</p>}
    </div>
  )
}

function Center(props: {
  game: GameState
  youId: string
  dice: [number, number] | null
  rolling: boolean
  card: ShownCard | null
  busy: boolean
  error: string | null
  bid: number
  setBid: (n: number) => void
  onAction: (action: Action) => void
}) {
  const { game, youId } = props
  const current = game.players.find((p) => p.id === game.currentId)
  const yours = Boolean(current && current.controllerId === youId && !current.bankrupt)
  const you = yours ? current : null
  const debt = debtOf(game)
  const debtor = game.players.find((p) => p.id === debt?.playerId)
  const owing = Boolean(debtor && debtor.controllerId === youId)
  const auction = game.auction
  const space = SPACES[game.buySpaceId ?? auction?.spaceId ?? -1]
  const offline = current && !current.connected
  return (
    <div className="hud">
      <DicePair dice={props.dice} rolling={props.rolling} />
      <p className="turn-line">
        {game.phase === 'ended'
          ? `${game.players.find((p) => p.id === game.winnerId)?.name || '有人'} 赢了`
          : `轮到 ${current?.name || ''}`}
      </p>
      {props.card && (
        <blockquote className={`drawn ${props.card.deck}`}>
          <span>{props.card.deck === 'chance' ? '机会' : '公益'}</span>
          {props.card.text}
        </blockquote>
      )}
      {props.busy && <p className="quiet">骰子还在转。</p>}
      {!props.busy && game.phase === 'ended' && yours === false && props.game.winnerId === youId && null}
      {!props.busy && game.phase !== 'ended' && (
        <div className="actions">
          {yours && game.phase === 'pre-roll' && you?.inJail && (
            <>
              <button className="solid" type="button" onClick={() => props.onAction({ type: 'jail-pay' })}>交 $50 出来</button>
              <button type="button" disabled={!you.heldCards.length} onClick={() => props.onAction({ type: 'jail-card' })}>用免罪卡</button>
              <button type="button" onClick={() => props.onAction({ type: 'jail-roll' })}>赌一把双骰</button>
            </>
          )}
          {yours && game.phase === 'pre-roll' && !you?.inJail && (
            <button className="solid big" type="button" onClick={() => props.onAction({ type: 'roll' })}>掷骰子</button>
          )}
          {yours && game.phase === 'post-roll' && game.extraRoll && (
            <button className="solid big" type="button" onClick={() => props.onAction({ type: 'roll' })}>再掷一次</button>
          )}
          {yours && game.phase === 'post-roll' && !game.extraRoll && (
            <button className="solid" type="button" onClick={() => props.onAction({ type: 'end-turn' })}>这回合结束</button>
          )}
          {yours && game.phase === 'buy' && space && (
            <>
              <button className="solid" type="button" disabled={(you?.money || 0) < (space.price || 0)} onClick={() => props.onAction({ type: 'buy' })}>
                花 {usd(space.price || 0)} 买下{space.short}
              </button>
              <button type="button" onClick={() => props.onAction({ type: 'decline' })}>{game.rules.auction ? '不买，拿去拍卖' : '不买了'}</button>
            </>
          )}
          {game.phase === 'auction' && auction && (
            <div className="auction">
              <p>{space?.name} · 现在 {auction.highBid ? usd(auction.highBid) : '还没人喊'}</p>
              {game.players.find((p) => p.id === auction.turnId)?.controllerId === youId ? (
                <div className="join-row">
                  <input
                    type="number"
                    min={auction.highBid + 1}
                    value={props.bid}
                    onChange={(event) => props.setBid(Number(event.target.value))}
                  />
                  <button className="solid" type="button" onClick={() => props.onAction({ type: 'bid', amount: props.bid })}>出价</button>
                  <button type="button" onClick={() => props.onAction({ type: 'pass' })}>不要</button>
                </div>
              ) : (
                <p className="quiet">等 {game.players.find((p) => p.id === auction.turnId)?.name} 喊价。</p>
              )}
            </div>
          )}
          {game.phase === 'debt' && debt && (
            <div className="auction">
              <p>{debtor?.name} 要付 {usd(debt.amount)}（{debt.reason}）</p>
              {owing && (
                <>
                  <button className="solid" type="button" disabled={(debtor?.money || 0) < debt.amount} onClick={() => props.onAction({ type: 'pay-debt' })}>付掉</button>
                  <button type="button" onClick={() => props.onAction({ type: 'bankrupt' })}>破产</button>
                  <p className="quiet">钱不够的话，先在右边卖房或抵押。</p>
                </>
              )}
            </div>
          )}
          {game.trade && game.players.some((p) => p.controllerId === youId && (p.id === game.trade?.from || p.id === game.trade?.to)) && (
            <TradeNotice game={game} youId={youId} onAction={props.onAction} />
          )}
          {offline && (
            <button type="button" onClick={() => props.onAction({ type: 'skip-offline' })}>这人掉线了，先跳过</button>
          )}
        </div>
      )}
      {game.phase === 'ended' && props.game.players.length > 0 && (
        <p className="quiet">房主可以在右边解散，回房间再来一局。</p>
      )}
      {props.error && <p className="error">{props.error}</p>}
    </div>
  )
}

function TradeNotice({ game, youId, onAction }: { game: GameState; youId: string; onAction: (a: Action) => void }) {
  const trade = game.trade
  if (!trade) return null
  const from = game.players.find((p) => p.id === trade.from)
  const to = game.players.find((p) => p.id === trade.to)
  const names = (ids: number[]) => ids.map((id) => SPACES[id]?.short).filter(Boolean).join('、') || '没地'
  return (
    <div className="trade-note">
      <p>{from?.name} 想跟 {to?.name} 换</p>
      <p>拿出 {usd(trade.offer.money)} · {names(trade.offer.spaceIds)}</p>
      <p>想要 {usd(trade.want.money)} · {names(trade.want.spaceIds)}</p>
      {to?.controllerId === youId && (
        <div className="row">
          <button className="solid" type="button" onClick={() => onAction({ type: 'respond-trade', accept: true })}>接受</button>
          <button type="button" onClick={() => onAction({ type: 'respond-trade', accept: false })}>拒绝</button>
        </div>
      )}
      {from?.controllerId === youId && <button type="button" onClick={() => onAction({ type: 'cancel-trade' })}>算了</button>}
    </div>
  )
}

function Portfolio({ game, youId, onPick }: { game: GameState; youId: string; onPick: (id: number) => void }) {
  const mine = game.players.filter((player) => player.controllerId === youId && !player.bankrupt)
  return (
    <div className="portfolio">
      {mine.map((player) => {
        const owned = SPACES.filter((space) => isDeed(space) && game.plots[space.id]?.ownerId === player.id)
        return (
          <div key={player.id}>
            <h3>{player.name}的地 {owned.length}</h3>
            <div className="chips">
              {owned.map((space) => (
                <button key={space.id} type="button" onClick={() => onPick(space.id)}>
                  {space.short}
                  {game.plots[space.id]?.mortgaged ? '·押' : ''}
                  {(game.plots[space.id]?.houses || 0) > 0 ? `·${game.plots[space.id]!.houses === 5 ? '旅' : game.plots[space.id]!.houses}` : ''}
                </button>
              ))}
              {!owned.length && <span className="quiet">还没买地。</span>}
            </div>
            {player.heldCards.length > 0 && <p className="quiet">免罪卡 {player.heldCards.length} 张</p>}
          </div>
        )
      })}
    </div>
  )
}

function TradeBox(props: {
  open: boolean
  setOpen: (v: boolean) => void
  game: GameState
  youId: string
  tradeTo: string
  setTradeTo: (id: string) => void
  offer: TradePack
  want: TradePack
  setOffer: (pack: TradePack) => void
  setWant: (pack: TradePack) => void
  busy: boolean
  onAction: (action: Action) => void
}) {
  const actor = props.game.players.find((p) => p.id === props.game.currentId && p.controllerId === props.youId)
  const others = props.game.players.filter((p) => p.id !== actor?.id && !p.bankrupt)
  const mine = SPACES.filter((space) => isDeed(space) && actor && props.game.plots[space.id]?.ownerId === actor.id)
  const theirs = SPACES.filter((space) => isDeed(space) && props.game.plots[space.id]?.ownerId === props.tradeTo)
  const myCards = actor?.heldCards ?? []
  const theirCards = props.game.players.find((p) => p.id === props.tradeTo)?.heldCards ?? []
  if (props.game.phase === 'ended') return null
  return (
    <div className="trade-box">
      <button type="button" className="text-button" onClick={() => props.setOpen(!props.open)}>
        {props.open ? '收起' : '换东西'}
      </button>
      {props.open && (
        <div className="trade-form">
          <select value={props.tradeTo} onChange={(event) => props.setTradeTo(event.target.value)}>
            <option value="">跟谁换</option>
            {others.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
          <label>你出的钱 <input type="number" min={0} value={props.offer.money} onChange={(event) => props.setOffer({ ...props.offer, money: Number(event.target.value) })} /></label>
          <div className="chips">
            {mine.map((space) => (
              <label key={space.id}><input type="checkbox" checked={props.offer.spaceIds.includes(space.id)} onChange={() => props.setOffer({ ...props.offer, spaceIds: toggle(props.offer.spaceIds, space.id) })} />{space.short}</label>
            ))}
          </div>
          {myCards.length > 0 && (
            <div className="chips">
              {myCards.map((card) => (
                <label key={card.id}>
                  <input type="checkbox" checked={props.offer.cardIds.includes(card.id)} onChange={() => props.setOffer({ ...props.offer, cardIds: toggleText(props.offer.cardIds, card.id) })} />
                  我的免罪卡
                </label>
              ))}
            </div>
          )}
          <label>你要的钱 <input type="number" min={0} value={props.want.money} onChange={(event) => props.setWant({ ...props.want, money: Number(event.target.value) })} /></label>
          <div className="chips">
            {theirs.map((space) => (
              <label key={space.id}><input type="checkbox" checked={props.want.spaceIds.includes(space.id)} onChange={() => props.setWant({ ...props.want, spaceIds: toggle(props.want.spaceIds, space.id) })} />{space.short}</label>
            ))}
          </div>
          {theirCards.length > 0 && (
            <div className="chips">
              {theirCards.map((card) => (
                <label key={card.id}>
                  <input type="checkbox" checked={props.want.cardIds.includes(card.id)} onChange={() => props.setWant({ ...props.want, cardIds: toggleText(props.want.cardIds, card.id) })} />
                  对方的免罪卡
                </label>
              ))}
            </div>
          )}
          <button
            className="solid"
            type="button"
            disabled={props.busy || !props.tradeTo || (props.game.phase !== 'pre-roll' && props.game.phase !== 'post-roll')}
            onClick={() => props.onAction({ type: 'trade', to: props.tradeTo, offer: props.offer, want: props.want })}
          >
            提出来
          </button>
        </div>
      )}
    </div>
  )
}

function toggle(list: number[], id: number) {
  return list.includes(id) ? list.filter((item) => item !== id) : [...list, id]
}

function toggleText(list: string[], id: string) {
  return list.includes(id) ? list.filter((item) => item !== id) : [...list, id]
}

type ShownCard = { id: string; deck: 'chance' | 'chest'; text: string }
