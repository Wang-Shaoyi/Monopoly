// Development-only fixture: many assets force scrolling in the real TradeBox.
import { useState } from 'react'
import { createRoot } from 'react-dom/client'
import { createGame } from '../../server/src/engine.ts'
import { DEFAULT_RULES, type TradePack } from '@shared/types.ts'
import { isDeed, spacesForMap } from '@shared/board.ts'
import { LangProvider, BoardMapProvider } from './locale'
import { Board } from './Board'
import { Deed, Log } from './widgets'
import { TradeBox } from './TradeBox'
import './styles.css'

const game = createGame([
  { id: 'a', name: 'Erchai', characterId: 'erchai', connected: true },
  { id: 'b', name: 'Orangie', characterId: 'orangie', connected: true },
], { ...DEFAULT_RULES, mapId: 'usa' })
game.phase = 'post-roll'
for (const space of spacesForMap('usa')) if (isDeed(space)) game.plots[space.id]!.ownerId = 'a'
game.players[0]!.heldCards = [{ id: 'c8', deck: 'chance' }, { id: 'h5', deck: 'chest' }]
const empty: TradePack = { money: 0, spaceIds: [], cardIds: [] }

function Preview() {
  const [open, setOpen] = useState(false)
  const [to, setTo] = useState('b')
  const [offer, setOffer] = useState(empty)
  const [want, setWant] = useState(empty)
  return <div className="shell game">
    <header className="topbar"><strong>Private Monopoly</strong></header>
    <div className="stage">
      <aside className="panel left"><Log lines={game.log} /></aside>
      <div className="board-slot"><Board pieces={[]} selected={37} game={game} /></div>
      <aside className="panel right">
        <Deed spaceId={37} game={game} youId="a" busy={false} onAction={() => {}} />
        <TradeBox open={open} setOpen={setOpen} game={game} youId="a" tradeTo={to} setTradeTo={setTo} offer={offer} want={want} setOffer={setOffer} setWant={setWant} busy={false} onAction={() => {}} />
        <button className="text-button danger" data-layout-anchor>End game</button>
      </aside>
    </div>
  </div>
}
createRoot(document.getElementById('root')!).render(<LangProvider><BoardMapProvider value="usa"><Preview /></BoardMapProvider></LangProvider>)
