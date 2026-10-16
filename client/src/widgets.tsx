import { useEffect, useRef, useState } from 'react'
import { CHARACTERS, characterById } from '@shared/characters.ts'
import { GROUPS, isDeed, propertyRegion, spaceLabel } from '@shared/board.ts'
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
  const { lang, tx, say, spaces, mapId } = useI18n()
  const space = spaces[spaceId]
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
        <span>{group ? propertyRegion(space, mapId, lang) : space.type === 'railroad' ? tx(mapId === 'usa' ? '机场' : '火车站', mapId === 'usa' ? 'Airport' : 'Railway station') : space.type === 'utility' ? tx('公用事业', 'Utility') : tx('事件', 'Event')}</span>
        <strong>{spaceLabel(space, lang)}</strong>
      </header>
      {space.rent && (
        <ul>
          {rentLabels.map((label, index) => (
            <li key={label} className={plot?.houses === index || (index === 0 && !plot?.houses) ? 'now' : ''}>
              <span>{label}</span>
              <b>{usd(space.rent?.[index] || 0)}{index === 0 ? tx('（整组未抵押时翻倍）', ' (2× with full set)') : ''}</b>
            </li>
          ))}
        </ul>
      )}
      {space.type === 'railroad' && <p className="deed-note">{tx(`拥有 1、2、3、4 座${mapId === 'usa' ? '机场' : '车站'}时，租金分别为 $25、$50、$100、$200。已抵押的也计入总数。`, `Rent is $25, $50, $100, or $200 when you own 1, 2, 3, or 4 ${mapId === 'usa' ? 'airports' : 'railway stations'}. Mortgaged ones still count toward the total.`)}</p>}
      {space.type === 'utility' && <p className="deed-note">{tx('拥有一家公用事业时，租金为骰子点数总和的 4 倍；两家都拥有时为 10 倍。', 'Rent is 4 times the dice total if you own one utility, or 10 times the total if you own both.')}</p>}
      <footer>
        {space.price ? <span>{tx('售价', 'Price')} {usd(space.price)}</span> : <span>{spaceLabel(space, lang)}</span>}
        {space.mortgage ? <span>{tx('抵押', 'Mortgage')} {usd(space.mortgage)}</span> : null}
        {space.houseCost ? <span>{tx('建造费用', 'Building cost')} {usd(space.houseCost)}</span> : null}
      </footer>
      <p className="owner-line">
        {owner ? tx(`${owner.name}的房产`, `${owner.name}'s property`) : isDeed(space) ? tx('尚无业主', 'Unowned') : tx('此格不可购买', "Not for sale")}
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
    <section className="drawer" aria-label={tx('角色列表', 'Characters')}>
      <div className="compartments">
        {roster.map((character) => {
          const seat = seats.find((item) => item.characterIds.includes(character.id))
          const player = people.find((item) => item.characterId === character.id)
          const mine = seat?.id === youId || player?.controllerId === youId
          const takenByOther = Boolean((seat && seat.id !== youId) || (player && player.controllerId !== youId))
          return (
            <div className="character-slot" key={character.id}>
            <button
              aria-describedby={`skill-${character.id}`}
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
              {player?.inJail && <i className="tag">{tx('狱', 'Jail')}</i>}
              {player?.bankrupt && <i className="tag">{tx('破', 'Out')}</i>}
              {!player?.connected && player && !player.bankrupt && <i className="tag">{tx('离', 'Away')}</i>}
            </button>
            <aside className="skill-tooltip" role="tooltip" id={`skill-${character.id}`}>
              <strong>{character.english} · {tx('角色技能', 'Character skill')}</strong>
              <p>{tx(character.skill, character.skillEn)}</p>
            </aside>
            </div>
          )
        })}
      </div>
    </section>
  )
}

export function Log({ lines }: { lines: { id: number; text: string; en?: string }[] }) {
  const { lang } = useI18n()
  const listRef = useRef<HTMLOListElement>(null)
  const newestId = lines.at(-1)?.id
  useEffect(() => {
    const list = listRef.current
    if (list) list.scrollTop = list.scrollHeight
  }, [newestId, lang])
  return (
    <ol className="log" ref={listRef}>
      {lines.slice(-18).map((line) => (
        <li key={line.id}>{lang === 'en' && line.en ? line.en : line.text}</li>
      ))}
    </ol>
  )
}

