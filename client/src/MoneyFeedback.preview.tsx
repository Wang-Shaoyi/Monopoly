// Development-only fixture for queued, per-character cash feedback.
import { useState } from 'react'
import { createRoot } from 'react-dom/client'
import { apply, createGame } from '../../server/src/engine.ts'
import { DEFAULT_RULES, type Snapshot } from '@shared/types.ts'
import { Board } from './Board'
import { Avatar } from './avatars'
import { LangProvider, BoardMapProvider } from './locale'
import { MoneyFeedback, useMoneyFeedback } from './MoneyFeedback'
import './styles.css'

const game = createGame([
  { id: 'a', name: 'Erchai', characterId: 'erchai', connected: true },
  { id: 'b', name: 'Shibagy', characterId: 'shibagy', connected: true },
], { ...DEFAULT_RULES, mapId: 'usa' })
game.players[0]!.position = 17
game.players[1]!.position = 20
const payment = apply(game, 'a', { type: 'debug-roll', dice: [1, 2] })
const base: Snapshot = { rev: 0, code: 'CASH', hostId: 'a', youId: 'a', seats: [], rules: game.rules, draw: null, game, events: [] }

function Preview() {
  const [snap, setSnap] = useState(base)
  const [moving, setMoving] = useState(false)
  const cash = useMoneyFeedback(snap, moving)
  const show = () => setSnap((previous) => ({ ...previous, rev: previous.rev + 1, game: payment.state, events: payment.events }))
  return <div className="shell home">
    <header className="topbar"><strong>Private Monopoly</strong><div className="row">
      <button onClick={show}>Show payment</button>
      <button onClick={() => setMoving((value) => !value)}>{moving ? 'Resume feedback' : 'Pause feedback'}</button>
      <button onClick={() => setSnap((previous) => ({ ...previous, rev: previous.rev + 1, events: [] }))}>Quiet update</button>
      <button onClick={() => setSnap((previous) => ({ ...previous, code: 'OTHER', rev: 0, events: [] }))}>Switch room</button>
    </div></header>
    <div className="stage"><div className="board-slot">
      <Board game={snap.game} selected={null} pieces={[]}>
        <div className="hud">
          <p className="turn-line"><Avatar id="erchai" size={28} /><span>Erchai</span></p>
          {cash.current && <MoneyFeedback batch={cash.current} game={snap.game!} />}
          <p data-cash-status>{cash.pending ? 'Pending feedback' : 'Idle'}</p>
        </div>
      </Board>
    </div></div>
  </div>
}
createRoot(document.getElementById('root')!).render(<LangProvider><BoardMapProvider value="usa"><Preview /></BoardMapProvider></LangProvider>)
