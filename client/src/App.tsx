import { useEffect, useMemo, useRef, useState } from 'react'
import { characterById, characterTitle } from '@shared/characters.ts'
import { isDeed, spaceLabel } from '@shared/board.ts'
import { isTradeWindow, purchasePrice } from '@shared/rules.ts'
import type { Action, MapId, DrawState, GameState, Seat, TradePack } from '@shared/types.ts'
import { Board, type Piece } from './Board'
import { Avatar } from './avatars'
import { TradeBox } from './TradeBox'
import { useFx } from './fx'
import { MoneyFeedback, useMoneyFeedback } from './MoneyFeedback'
import { useNet } from './net'
import { sfx, unlockAudio } from './sound'
import { BoardMapProvider, useI18n } from './locale'
import { Bills, Deed, DicePair, Drawer, Log, Rules, debtOf, usd } from './widgets'

const EMPTY: TradePack = { money: 0, spaceIds: [], cardIds: [] }

export function App() {
  const net = useNet()
  const [previewMap, setPreviewMap] = useState<MapId>('china')
  const mapId = net.snap?.game?.rules.mapId ?? net.snap?.rules.mapId ?? previewMap
  return (
    <BoardMapProvider value={mapId}>
      <AppContent mapId={mapId} setPreviewMap={setPreviewMap} />
    </BoardMapProvider>
  )
}

