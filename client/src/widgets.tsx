import { useEffect, useState } from 'react'
import { CHARACTERS } from '@shared/characters.ts'
import { GROUPS, SPACES, isDeed } from '@shared/board.ts'
import { buildIssue, computeRent, mortgageIssue, sellIssue, topDebt, unmortgageCost, unmortgageIssue } from '@shared/rules.ts'
import type { Action, GameState, Seat, ShownCard } from '@shared/types.ts'
import { Avatar } from './avatars'

export function usd(value: number) {
  return `$${value.toLocaleString('en-US')}`
}

const PIPS: Record<number, number[]> = {
  1: [4],
  2: [0, 8],
  3: [0, 4, 8],
  4: [0, 2, 6, 8],
  5: [0, 2, 4, 6, 8],
  6: [0, 2, 3, 5, 6, 8],
}

export function Die({ value, rolling }: { value: number; rolling: boolean }) {
  const [face, setFace] = useState(value || 1)
  useEffect(() => {
    if (!rolling) {
      setFace(value || 1)
      return
    }
    const timer = window.setInterval(() => setFace(1 + Math.floor(Math.random() * 6)), 70)
    return () => window.clearInterval(timer)
  }, [rolling, value])
  return (
    <span className={`die ${rolling ? 'rolling' : ''}`} aria-label={rolling ? '骰子转动' : `骰子 ${face}`}>
      <span className="pips">
        {Array.from({ length: 9 }, (_, i) => (
          <i key={i} className={PIPS[face]?.includes(i) ? 'on' : ''} />
        ))}
      </span>
    </span>
  )
}

export function DicePair({ dice, rolling }: { dice: [number, number] | null; rolling: boolean }) {
  return (
    <span className="dice">
      <Die value={dice?.[0] || 5} rolling={rolling} />
      <Die value={dice?.[1] || 2} rolling={rolling} />
    </span>
  )
}

const BILLS = [
  { value: 500, cls: 'd500' },
  { value: 100, cls: 'd100' },
  { value: 50, cls: 'd50' },
  { value: 20, cls: 'd20' },
  { value: 10, cls: 'd10' },
  { value: 5, cls: 'd5' },
]

export function Bills({ amount }: { amount: number }) {
  let left = Math.max(0, amount)
  const shown = BILLS.map((bill) => {
    const count = Math.floor(left / bill.value)
    left -= count * bill.value
    return { ...bill, count }
  }).filter((bill) => bill.count > 0)
  return (
    <div className="bills">
      <div className="bill-total">{usd(amount)}</div>
      <div className="bill-row">
        {(shown.length ? shown : [{ value: 1, cls: 'd5', count: 0 }]).slice(0, 4).map((bill) => (
          <div key={bill.value} className={`bill ${bill.cls}`}>
            <span>{bill.value}</span>
            {bill.count > 1 && <em>×{bill.count}</em>}
          </div>
        ))}
      </div>
    </div>
  )
}

export function Deed({
  spaceId,
  game,
  youId,
  busy,
  onAction,
}: {
  spaceId: number
  game: GameState
  youId: string
  busy: boolean
  onAction: (action: Action) => void
}) {
  const space = SPACES[spaceId]
  if (!space) return null
  const plot = game.plots[spaceId]
  const owner = game.players.find((p) => p.id === plot?.ownerId)
  const group = space.group ? GROUPS[space.group] : null
  const diceSum = game.lastDice ? game.lastDice[0] + game.lastDice[1] : 7
  const rent = plot?.ownerId ? computeRent(game, spaceId, diceSum) : null
  const yours = owner?.controllerId === youId && Boolean(owner)
  const phaseOk = game.phase === 'pre-roll' || game.phase === 'post-roll' || game.phase === 'buy' || game.phase === 'auction' || game.phase === 'debt'
  return (
    <article className="deed">
      <header style={{ background: group?.color || '#5c5148' }}>
        <span>{group?.label || (space.type === 'railroad' ? '铁路' : space.type === 'utility' ? '公用' : '格子')}</span>
        <strong>{space.name}</strong>
      </header>
      {space.rent && (
        <ul>
          {['租金', '一栋', '两栋', '三栋', '四栋', '旅馆'].map((label, index) => (
            <li key={label} className={plot?.houses === index || (index === 0 && !plot?.houses) ? 'now' : ''}>
              <span>{label}</span>
              <b>{usd(space.rent?.[index] || 0)}{index === 0 ? '（收齐翻倍）' : ''}</b>
            </li>
          ))}
        </ul>
      )}
      {space.type === 'railroad' && <p className="deed-note">有 1、2、3、4 条铁路时，租金是 $25、$50、$100、$200。押着的也算条数。</p>}
      {space.type === 'utility' && <p className="deed-note">只有一家时，租金是骰子 ×4。两家都在手里是 ×10。</p>}
      <footer>
        {space.price ? <span>售价 {usd(space.price)}</span> : <span>{space.name}</span>}
        {space.mortgage ? <span>抵押 {usd(space.mortgage)}</span> : null}
        {space.houseCost ? <span>每栋 {usd(space.houseCost)}</span> : null}
      </footer>
      <p className="owner-line">
        {owner ? `${owner.name} 的地` : isDeed(space) ? '还没人买' : '这格不能买'}
        {plot?.mortgaged ? ' · 已抵押' : ''}
        {rent !== null && !plot?.mortgaged && plot?.ownerId ? ` · 当前租金 ${usd(rent)}` : ''}
      </p>
      {yours && phaseOk && isDeed(space) && (
        <div className="deed-actions">
          {space.type === 'property' && (
            <>
              <ActionButton
                label="盖一栋"
                busy={busy}
                issue={buildIssue(game, owner?.id || '', spaceId)}
                onClick={() => onAction({ type: 'build', spaceId })}
              />
              <ActionButton
                label="卖一栋"
                busy={busy}
                issue={sellIssue(game, owner?.id || '', spaceId)}
                onClick={() => onAction({ type: 'sell', spaceId })}
              />
            </>
          )}
          <ActionButton
            label="抵押"
            busy={busy}
            issue={mortgageIssue(game, owner?.id || '', spaceId)}
            onClick={() => onAction({ type: 'mortgage', spaceId })}
          />
          <ActionButton
            label={`赎回 ${space.mortgage ? usd(unmortgageCost(space)) : ''}`}
            busy={busy}
            issue={unmortgageIssue(game, owner?.id || '', spaceId)}
            onClick={() => onAction({ type: 'unmortgage', spaceId })}
          />
        </div>
      )}
    </article>
  )
}

