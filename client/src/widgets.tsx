import { useEffect, useState } from 'react'
import { CHARACTERS, characterById } from '@shared/characters.ts'
import { GROUPS, SPACES, isDeed, spaceLabel } from '@shared/board.ts'
import { buildIssue, computeRent, mortgageIssue, sellIssue, topDebt, unmortgageCost, unmortgageIssue } from '@shared/rules.ts'
import type { Action, GameState, Seat, ShownCard } from '@shared/types.ts'
import { Avatar } from './avatars'
import { useI18n } from './locale'

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
  const { tx } = useI18n()
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
    <span className={`die ${rolling ? 'rolling' : ''}`} aria-label={rolling ? tx('骰子转动', 'Dice rolling') : tx(`骰子 ${face}`, `Die ${face}`)}>
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
  const { lang, tx, say } = useI18n()
  const space = SPACES[spaceId]
  if (!space) return null
  const plot = game.plots[spaceId]
  const owner = game.players.find((p) => p.id === plot?.ownerId)
  const group = space.group ? GROUPS[space.group] : null
  const diceSum = game.lastDice ? game.lastDice[0] + game.lastDice[1] : 7
  const rent = plot?.ownerId ? computeRent(game, spaceId, diceSum) : null
  const yours = owner?.controllerId === youId && Boolean(owner)
  const phaseOk = game.phase === 'pre-roll' || game.phase === 'post-roll' || game.phase === 'buy' || game.phase === 'auction' || game.phase === 'debt'
  const rentLabels = lang === 'en' ? ['Rent', '1 house', '2 houses', '3 houses', '4 houses', 'Hotel'] : ['租金', '一栋', '两栋', '三栋', '四栋', '旅馆']
  return (
    <article className="deed">
      <header style={{ background: group?.color || '#5c5148' }}>
        <span>{group ? (lang === 'en' ? group.en : group.label) : space.type === 'railroad' ? tx('铁路', 'Station') : space.type === 'utility' ? tx('公用', 'Utility') : tx('格子', 'Space')}</span>
        <strong>{spaceLabel(space, lang)}</strong>
      </header>
      {space.rent && (
        <ul>
          {rentLabels.map((label, index) => (
            <li key={label} className={plot?.houses === index || (index === 0 && !plot?.houses) ? 'now' : ''}>
              <span>{label}</span>
              <b>{usd(space.rent?.[index] || 0)}{index === 0 ? tx('（收齐翻倍）', ' (set doubles it)') : ''}</b>
            </li>
          ))}
        </ul>
      )}
      {space.type === 'railroad' && <p className="deed-note">{tx('有 1、2、3、4 条铁路时，租金是 $25、$50、$100、$200。押着的也算条数。', 'Rent is $25, $50, $100, or $200 for 1, 2, 3, or 4 stations. Mortgaged ones still count.')}</p>}
      {space.type === 'utility' && <p className="deed-note">{tx('只有一家时，租金是骰子 ×4。两家都在手里是 ×10。', 'One utility is dice ×4. Both owned is ×10.')}</p>}
      <footer>
        {space.price ? <span>{tx('售价', 'Price')} {usd(space.price)}</span> : <span>{spaceLabel(space, lang)}</span>}
        {space.mortgage ? <span>{tx('抵押', 'Mortgage')} {usd(space.mortgage)}</span> : null}
        {space.houseCost ? <span>{tx('每栋', 'Each')} {usd(space.houseCost)}</span> : null}
      </footer>
      <p className="owner-line">
        {owner ? tx(`${owner.name} 的地`, `${owner.name}'s property`) : isDeed(space) ? tx('还没人买', 'Unowned') : tx('这格不能买', "Can't be bought")}
        {plot?.mortgaged ? tx(' · 已抵押', ' · Mortgaged') : ''}
        {rent !== null && !plot?.mortgaged && plot?.ownerId ? tx(` · 当前租金 ${usd(rent)}`, ` · Rent ${usd(rent)}`) : ''}
      </p>
      {yours && phaseOk && isDeed(space) && (
        <div className="deed-actions">
          {space.type === 'property' && (
            <>
              <ActionButton
                label={tx('盖一栋', 'Build')}
                busy={busy}
                issue={say(buildIssue(game, owner?.id || '', spaceId) || '') || null}
                onClick={() => onAction({ type: 'build', spaceId })}
              />
              <ActionButton
                label={tx('卖一栋', 'Sell')}
                busy={busy}
                issue={say(sellIssue(game, owner?.id || '', spaceId) || '') || null}
                onClick={() => onAction({ type: 'sell', spaceId })}
              />
            </>
          )}
          <ActionButton
            label={tx('抵押', 'Mortgage')}
            busy={busy}
            issue={say(mortgageIssue(game, owner?.id || '', spaceId) || '') || null}
            onClick={() => onAction({ type: 'mortgage', spaceId })}
          />
          <ActionButton
            label={`${tx('赎回', 'Unmortgage')} ${space.mortgage ? usd(unmortgageCost(space)) : ''}`}
            busy={busy}
            issue={say(unmortgageIssue(game, owner?.id || '', spaceId) || '') || null}
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
  const { tx } = useI18n()
  const people = game?.players ?? []
  const roster = mode === 'status' && game
    ? game.order.flatMap((id) => {
        const player = game.players.find((item) => item.id === id)
        const character = player ? characterById(player.characterId) : undefined
        return character ? [character] : []
      })
    : CHARACTERS
  return (
    <section className="drawer" aria-label={tx('角色抽屉', 'Characters')}>
      <div className="compartments">
        {roster.map((character) => {
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
                <strong>{character.english}</strong>
                {mode === 'status' && player ? <em>{usd(player.money)}</em> : seat ? <em>{seat.name}</em> : null}
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

export function Log({ lines }: { lines: { id: number; text: string; en?: string }[] }) {
  const { lang } = useI18n()
  return (
    <ol className="log">
      {[...lines].reverse().slice(0, 18).map((line) => (
        <li key={line.id}>{lang === 'en' && line.en ? line.en : line.text}</li>
      ))}
    </ol>
  )
}

export function Rules({ onClose }: { onClose: () => void }) {
  const { tx } = useI18n()
  return (
    <div className="modal" role="dialog" aria-modal="true" aria-labelledby="rules-title">
      <article className="booklet">
        <header>
          <span>{tx('玩法手册', 'Rules')}</span>
          <button type="button" onClick={onClose}>{tx('合上', 'Close')}</button>
        </header>
        <h2 id="rules-title">{tx('怎么玩', 'How to play')}</h2>
        <p>{tx('按经典大富翁来。走到空地可以买。同色收齐以后，空地租金翻倍。盖房子要均匀，同一组不能哪块特别高。四栋可以换成旅馆。', 'Classic rules. You may buy an unowned space. A full set doubles rent on empty lots. Build evenly across a set. Four houses become a hotel.')}</p>
        <p>{tx('铁路按你有几条来收租：25、50、100、200。电厂和水厂看骰子，一家四倍，两家十倍。抵押之后这块地不收租，赎回来要再加一成。', 'Stations rent for $25, $50, $100, and $200. Utilities are dice ×4, or ×10 if you own both. A mortgaged lot collects no rent. Unmortgaging costs an extra 10%.')}</p>
        <p>{tx('掷出双骰可以再走一次。连续三次双骰就进监狱。在里面可以交 $50、用免罪卡，或者试着掷出双骰。三次都没掷出来，就交 $50，按点数走，这回合不能再掷。', 'Doubles give you another turn. Three doubles in a row send you to jail. Pay $50, use a Get Out of Jail Free card, or try to roll doubles. After three failures, pay $50 and move, with no extra roll.')}</p>
        <p>{tx('经过起点拿 $200。所得税 $200，奢侈税 $100。钱不够就先卖房、抵押。实在凑不齐就破产，家当归债主。债主是银行的话，地重新空出来。', 'Passing GO pays $200. Income tax is $200. Luxury tax is $100. If you are short, sell buildings or mortgage. If you still cannot pay, you go bankrupt and the creditor takes what is left. If the bank is the creditor, the lots become unowned.')}</p>
        <p>{tx('不买的地默认拿去拍卖，谁都能喊价。房间里可以关掉拍卖。也可以打开停车奖金：税和罚款先堆在停车格，谁踩到谁全拿走。', 'Unbought lots go to auction by default, and anyone may bid. A room can turn auctions off. Free Parking can collect taxes and fines until someone lands there and takes the pot.')}</p>
        <p>{tx('换东西要在自己回合、账单还没结的时候提。带房子的一组地得先全部卖掉。接手抵押地的人要马上付一成利息。一个人可以带好几个角色，轮到谁就走谁。', 'Trade on your turn, before the bill is settled. Sell every building in a set before trading it. Taking a mortgaged lot means paying 10% interest at once. One person may play several characters, and each character takes its own turn.')}</p>
      </article>
    </div>
  )
}

export function debtOf(game: GameState) {
  return topDebt(game)
}