function AppContent({ mapId, setPreviewMap }: { mapId: MapId; setPreviewMap: (mapId: MapId) => void }) {
  const net = useNet()
  const fx = useFx(net.snap)
  const cash = useMoneyFeedback(net.snap, fx.animating)
  const [name, setName] = useState('')
  const [code, setCode] = useState(() => new URLSearchParams(location.search).get('room')?.toUpperCase() || '')
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
  const [confirmSurrender, setConfirmSurrender] = useState(false)
  const phaseRef = useRef<GameState['phase'] | null>(null)
  const { tx, say, toggle } = useI18n()

  const snap = net.snap
  const game = snap?.game ?? null
  const youId = snap?.youId ?? null
  const screen = !net.metaReady ? 'loading' : net.siteRequired && !net.sitePassword ? 'gate' : net.booting ? 'loading' : !snap ? 'home' : game ? 'game' : 'lobby'
  const busy = net.pending || fx.animating || cash.pending
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
    setConfirmLeave(false)
    setConfirmSurrender(false)
  }, [snap?.code, game !== null])

  useEffect(() => {
    setSelected(game?.players.find((player) => player.id === game.currentId)?.position ?? null)
  }, [snap?.code, game !== null])

  useEffect(() => {
    if (fx.arrival) setSelected(fx.arrival.spaceId)
  }, [fx.arrival])

  useEffect(() => {
    setTradeOpen(false)
    setTradeTo('')
    setOffer(EMPTY)
    setWant(EMPTY)
  }, [snap?.code, game?.currentId])

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
          <h1>{tx('访问密码', 'Access password')}</h1>
          <p>{tx('输入共享密码，和朋友一起开局。', 'Enter the shared password to play with friends.')}</p>
          <input value={gate} onChange={(event) => setGate(event.target.value)} type="password" placeholder={tx('访问密码', 'Password')} autoFocus />
          <button className="solid" type="submit">{tx('进入', 'Enter')}</button>
          {net.error && <p className="error">{say(net.error)}</p>}
        </form>
      )}

      {screen !== 'gate' && (
        <div className="stage">
          {screen === 'game' && game && you && (
            <aside className="panel left">
              {controlled.length > 1 && <p className="bankline">{tx(`${you.name} 的现金`, `${you.name}'s cash`)}</p>}
              <Bills amount={you.money} />
              {game.rules.freeParking && <p className="bankline">{tx(`免费停车奖金 ${usd(game.pot)}`, `Free Parking pot: ${usd(game.pot)}`)}</p>}
              <Log lines={game.log} />
            </aside>
          )}

          <div className="board-slot">
            <Board pieces={pieces} selected={selected} game={game} onSelect={screen === 'game' ? setSelected : undefined}>
              {screen === 'loading' && <p className="quiet">{tx('正在加载……', 'Getting the game ready…')}</p>}
              {screen === 'home' && (
                <HomeMenu
                  mapId={mapId}
                  onMapChange={setPreviewMap}
                  name={name}
                  setName={setName}
                  code={code}
                  setCode={setCode}
                  error={net.error}
                  onCreate={() => net.create(name.trim(), mapId)}
                  onJoin={() => net.join(code.trim(), name.trim())}
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
                  money={cash.current}
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
              {selected === null && <p className="hint">{tx('点击棋盘格，查看地契、建造或抵押房产。', 'Select a space to view its deed, build, or mortgage it.')}</p>}
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
                  {tx('结束本局', 'End game')}
                </button>
              )}
              {game.phase !== 'ended' && controlled.some((player) => !player.bankrupt) && (
                <button type="button" className="text-button danger" disabled={net.pending} onClick={() => setConfirmSurrender(true)}>{tx('认输', 'Concede')}</button>
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
      {confirmSurrender && game && game.phase !== 'ended' && controlled.some((player) => !player.bankrupt) && (
        <div className="modal" role="dialog" aria-modal="true" aria-labelledby="surrender-title">
          <article className="booklet confirm">
            <h2 id="surrender-title">{tx('确定认输吗？', 'Concede this game?')}</h2>
            <p>{tx('你控制的所有角色将退出本局，剩余地产恢复无主状态。你可以留在房间观战。', 'All characters you control will leave this game. Their remaining properties become unowned. You can stay in the room to watch.')}</p>
            <div className="row">
              <button type="button" className="solid danger" disabled={net.pending} onClick={() => { setConfirmSurrender(false); act({ type: 'surrender' }) }}>{tx('确认认输', 'Concede')}</button>
              <button type="button" onClick={() => setConfirmSurrender(false)}>{tx('继续游戏', 'Keep playing')}</button>
            </div>
          </article>
        </div>
      )}
      {confirmLeave && game && (
        <div className="modal" role="dialog">
          <article className="booklet confirm">
            <h2>{tx('要走了吗？', 'Leave the table?')}</h2>
            <p>{tx('离开后，你控制的所有角色将破产退出，其他玩家继续游戏。', 'All characters you control will go bankrupt. The other players will keep playing.')}</p>
            <div className="row">
              <button type="button" className="solid" onClick={() => { setConfirmLeave(false); net.leave() }}>{tx('离开', 'Leave')}</button>
              <button type="button" onClick={() => setConfirmLeave(false)}>{tx('留下', 'Stay')}</button>
            </div>
          </article>
        </div>
      )}
    </div>
  )
}

function HomeMenu(props: {
  mapId: MapId
  onMapChange: (mapId: MapId) => void
  name: string
  setName: (v: string) => void
  code: string
  setCode: (v: string) => void
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
      <p className="eyebrow">{tx('好友牌桌', 'PLAY WITH FRIENDS')}</p>
      <input value={props.name} onChange={(event) => props.setName(event.target.value)} maxLength={12} placeholder={tx('你的名字', 'Your name')} required />
      <MapPicker value={props.mapId} onChange={props.onMapChange} />
      <button className="solid big" type="submit">{tx('新建房间', 'Create room')}</button>
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

function MapPicker({ value, onChange, disabled = false }: {
  value: MapId; onChange: (mapId: MapId) => void; disabled?: boolean
}) {
  const { tx } = useI18n()
  return (
    <label className="map-picker">
      <span>{tx('游戏地图', 'Game map')}</span>
      <select aria-label={tx('游戏地图', 'Game map')} value={value} disabled={disabled} onChange={(event) => onChange(event.target.value as MapId)}>
        <option value="china">{tx('中国地图', 'China')}</option>
        <option value="usa">{tx('美国地图', 'United States')}</option>
      </select>
    </label>
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
      <p className="eyebrow">{tx('房间', 'ROOM')}</p>
      <h1>{props.code}</h1>
      <div className="row">
        <button type="button" onClick={props.onCopyCode}>{tx('复制房间号', 'Copy code')}</button>
        <button type="button" onClick={props.onCopyLink}>{tx('复制链接', 'Copy link')}</button>
      </div>
      {copied && <p className="quiet">{copied}</p>}
      <p className="quiet">{tx('点击下方选择角色，可选择多个；再次点击即可取消。', 'Choose one or more characters below. Select again to deselect.')}</p>
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
              {props.host && seat.id !== props.youId && <button type="button" onClick={() => props.onKick(seat.id)}>{tx('移出房间', 'Remove')}</button>}
            </li>
          )
        })}
      </ul>
      <div className="rules-toggles">
        <MapPicker value={props.rules.mapId} disabled={!props.host} onChange={(mapId) => props.onRules({ mapId })} />
        <label>
          <span>{tx('初始资金', 'Starting cash')}</span>
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
          <span>{tx('未购买的房产自动拍卖', 'Auction unpurchased properties')}</span>
        </label>
        <label>
          <input type="checkbox" checked={props.rules.freeParking} disabled={!props.host} onChange={(event) => props.onRules({ freeParking: event.target.checked })} />
          <span>{tx('启用免费停车奖金', 'Free Parking pot')}</span>
        </label>
      </div>
      {props.host ? (
        <button className="solid big" type="button" disabled={!ready} onClick={props.onStart}>
          {picked < 2 ? tx('抽签开始单人游戏', 'Start solo game') : tx('抽签开局', 'Draw for turn order')}
        </button>
      ) : (
        <p className="quiet">{tx('等待房主开始游戏。', 'Waiting for the host to start.')}</p>
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
      <p className="eyebrow">{tx('抽签', 'TURN ORDER')}</p>
      <h1>{tx('按抽签号码从小到大行动', 'Lowest number goes first')}</h1>
      <p className="quiet">{tx('如果一人控制多个角色，会与其他玩家的角色交替行动。', 'If you control multiple characters, their turns alternate with other players’ characters.')}</p>
      <ol className="lots">
        {draw.people.map((person, index) => {
          const open = index < shown
          return (
            <li key={person.seatId} className={open ? 'open' : ''}>
              <b>{open ? person.lot : '?'}</b>
              <strong>{person.name}</strong>
              <em>{open ? person.names.join(tx('、', ', ')) : tx('等待揭晓', 'Waiting to reveal')}</em>
            </li>
          )
        })}
      </ol>
      {ready && <p className="order-line">{tx('顺序：', 'Order: ')}{draw.order.map((item, index) => <span className="order-character" key={item.id}>{index > 0 && ' → '}<Avatar id={item.characterId} size={24} />{item.name}</span>)}</p>}
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
  money: ReturnType<typeof useMoneyFeedback>['current']
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
  const offline = current && !current.connected
  const { tx, say, lang, spaces } = useI18n()
  const space = spaces[game.buySpaceId ?? auction?.spaceId ?? -1]
  const buyCost = space ? purchasePrice(game, game.currentId, space.id) : 0
  const place = spaceLabel(space, lang)
  const placeShort = spaceLabel(space, lang, true)
  return (
    <div className="hud">
      <DicePair dice={props.dice} rolling={props.rolling} />
      <p className="turn-line">
        <Avatar id={(game.phase === 'ended' ? game.players.find((p) => p.id === game.winnerId) : current)?.characterId ?? null} size={28} />
        <span>{game.phase === 'ended'
          ? tx(`${game.players.find((p) => p.id === game.winnerId)?.name || '有人'} 赢了`, `${game.players.find((p) => p.id === game.winnerId)?.name || 'Someone'} wins`)
          : tx(`轮到 ${current?.name || ''}`, `${current?.name || ''}'s turn`)}</span>
      </p>
      {props.money && <MoneyFeedback batch={props.money} game={game} />}
      {!props.money && props.cardFace === 'back' && (
        <div className={`drawn is-back ${props.cardDeck || 'chance'}`} aria-hidden="true">
          <span>{props.cardDeck === 'chest' ? tx('公益金', 'Chest') : tx('机会', 'Chance')}</span>
          <b>？</b>
        </div>
      )}
      {!props.money && props.card && props.cardFace !== 'back' && (
        <blockquote className={`drawn is-open ${props.card.deck}`}>
          <span>{props.card.deck === 'chance' ? tx('机会', 'Chance') : tx('公益金', 'Chest')}</span>
          {lang === 'en' && props.card.en ? props.card.en : props.card.text}
        </blockquote>
      )}
      {props.notice === 'salary' && <p className="landing">{tx(`经过起点，领了 $${game.rules.salary}`, `Passed GO and collected $${game.rules.salary}`)}</p>}
      {props.notice === 'jail' && <p className="landing">{tx('进了监狱', 'Went to jail')}</p>}
      {props.rolling && <p className="quiet">{tx('正在掷骰子……', 'Rolling…')}</p>}
      {!props.busy && game.phase === 'ended' && yours === false && props.game.winnerId === youId && null}
      {!props.busy && game.phase !== 'ended' && (
        <div className="actions">
          {yours && game.phase === 'hop' && (
            <div className="hop-choice">
              <p>{tx(`Tutu 可以再向前跳一格，剩余 ${you?.hopUses ?? 0} 次。`, `Tutu can hop one more space. ${you?.hopUses ?? 0} uses left.`)}</p>
              <button className="solid" type="button" onClick={() => props.onAction({ type: 'hop' })}>{tx('发动技能：向前跳一格', 'Use skill: hop forward')}</button>
              <button type="button" onClick={() => props.onAction({ type: 'skip-hop' })}>{tx('留在这里，保留技能', 'Stay here and save the skill')}</button>
            </div>
          )}
          {yours && game.phase === 'pre-roll' && you?.inJail && (
            <>
              <button className="solid" type="button" onClick={() => props.onAction({ type: 'jail-pay' })}>{tx('支付 $50 出狱', 'Pay $50 bail')}</button>
              <button type="button" disabled={!you.heldCards.length} onClick={() => props.onAction({ type: 'jail-card' })}>{tx('使用免费出狱卡', 'Use Get Out of Jail Free card')}</button>
              <button type="button" onClick={() => props.onAction({ type: 'jail-roll' })}>{tx('尝试掷出相同点数', 'Try for doubles')}</button>
            </>
          )}
          {yours && game.phase === 'pre-roll' && !you?.inJail && (
            <button className="solid big" type="button" onClick={() => props.onAction({ type: 'roll' })}>{tx('掷骰子', 'Roll')}</button>
          )}
          {yours && game.phase === 'post-roll' && game.extraRoll && (
            <button className="solid big" type="button" onClick={() => props.onAction({ type: 'roll' })}>{tx('再掷一次', 'Roll again')}</button>
          )}
          {yours && isTradeWindow(game) && (
            <>
              {!game.trade && <p className="trade-hint">{tx('现在可以选择发起交易！', 'You can choose to trade now!')}</p>}
              <button className="solid" type="button" disabled={Boolean(game.trade)} onClick={() => props.onAction({ type: 'end-turn' })}>{tx('结束回合', 'End turn')}</button>
            </>
          )}
          {yours && game.phase === 'buy' && space && (
            <>
              <button className="solid" type="button" disabled={(you?.money || 0) < buyCost} onClick={() => props.onAction({ type: 'buy' })}>
                {tx(`花 ${usd(buyCost)} 买下${placeShort}`, `Buy ${placeShort} for ${usd(buyCost)}`)}
              </button>
              <button type="button" onClick={() => props.onAction({ type: 'decline' })}>{game.rules.auction ? tx('放弃购买，开始拍卖', 'Auction it') : tx('放弃购买', 'Pass')}</button>
            </>
          )}
          {game.phase === 'auction' && auction && (
            <div className="auction">
              {auction.sellerId && <p className="quiet">{tx(`${game.players.find((p) => p.id === auction.sellerId)?.name} 正在拍卖房产筹款，所得归卖家。`, `${game.players.find((p) => p.id === auction.sellerId)?.name} is selling this property. Proceeds go to the seller.`)}</p>}
              {auction.sellerId && game.plots[auction.spaceId]?.mortgaged && <p className="quiet">{tx('此房产已抵押，买家另付抵押额 10% 的利息，抵押状态保留。', 'This property stays mortgaged. The buyer also pays 10% of its mortgage value in interest.')}</p>}
              <p>{place} · {tx('当前出价', 'High bid:')} {auction.highBid ? usd(auction.highBid) : tx('暂无出价', 'no bids yet')}</p>
              {game.players.find((p) => p.id === auction.turnId)?.controllerId === youId ? (
                <div className="join-row">
                  <input
                    type="number"
                    min={auction.highBid + 1}
                    value={props.bid}
                    onChange={(event) => props.setBid(Number(event.target.value))}
                  />
                  <button className="solid" type="button" onClick={() => props.onAction({ type: 'bid', amount: props.bid })}>{tx('出价', 'Bid')}</button>
                  <button type="button" onClick={() => props.onAction({ type: 'pass' })}>{tx('放弃竞拍', 'Pass')}</button>
                </div>
              ) : (
                <p className="quiet">{tx(`等待 ${game.players.find((p) => p.id === auction.turnId)?.name} 出价。`, `Waiting for ${game.players.find((p) => p.id === auction.turnId)?.name} to bid.`)}</p>
              )}
            </div>
          )}
          {game.phase === 'debt' && debt && (
            <div className="auction">
              <p>{tx(`${debtor?.name} 要付 ${usd(debt.amount)}（${debt.reason}）`, `${debtor?.name} owes ${usd(debt.amount)} (${say(debt.reason)})`)}</p>
              {owing && (
                <>
                  <button className="solid" type="button" disabled={(debtor?.money || 0) < debt.amount} onClick={() => props.onAction({ type: 'pay-debt' })}>{tx('支付欠款', 'Pay')}</button>
                  <button type="button" onClick={() => props.onAction({ type: 'bankrupt' })}>{tx('申请破产', 'Declare bankruptcy')}</button>
                  <p className="quiet">{tx('可在右侧选择自己的房产，出售建筑、抵押或拍卖筹款；是否破产由你决定。', 'Select your properties in the side panel to sell buildings, mortgage, or auction them. You decide whether to declare bankruptcy.')}</p>
                </>
              )}
            </div>
          )}
          {game.trade && game.players.some((p) => p.controllerId === youId && (p.id === game.trade?.from || p.id === game.trade?.to)) && (
            <TradeNotice game={game} youId={youId} onAction={props.onAction} />
          )}
          {offline && game.phase !== 'debt' && (
            <button type="button" onClick={() => props.onAction({ type: 'skip-offline' })}>{tx('玩家已掉线，跳过本回合', 'Skip offline player')}</button>
          )}
        </div>
      )}
      {game.phase === 'ended' && props.game.players.length > 0 && (
        <p className="quiet">{tx('房主可在右侧结束本局，返回房间后重新开始。', 'The host can end this game from the side panel, then start a new one in the lobby.')}</p>
      )}
      {props.error && <p className="error">{say(props.error)}</p>}
    </div>
  )
}

function TradeNotice({ game, youId, onAction }: { game: GameState; youId: string; onAction: (a: Action) => void }) {
  const { tx, lang, spaces } = useI18n()
  const trade = game.trade
  if (!trade) return null
  const from = game.players.find((p) => p.id === trade.from)
  const to = game.players.find((p) => p.id === trade.to)
  const names = (ids: number[]) => ids.map((id) => spaceLabel(spaces[id], lang, true)).filter(Boolean).join(tx('、', ', ')) || tx('无房产', 'no property')
  return (
    <div className="trade-note">
      <p>{tx(`${from?.name} 向 ${to?.name} 发起交易`, `${from?.name} wants to trade with ${to?.name}`)}</p>
      <p>{tx('提供', 'Offers')} {usd(trade.offer.money)} · {names(trade.offer.spaceIds)}</p>
      <p>{tx('请求', 'Wants')} {usd(trade.want.money)} · {names(trade.want.spaceIds)}</p>
      {to?.controllerId === youId && (
        <div className="row">
          <button className="solid" type="button" onClick={() => onAction({ type: 'respond-trade', accept: true })}>{tx('接受', 'Accept')}</button>
          <button type="button" onClick={() => onAction({ type: 'respond-trade', accept: false })}>{tx('拒绝', 'Decline')}</button>
        </div>
      )}
      {from?.controllerId === youId && <button type="button" onClick={() => onAction({ type: 'cancel-trade' })}>{tx('取消交易', 'Cancel')}</button>}
    </div>
  )
}

function Portfolio({ game, youId, onPick }: { game: GameState; youId: string; onPick: (id: number) => void }) {
  const { tx, lang, spaces } = useI18n()
  const mine = game.players.filter((player) => player.controllerId === youId && !player.bankrupt)
  return (
    <div className="portfolio">
      {mine.map((player) => {
        const owned = spaces.filter((space) => isDeed(space) && game.plots[space.id]?.ownerId === player.id)
        return (
          <div key={player.id}>
            <h3>
              <Avatar id={player.characterId} size={28} />
              <span>{tx(`${player.name}的房产`, `${player.name}'s properties`)}</span>
            </h3>
            <div className="chips">
              {owned.map((space) => (
                <button key={space.id} type="button" onClick={() => onPick(space.id)}>
                  {spaceLabel(space, lang, true)}
                  {game.plots[space.id]?.mortgaged ? tx('·押', '·M') : ''}
                  {(game.plots[space.id]?.houses || 0) > 0 ? `·${game.plots[space.id]!.houses === 5 ? tx('旅', 'H') : game.plots[space.id]!.houses}` : ''}
                </button>
              ))}
              {!owned.length && <span className="quiet">{tx('暂无房产。', 'No property yet.')}</span>}
            </div>
            {player.heldCards.length > 0 && <p className="quiet">{tx(`免费出狱卡 ${player.heldCards.length} 张`, `${player.heldCards.length} Get Out of Jail Free card${player.heldCards.length === 1 ? '' : 's'}`)}</p>}
          </div>
        )
      })}
    </div>
  )
}

type ShownCard = { id: string; deck: 'chance' | 'chest'; text: string; en?: string }