function ActionButton({
  label,
  issue,
  busy,
  onClick,
}: {
  label: string
  issue: string | null
  busy: boolean
  onClick: () => void
}) {
  return (
    <button type="button" className="text-button" disabled={busy || Boolean(issue)} onClick={onClick} title={issue || label}>
      {label}
    </button>
  )
}

export function Drawer({
  mode,
  seats,
  game,
  youId,
  onPick,
}: {
  mode: 'showcase' | 'pick' | 'status'
  seats: Seat[]
  game: GameState | null
  youId: string | null
  onPick: (id: string) => void
}) {
  const people = game?.players ?? []
  return (
    <section className="drawer" aria-label="角色抽屉">
      <div className="compartments">
        {CHARACTERS.map((character) => {
          const seat = seats.find((item) => item.characterIds.includes(character.id))
          const player = people.find((item) => item.characterId === character.id)
          const mine = seat?.id === youId || player?.controllerId === youId
          const takenByOther = Boolean((seat && seat.id !== youId) || (player && player.controllerId !== youId))
          return (
            <button
              key={character.id}
              type="button"
              className={['compartment', mine ? 'mine' : '', (seat || player) ? 'taken' : '', player?.id === game?.currentId && game?.phase !== 'ended' ? 'turn' : '', player?.bankrupt ? 'broke' : ''].filter(Boolean).join(' ')}
              disabled={mode !== 'pick' || takenByOther}
              onClick={() => mode === 'pick' && onPick(character.id)}
            >
              <Avatar id={character.id} size={46} />
              <span>
                <strong>{character.name}</strong>
                <em>
                  {character.english}
                  {mode === 'status' && player ? ` · ${usd(player.money)}` : seat ? ` · ${seat.name}` : ''}
                </em>
              </span>
              {player?.inJail && <i className="tag">狱</i>}
              {player?.bankrupt && <i className="tag">破</i>}
              {!player?.connected && player && !player.bankrupt && <i className="tag">离</i>}
            </button>
          )
        })}
      </div>
      <i className="knob" aria-hidden />
    </section>
  )
}

export function Log({ lines }: { lines: { id: number; text: string }[] }) {
  return (
    <ol className="log">
      {[...lines].reverse().slice(0, 18).map((line) => (
        <li key={line.id}>{line.text}</li>
      ))}
    </ol>
  )
}

export function Rules({ onClose }: { onClose: () => void }) {
  return (
    <div className="modal" role="dialog" aria-modal="true" aria-labelledby="rules-title">
      <article className="booklet">
        <header>
          <span>玩法手册</span>
          <button type="button" onClick={onClose}>合上</button>
        </header>
        <h2 id="rules-title">怎么玩</h2>
        <p>按经典大富翁来。走到空地可以买。同色收齐以后，空地租金翻倍。盖房子要均匀，同一组不能哪块特别高。四栋可以换成旅馆。</p>
        <p>铁路按你有几条来收租：25、50、100、200。电厂和水厂看骰子，一家四倍，两家十倍。抵押之后这块地不收租，赎回来要再加一成。</p>
        <p>掷出双骰可以再走一次。连续三次双骰就进监狱。在里面可以交 $50、用免罪卡，或者试着掷出双骰。三次都没掷出来，就交 $50，按点数走，这回合不能再掷。</p>
        <p>经过起点拿 $200。所得税 $200，奢侈税 $100。钱不够就先卖房、抵押。实在凑不齐就破产，家当归债主。债主是银行的话，地重新空出来。</p>
        <p>不买的地默认拿去拍卖，谁都能喊价。房间里可以关掉拍卖。也可以打开停车奖金：税和罚款先堆在停车格，谁踩到谁全拿走。</p>
        <p>换东西要在自己回合、账单还没结的时候提。带房子的一组地得先全部卖掉。接手抵押地的人要马上付一成利息。一个人可以带好几个角色，轮到谁就走谁。</p>
      </article>
    </div>
  )
}

export function debtOf(game: GameState) {
  return topDebt(game)
}