export function Rules({ onClose }: { onClose: () => void }) {
  const { tx, mapId } = useI18n()
  return (
    <div className="modal" role="dialog" aria-modal="true" aria-labelledby="rules-title">
      <article className="booklet">
        <header>
          <span>{tx('玩法手册', 'Rules')}</span>
          <button type="button" onClick={onClose}>{tx('关闭', 'Close')}</button>
        </header>
        <h2 id="rules-title">{tx('怎么玩', 'How to play')}</h2>
        <p>{tx('每个角色都有专属技能，悬停角色头像可查看说明。Tutu 在移动后、地块结算前可选择是否向前跳一格，全局限两次；不发动则保留次数。', 'Every character has a unique skill. Hover over a character to learn more. Tutu may hop one extra space after moving, before resolving her space, up to twice per game. Skipping preserves her uses.')}</p>
        <p>{tx('停在尚无业主的房产上时，可以按标价购买。集齐同一颜色组，且整组均未抵押时，未建房地块的租金翻倍。建房须在同组地块间均衡进行；已有四栋房屋后，再支付一次建造费用，即可换建一座旅馆。', 'Land on an unowned property to buy it at the listed price. Owning a full color group doubles the rent on its unimproved properties, provided none in the group are mortgaged. Build evenly across the group. Once a property has four houses, pay the building cost once more to replace them with a hotel.')}</p>
        <p>{tx(`拥有 1、2、3、4 座${mapId === 'usa' ? '机场' : '火车站'}时，租金分别为 $25、$50、$100、$200。拥有一家公用事业时，租金为骰子点数总和的 4 倍；两家都拥有时为 10 倍。已抵押的房产不收租，赎回需支付抵押金额及其 10% 的利息。`, `Rent is $25, $50, $100, or $200 when you own 1, 2, 3, or 4 ${mapId === 'usa' ? 'airports' : 'railway stations'}. Utility rent is 4 times the dice total if you own one, or 10 times the total if you own both. Mortgaged properties collect no rent. To unmortgage a property, repay the mortgage plus 10% interest.`)}</p>
        <p>{tx('两枚骰子点数相同时，移动并处理地块后可以再掷一次；同一回合连续三次点数相同，则直接入狱。入狱后，可支付 $50、使用免费出狱卡，或尝试掷出相同点数。第三次尝试仍未成功时，须支付 $50，再按本次点数移动。通过掷骰出狱后，本回合不再获得额外掷骰机会。', 'Roll doubles to move, resolve your space, and roll again. Three consecutive doubles in one turn send you directly to Jail. To get out, pay $50 bail, use a Get Out of Jail Free card, or try to roll doubles. If your third attempt fails, pay $50 and move by that roll. Rolling to leave Jail never gives you an extra roll that turn.')}</p>
        <p>{tx('经过起点领取 $200。所得税为 $200，奢侈税为 $100。现金不足时，可出售建筑或抵押房产筹款；仍无法还清欠款时可申请破产。剩余资产交给债权人；如果债权人是银行，房产将恢复为可购买状态。', 'Collect $200 when you pass GO. Income Tax is $200; Luxury Tax is $100. If you owe more cash than you have, sell buildings or mortgage properties to raise funds. If you still can’t pay, declare bankruptcy. Your remaining assets go to your creditor. If you owe the bank, your properties become available to buy again.')}</p>
        <p>{tx('默认情况下，放弃购买的房产会立即拍卖，所有未破产的角色均可参与竞拍。房主可在开局前关闭拍卖，或开启免费停车奖金。开启奖金后，付给银行的款项会累积到奖池，停在免费停车格的角色可领取全部奖金。', 'By default, declining a property sends it to auction, where any player still in the game may bid. Before the game starts, the host can turn auctions off or enable the Free Parking pot. With the pot enabled, payments to the bank are added to it. Land on Free Parking to collect the entire pot.')}</p>
        <p>{tx('只有完成本回合所有掷骰和地块结算、可以结束回合时，才能发起交易。待处理的交易须先完成或取消，才能结束回合。交易同色组的任一房产前，须先出售该组的全部建筑；接手已抵押房产时，须立即支付抵押金额 10% 的利息。每位玩家可控制多个角色，各角色分别持有资产并按顺序行动。', 'You may trade only after all rolls and space effects are resolved, when End turn is available. Resolve or cancel any pending offer before ending your turn. Before trading a property, sell all buildings in its color group. Anyone receiving a mortgaged property must immediately pay 10% of its mortgage value in interest. You can control multiple characters; each has its own assets and takes a separate turn.')}</p>
      </article>
    </div>
  )
}

export function debtOf(game: GameState) {
  return topDebt(game)
}
