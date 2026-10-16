import { useEffect, useMemo, useRef, useState } from 'react'
import { characterById, characterTitle } from '@shared/characters.ts'
import { SPACES, isDeed, spaceLabel } from '@shared/board.ts'
import type { Action, DrawState, GameState, Seat, TradePack } from '@shared/types.ts'
import { Board, type Piece } from './Board'
import { useFx } from './fx'
import { useNet } from './net'
import { sfx, unlockAudio } from './sound'
import { useI18n } from './locale'
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
  const phaseRef = useRef<GameState['phase'] | null>(null)
  const { tx, say, toggle } = useI18n()

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
    const unlock = () => unlockAudio()
    window.addEventListener('pointerdown', unlock)
    window.addEventListener('keydown', unlock)
    return () => {
      window.removeEventListener('pointerdown', unlock)
      window.removeEventListener('keydown', unlock)
    }
  }, [])

  useEffect(() => {
    const phase = game?.phase ?? null
    if (phaseRef.current && phaseRef.current !== 'ended' && phase === 'ended') sfx.win()
    phaseRef.current = phase
  }, [game?.phase])

  function act(action: Action) {
    unlockAudio()
    if (action.type === 'buy' || action.type === 'pay-debt' || action.type === 'bid' || action.type === 'jail-pay' || action.type === 'build' || action.type === 'unmortgage') {
      sfx.coin()
    } else if (action.type === 'sell' || action.type === 'mortgage') {
      sfx.tap()
    } else if (action.type === 'decline' || action.type === 'pass' || action.type === 'bankrupt') {
      sfx.thud()
    }
    net.send(action)
  }

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const tag = (event.target as HTMLElement | null)?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA') return
      if ((event.key === 'r' || event.key === 'R') && yourTurn && game && !busy) {
        if (game.phase === 'pre-roll' && !you?.inJail) act({ type: 'roll' })
        if (game.phase === 'post-roll' && game.extraRoll) act({ type: 'roll' })
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
      setCopied('fail')
    }
  }

  return (
    <div className={`shell ${screen}`}>
      <header className="topbar">
        <div className="brand-lockup">
          <strong>Private Monopoly</strong>
        </div>
        <div className="top-meta">
          {snap && <em>{tx('房间', 'Room')} {snap.code}</em>}
          <i className={net.online ? 'dot on' : 'dot'} />
          <button type="button" onClick={() => setRulesOpen(true)}>{tx('玩法', 'Rules')}</button>
          {snap && (
            <button type="button" onClick={() => (game ? setConfirmLeave(true) : net.leave())}>
              {tx('离开', 'Leave')}
            </button>
          )}
          <button type="button" className="lang-toggle" onClick={toggle}>{tx('EN', '中文')}</button>
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
          <h1>{tx('家里的口令', 'House password')}</h1>
          <p>{tx('不是账号，家里人知道就行。', 'Not an account. Anyone in the house knows it.')}</p>
          <input value={gate} onChange={(event) => setGate(event.target.value)} type="password" placeholder={tx('口令', 'Password')} autoFocus />
          <button className="solid" type="submit">{tx('进入', 'Enter')}</button>
          {net.error && <p className="error">{say(net.error)}</p>}
        </form>
      )}

      {screen !== 'gate' && (
        <div className="stage">
          {screen === 'game' && game && you && (
            <aside className="panel left">
              {controlled.length > 1 && <p className="bankline">{tx(`${you.name} 手头的钱`, `${you.name}'s cash`)}</p>}
              <Bills amount={you.money} />
              <p className="bankline">{tx(`银行还剩 ${game.houses} 栋房子 · ${game.hotels} 座旅馆`, `Bank: ${game.houses} houses · ${game.hotels} hotels`)}</p>
              {game.rules.freeParking && <p className="bankline">{tx(`停车奖金 ${usd(game.pot)}`, `Free Parking ${usd(game.pot)}`)}</p>}
              <Log lines={game.log} />
            </aside>
          )}

          <div className="board-slot">
            <Board pieces={pieces} selected={selected} game={game} onSelect={screen === 'game' ? setSelected : undefined}>
              {screen === 'loading' && <p className="quiet">{tx('正在摆桌子……', 'Setting the table…')}</p>}
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
              {screen === 'lobby' && snap?.draw && <DrawCeremony draw={snap.draw} />}
              {screen === 'lobby' && snap && !snap.draw && (
                <Lobby
                  code={snap.code}
                  youId={snap.youId}
                  host={snap.hostId === snap.youId}
                  seats={snap.seats}
                  rules={snap.rules}
                  copied={copied}
                  error={net.error}
                  onCopyCode={() => copy(snap.code, 'code')}
                  onCopyLink={() => copy(`${location.origin}/?room=${snap.code}`, 'link')}
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
                  cardFace={fx.cardFace}
                  cardDeck={fx.cardDeck}
                  notice={fx.notice}
                  busy={busy}
                  error={net.error}
                  bid={bid}
                  setBid={setBid}
                  onAction={act}
                />
              )}
            </Board>
          </div>

          {screen === 'game' && game && youId && (
            <aside className="panel right">
              {selected !== null && <Deed spaceId={selected} game={game} youId={youId} busy={busy} onAction={act} />}
              {selected === null && <p className="hint">{tx('点一格，看地契、盖房或者抵押。', 'Click a space to see the deed, build, or mortgage.')}</p>}
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
                onAction={act}
              />
              {snap?.hostId === youId && (
                <button type="button" className="text-button danger" onClick={() => net.emit('disband')}>
                  {tx('解散这局', 'Disband')}
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
            <h2>{tx('要走了吗？', 'Leave the table?')}</h2>
            <p>{tx('你带的角色会破产离场，别人继续玩。', 'Your characters go bankrupt and leave. The others keep playing.')}</p>
            <div className="row">
              <button type="button" className="solid" onClick={() => net.leave()}>{tx('离开', 'Leave')}</button>
              <button type="button" onClick={() => setConfirmLeave(false)}>{tx('留下', 'Stay')}</button>
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
  const { tx, say } = useI18n()
  return (
    <form
      className="menu"
      onSubmit={(event) => {
        event.preventDefault()
        props.onCreate()
      }}
    >
      <p className="eyebrow">PRIVATE TABLE</p>
      <input value={props.name} onChange={(event) => props.setName(event.target.value)} maxLength={12} placeholder={tx('你的名字', 'Your name')} required />
      <input value={props.roomPassword} onChange={(event) => props.setRoomPassword(event.target.value)} maxLength={32} placeholder={tx('房间密码，没有就留空', 'Room password, leave blank if none')} type="password" />
      <button className="solid big" type="submit">{tx('新建房间', 'New room')}</button>
      <div className="join-row">
        <input
          value={props.code}
          onChange={(event) => props.setCode(event.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 4))}
          placeholder={tx('房间号', 'Room code')}
          aria-label={tx('房间号', 'Room code')}
        />
        <button
          type="button"
          onClick={props.onJoin}
        >
          {tx('加入', 'Join')}
        </button>
      </div>
      {props.error && <p className="error">{say(props.error)}</p>}
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
  const { tx, say } = useI18n()
  const picked = props.seats.reduce((sum, seat) => sum + seat.characterIds.length, 0)
  const ready = props.seats.length >= 1 && props.seats.every((seat) => seat.characterIds.length > 0 && seat.connected)
  const copied = props.copied === 'code' ? tx('房间号已复制', 'Room code copied') : props.copied === 'link' ? tx('链接已复制', 'Link copied') : props.copied === 'fail' ? tx('复制失败', 'Copy failed') : ''
  return (
    <div className="menu lobby">
      <p className="eyebrow">ROOM</p>
      <h1>{props.code}</h1>
      <div className="row">
        <button type="button" onClick={props.onCopyCode}>{tx('复制房号', 'Copy code')}</button>
        <button type="button" onClick={props.onCopyLink}>{tx('复制链接', 'Copy link')}</button>
      </div>
      {copied && <p className="quiet">{copied}</p>}
      <p className="quiet">{tx('点下面的角色，想带几个就点几个。再点一下就取消。', 'Tap the characters below. Tap again to drop one.')}</p>
      <ul className="seat-list">
        {props.seats.map((seat) => {
          const names = seat.characterIds.map((id) => {
            const character = characterById(id)
            return character ? characterTitle(character) : ''
          }).filter(Boolean)
          const tag = names.length ? names.join(tx('、', ', ')) : tx('还没选', 'No character yet')
          return (
            <li key={seat.id}>
              <span>{seat.name}</span>
              <em>{tag}{seat.connected ? '' : tx(' · 掉线', ' · offline')}</em>
              {props.host && seat.id !== props.youId && <button type="button" onClick={() => props.onKick(seat.id)}>{tx('请出去', 'Remove')}</button>}
            </li>
          )
        })}
      </ul>
      <div className="rules-toggles">
        <label>
          <span>{tx('开局的钱', 'Starting cash')}</span>
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
          <span>{tx('不买就拿去拍卖', 'Auction if unbought')}</span>
        </label>
        <label>
          <input type="checkbox" checked={props.rules.freeParking} disabled={!props.host} onChange={(event) => props.onRules({ freeParking: event.target.checked })} />
          <span>{tx('停车格发奖金', 'Free Parking pot')}</span>
        </label>
      </div>
      {props.host ? (
        <button className="solid big" type="button" disabled={!ready} onClick={props.onStart}>
          {picked < 2 ? tx('抽签，然后随便走走', 'Draw lots, then wander') : tx('抽签开局', 'Draw lots and start')}
        </button>
      ) : (
        <p className="quiet">{tx('等房主开始。', 'Waiting for the host.')}</p>
      )}
      {props.error && <p className="error">{say(props.error)}</p>}
    </div>
  )
}

function DrawCeremony({ draw }: { draw: DrawState }) {
  const [shown, setShown] = useState(0)
  const [ready, setReady] = useState(false)
  useEffect(() => {
    sfx.shuffle()
    const timers = draw.people.map((_, index) => window.setTimeout(() => {
      sfx.reveal()
      setShown(index + 1)
    }, draw.revealStartMs + index * draw.revealStepMs))
    timers.push(window.setTimeout(() => {
      sfx.coin()
      setReady(true)
    }, draw.revealStartMs + draw.people.length * draw.revealStepMs))
    return () => timers.forEach((timer) => window.clearTimeout(timer))
  }, [draw])
  const { tx } = useI18n()
  return (
    <div className="menu draw">
      <p className="eyebrow">{tx('抽签', 'LOTS')}</p>
      <h1>{tx('号小的先走', 'Lowest number goes first')}</h1>
      <p className="quiet">{tx('一个人带了几个角色，会跟别人岔开轮流，不会连着走。', 'If you play several characters, their turns are spaced apart.')}</p>
      <ol className="lots">
        {draw.people.map((person, index) => {
          const open = index < shown
          return (
            <li key={person.seatId} className={open ? 'open' : ''}>
              <b>{open ? person.lot : '?'}</b>
              <strong>{person.name}</strong>
              <em>{open ? person.names.join(tx('、', ', ')) : tx('签还盖着', 'Still covered')}</em>
            </li>
          )
        })}
      </ol>
      {ready && <p className="order-line">{tx('顺序：', 'Order: ')}{draw.order.map((item) => item.name).join(' → ')}</p>}
    </div>
  )
}

function Center(props: {
  game: GameState
  youId: string
  dice: [number, number] | null
  rolling: boolean
  card: ShownCard | null
  cardFace: 'back' | 'open' | null
  cardDeck: 'chance' | 'chest' | null
  notice: string | null
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
  const { tx, say, lang } = useI18n()
  const place = spaceLabel(space, lang)
  const placeShort = spaceLabel(space, lang, true)
  return (
    <div className="hud">
      <DicePair dice={props.dice} rolling={props.rolling} />
      <p className="turn-line">
        {game.phase === 'ended'
          ? tx(`${game.players.find((p) => p.id === game.winnerId)?.name || '有人'} 赢了`, `${game.players.find((p) => p.id === game.winnerId)?.name || 'Someone'} wins`)
          : tx(`轮到 ${current?.name || ''}`, `${current?.name || ''}'s turn`)}
      </p>
      {props.cardFace === 'back' && (
        <div className={`drawn is-back ${props.cardDeck || 'chance'}`} aria-hidden="true">
          <span>{props.cardDeck === 'chest' ? tx('公益', 'Chest') : tx('机会', 'Chance')}</span>
          <b>？</b>
        </div>
      )}
      {props.card && props.cardFace !== 'back' && (
        <blockquote className={`drawn is-open ${props.card.deck}`}>
          <span>{props.card.deck === 'chance' ? tx('机会', 'Chance') : tx('公益', 'Chest')}</span>
          {lang === 'en' && props.card.en ? props.card.en : props.card.text}
        </blockquote>
      )}
      {props.notice === 'salary' && <p className="landing">{tx(`经过起点，领了 $${game.rules.salary}`, `Passed GO and collected $${game.rules.salary}`)}</p>}
      {props.notice === 'jail' && <p className="landing">{tx('进了监狱', 'Went to jail')}</p>}
      {props.rolling && <p className="quiet">{tx('骰子还在转。', 'The dice are still rolling.')}</p>}
      {!props.busy && game.phase === 'ended' && yours === false && props.game.winnerId === youId && null}
      {!props.busy && game.phase !== 'ended' && (
        <div className="actions">
          {yours && game.phase === 'pre-roll' && you?.inJail && (
            <>
              <button className="solid" type="button" onClick={() => props.onAction({ type: 'jail-pay' })}>{tx('交 $50 出来', 'Pay $50 to leave')}</button>
              <button type="button" disabled={!you.heldCards.length} onClick={() => props.onAction({ type: 'jail-card' })}>{tx('用免罪卡', 'Use jail card')}</button>
              <button type="button" onClick={() => props.onAction({ type: 'jail-roll' })}>{tx('赌一把双骰', 'Try for doubles')}</button>
            </>
          )}
          {yours && game.phase === 'pre-roll' && !you?.inJail && (
            <button className="solid big" type="button" onClick={() => props.onAction({ type: 'roll' })}>{tx('掷骰子', 'Roll')}</button>
          )}
          {yours && game.phase === 'post-roll' && game.extraRoll && (
            <button className="solid big" type="button" onClick={() => props.onAction({ type: 'roll' })}>{tx('再掷一次', 'Roll again')}</button>
          )}
          {yours && game.phase === 'post-roll' && !game.extraRoll && (
            <button className="solid" type="button" onClick={() => props.onAction({ type: 'end-turn' })}>{tx('这回合结束', 'End turn')}</button>
          )}
          {yours && game.phase === 'buy' && space && (
            <>
              <button className="solid" type="button" disabled={(you?.money || 0) < (space.price || 0)} onClick={() => props.onAction({ type: 'buy' })}>
                {tx(`花 ${usd(space.price || 0)} 买下${placeShort}`, `Buy ${placeShort} for ${usd(space.price || 0)}`)}
              </button>
              <button type="button" onClick={() => props.onAction({ type: 'decline' })}>{game.rules.auction ? tx('不买，拿去拍卖', 'Auction it') : tx('不买了', 'Pass')}</button>
            </>
          )}
          {game.phase === 'auction' && auction && (
            <div className="auction">
              <p>{place} · {tx('现在', 'now')} {auction.highBid ? usd(auction.highBid) : tx('还没人喊', 'no bids yet')}</p>
              {game.players.find((p) => p.id === auction.turnId)?.controllerId === youId ? (
                <div className="join-row">
                  <input
                    type="number"
                    min={auction.highBid + 1}
                    value={props.bid}
                    onChange={(event) => props.setBid(Number(event.target.value))}
                  />
                  <button className="solid" type="button" onClick={() => props.onAction({ type: 'bid', amount: props.bid })}>{tx('出价', 'Bid')}</button>
                  <button type="button" onClick={() => props.onAction({ type: 'pass' })}>{tx('不要', 'Pass')}</button>
                </div>
              ) : (
                <p className="quiet">{tx(`等 ${game.players.find((p) => p.id === auction.turnId)?.name} 喊价。`, `Waiting for ${game.players.find((p) => p.id === auction.turnId)?.name} to bid.`)}</p>
              )}
            </div>
          )}
          {game.phase === 'debt' && debt && (
            <div className="auction">
              <p>{tx(`${debtor?.name} 要付 ${usd(debt.amount)}（${debt.reason}）`, `${debtor?.name} owes ${usd(debt.amount)} (${say(debt.reason)})`)}</p>
              {owing && (
                <>
                  <button className="solid" type="button" disabled={(debtor?.money || 0) < debt.amount} onClick={() => props.onAction({ type: 'pay-debt' })}>{tx('付掉', 'Pay')}</button>
                  <button type="button" onClick={() => props.onAction({ type: 'bankrupt' })}>{tx('破产', 'Bankrupt')}</button>
                  <p className="quiet">{tx('钱不够的话，先在右边卖房或抵押。', 'If you are short, sell or mortgage on the right.')}</p>
                </>
              )}
            </div>
          )}
          {game.trade && game.players.some((p) => p.controllerId === youId && (p.id === game.trade?.from || p.id === game.trade?.to)) && (
            <TradeNotice game={game} youId={youId} onAction={props.onAction} />
          )}
          {offline && (
            <button type="button" onClick={() => props.onAction({ type: 'skip-offline' })}>{tx('这人掉线了，先跳过', 'They are offline. Skip')}</button>
          )}
        </div>
      )}
      {game.phase === 'ended' && props.game.players.length > 0 && (
        <p className="quiet">{tx('房主可以在右边解散，回房间再来一局。', 'The host can disband on the right and start another game.')}</p>
      )}
      {props.error && <p className="error">{say(props.error)}</p>}
    </div>
  )
}

function TradeNotice({ game, youId, onAction }: { game: GameState; youId: string; onAction: (a: Action) => void }) {
  const trade = game.trade
  if (!trade) return null
  const from = game.players.find((p) => p.id === trade.from)
  const to = game.players.find((p) => p.id === trade.to)
  const { tx, lang } = useI18n()
  const names = (ids: number[]) => ids.map((id) => spaceLabel(SPACES[id], lang, true)).filter(Boolean).join(tx('、', ', ')) || tx('没地', 'no property')
  return (
    <div className="trade-note">
      <p>{tx(`${from?.name} 想跟 ${to?.name} 换`, `${from?.name} wants to trade with ${to?.name}`)}</p>
      <p>{tx('拿出', 'Offers')} {usd(trade.offer.money)} · {names(trade.offer.spaceIds)}</p>
      <p>{tx('想要', 'Wants')} {usd(trade.want.money)} · {names(trade.want.spaceIds)}</p>
      {to?.controllerId === youId && (
        <div className="row">
          <button className="solid" type="button" onClick={() => onAction({ type: 'respond-trade', accept: true })}>{tx('接受', 'Accept')}</button>
          <button type="button" onClick={() => onAction({ type: 'respond-trade', accept: false })}>{tx('拒绝', 'Decline')}</button>
        </div>
      )}
      {from?.controllerId === youId && <button type="button" onClick={() => onAction({ type: 'cancel-trade' })}>{tx('算了', 'Cancel')}</button>}
    </div>
  )
}

function Portfolio({ game, youId, onPick }: { game: GameState; youId: string; onPick: (id: number) => void }) {
  const { tx, lang } = useI18n()
  const mine = game.players.filter((player) => player.controllerId === youId && !player.bankrupt)
  return (
    <div className="portfolio">
      {mine.map((player) => {
        const owned = SPACES.filter((space) => isDeed(space) && game.plots[space.id]?.ownerId === player.id)
        return (
          <div key={player.id}>
            <h3>{tx(`${player.name}的地`, `${player.name}'s lots`)} {owned.length}</h3>
            <div className="chips">
              {owned.map((space) => (
                <button key={space.id} type="button" onClick={() => onPick(space.id)}>
                  {spaceLabel(space, lang, true)}
                  {game.plots[space.id]?.mortgaged ? tx('·押', '·M') : ''}
                  {(game.plots[space.id]?.houses || 0) > 0 ? `·${game.plots[space.id]!.houses === 5 ? tx('旅', 'H') : game.plots[space.id]!.houses}` : ''}
                </button>
              ))}
              {!owned.length && <span className="quiet">{tx('还没买地。', 'No property yet.')}</span>}
            </div>
            {player.heldCards.length > 0 && <p className="quiet">{tx(`免罪卡 ${player.heldCards.length} 张`, `${player.heldCards.length} jail card${player.heldCards.length === 1 ? '' : 's'}`)}</p>}
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
  const { tx, lang } = useI18n()
  if (props.game.phase === 'ended') return null
  return (
    <div className="trade-box">
      <button type="button" className="text-button" onClick={() => props.setOpen(!props.open)}>
        {props.open ? tx('收起', 'Close') : tx('换东西', 'Trade')}
      </button>
      {props.open && (
        <div className="trade-form">
          <select value={props.tradeTo} onChange={(event) => props.setTradeTo(event.target.value)}>
            <option value="">{tx('跟谁换', 'Trade with')}</option>
            {others.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
          <label>{tx('你出的钱', 'You offer')} <input type="number" min={0} value={props.offer.money} onChange={(event) => props.setOffer({ ...props.offer, money: Number(event.target.value) })} /></label>
          <div className="chips">
            {mine.map((space) => (
              <label key={space.id}><input type="checkbox" checked={props.offer.spaceIds.includes(space.id)} onChange={() => props.setOffer({ ...props.offer, spaceIds: toggle(props.offer.spaceIds, space.id) })} />{spaceLabel(space, lang, true)}</label>
            ))}
          </div>
          {myCards.length > 0 && (
            <div className="chips">
              {myCards.map((card) => (
                <label key={card.id}>
                  <input type="checkbox" checked={props.offer.cardIds.includes(card.id)} onChange={() => props.setOffer({ ...props.offer, cardIds: toggleText(props.offer.cardIds, card.id) })} />
                  {tx('我的免罪卡', 'My jail card')}
                </label>
              ))}
            </div>
          )}
          <label>{tx('你要的钱', 'You want')} <input type="number" min={0} value={props.want.money} onChange={(event) => props.setWant({ ...props.want, money: Number(event.target.value) })} /></label>
          <div className="chips">
            {theirs.map((space) => (
              <label key={space.id}><input type="checkbox" checked={props.want.spaceIds.includes(space.id)} onChange={() => props.setWant({ ...props.want, spaceIds: toggle(props.want.spaceIds, space.id) })} />{spaceLabel(space, lang, true)}</label>
            ))}
          </div>
          {theirCards.length > 0 && (
            <div className="chips">
              {theirCards.map((card) => (
                <label key={card.id}>
                  <input type="checkbox" checked={props.want.cardIds.includes(card.id)} onChange={() => props.setWant({ ...props.want, cardIds: toggleText(props.want.cardIds, card.id) })} />
                  {tx('对方的免罪卡', 'Their jail card')}
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
            {tx('提出来', 'Offer')}
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

type ShownCard = { id: string; deck: 'chance' | 'chest'; text: string; en?: string }
