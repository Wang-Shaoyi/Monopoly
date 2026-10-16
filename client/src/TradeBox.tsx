import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { isDeed, spaceLabel } from '@shared/board.ts'
import { isTradeWindow } from '@shared/rules.ts'
import type { Action, GameState, TradePack } from '@shared/types.ts'
import { useI18n } from './locale'

export function TradeBox(props: {
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
  const { tx, lang, spaces } = useI18n()
  const actor = props.game.players.find((p) => p.id === props.game.currentId && p.controllerId === props.youId)
  const others = props.game.players.filter((p) => p.id !== actor?.id && !p.bankrupt)
  const mine = spaces.filter((space) => isDeed(space) && actor && props.game.plots[space.id]?.ownerId === actor.id)
  const theirs = spaces.filter((space) => isDeed(space) && props.game.plots[space.id]?.ownerId === props.tradeTo)
  const myCards = actor?.heldCards ?? []
  const theirCards = props.game.players.find((p) => p.id === props.tradeTo)?.heldCards ?? []
  const canTrade = Boolean(actor && !actor.bankrupt && isTradeWindow(props.game) && !props.game.trade)
  useEffect(() => {
    if (!canTrade) props.setOpen(false)
  }, [canTrade, props.setOpen])
  useEffect(() => {
    if (!props.open) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') props.setOpen(false)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [props.open, props.setOpen])
  if (!canTrade) return null
  return (
    <div className="trade-box">
      <button type="button" className="text-button" disabled={props.busy} onClick={() => props.setOpen(!props.open)}>
        {tx('发起交易', 'Trade')}
      </button>
      {props.open && createPortal(
        <section className="trade-window" role="dialog" aria-label={tx('交易', 'Trade')}>
          <header>
            <strong>{tx('交易', 'Trade')}</strong>
            <button type="button" className="text-button" autoFocus onClick={() => props.setOpen(false)}>{tx('关闭', 'Close')}</button>
          </header>
          <div className="trade-form" role="region" aria-label={tx('交易内容', 'Trade details')} tabIndex={0}>
            <select aria-label={tx('选择交易对象', 'Trade with')} value={props.tradeTo} onChange={(event) => props.setTradeTo(event.target.value)}>
              <option value="">{tx('选择交易对象', 'Trade with')}</option>
              {others.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
            <div className="trade-columns">
              <div className="trade-column">
                <label>{tx('提供现金', 'You offer')} <input type="number" min={0} value={props.offer.money} onChange={(event) => props.setOffer({ ...props.offer, money: Number(event.target.value) })} /></label>
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
                        {tx('提供免费出狱卡', 'Offer Get Out of Jail Free card')}
                      </label>
                    ))}
                  </div>
                )}
              </div>
              <div className="trade-column">
                <label>{tx('请求现金', 'You want')} <input type="number" min={0} value={props.want.money} onChange={(event) => props.setWant({ ...props.want, money: Number(event.target.value) })} /></label>
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
                        {tx('请求免费出狱卡', 'Request Get Out of Jail Free card')}
                      </label>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
          <footer>
            <button
              className="solid"
              type="button"
              disabled={props.busy || !others.some((player) => player.id === props.tradeTo)}
              onClick={() => props.onAction({ type: 'trade', to: props.tradeTo, offer: props.offer, want: props.want })}
            >
              {tx('发送交易请求', 'Send offer')}
            </button>
          </footer>
        </section>,
        document.body,
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

