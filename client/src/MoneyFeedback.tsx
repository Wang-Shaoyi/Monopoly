import { useEffect, useRef, useState } from 'react'
import type { GameState, MoneyChange, Snapshot, Trade } from '@shared/types.ts'
import { Avatar } from './avatars'
import { useI18n } from './locale'

interface CashBatch { id: string; roomCode: string; changes: MoneyChange[]; trade?: Trade }

export function useMoneyFeedback(snap: Snapshot | null, moving: boolean) {
  const [queue, setQueue] = useState<CashBatch[]>([])
  const [current, setCurrent] = useState<CashBatch | null>(null)
  const roomRef = useRef<string | undefined>()
  const seenRef = useRef('')
  useEffect(() => {
    if (roomRef.current !== snap?.code || !snap?.game) {
      roomRef.current = snap?.code
      seenRef.current = ''
      setQueue([])
      setCurrent(null)
    }
    if (!snap?.game) return
    const key = `${snap.code}-${snap.rev}`
    if (seenRef.current === key) return
    seenRef.current = key
    const changes = snap.events.filter((event): event is MoneyChange => event.type === 'money')
    const batches: CashBatch[] = []
    // Public settlements share the feedback queue, so cash messages cannot cover them.
    for (const event of snap.events) {
      if (event.type === 'trade-completed') batches.push({ id: `${key}-trade-${event.trade.id}`, roomCode: snap.code, changes: [], trade: event.trade })
    }
    for (let i = 0; i < changes.length; i += 2) {
      batches.push({ id: `${key}-${i}`, roomCode: snap.code, changes: changes.slice(i, i + 2) })
    }
    if (batches.length) setQueue((previous) => [...previous, ...batches])
  }, [snap?.code, snap?.rev, Boolean(snap?.game)])

  useEffect(() => {
    if (moving || current || !queue.length || !snap?.game || queue[0].roomCode !== snap.code) return
    setCurrent(queue[0])
    setQueue((previous) => previous.slice(1))
  }, [queue, current, moving, snap?.code, Boolean(snap?.game)])

  useEffect(() => {
    if (!current || moving) return
    const timer = window.setTimeout(() => setCurrent(null), current.trade ? 6500 : 1600 + current.changes.length * 300)
    return () => window.clearTimeout(timer)
  }, [current, moving])

  const active = Boolean(snap?.game && current?.roomCode === snap.code)
  return {
    current: !moving && active ? current : null,
    pending: active || Boolean(snap?.game && queue.some((batch) => batch.roomCode === snap.code)),
  }
}

export function MoneyFeedback({ batch, game }: { batch: CashBatch; game: GameState }) {
  const { tx, lang, spaces } = useI18n()
  return <section className="money-feedback" role="status" aria-live="polite" data-feedback-id={batch.id} key={batch.id}>
    <header>{batch.trade ? tx('交易完成 · 向全体玩家公示', 'Trade completed · Shared with everyone') : tx('现金变动', 'Cash changes')}</header>
    {batch.trade && [
      { giver: batch.trade.from, receiver: batch.trade.to, pack: batch.trade.offer },
      { giver: batch.trade.to, receiver: batch.trade.from, pack: batch.trade.want },
    ].map(({ giver, receiver, pack }) => {
      const player = game.players.find((p) => p.id === giver)
      const target = game.players.find((p) => p.id === receiver)
      const items = [pack.money ? `$${pack.money.toLocaleString('en-US')}` : '', ...pack.spaceIds.map((id) => lang === 'en' ? spaces[id]!.en : spaces[id]!.name), pack.cardIds.length ? tx(`${pack.cardIds.length} 张出狱卡`, `${pack.cardIds.length} Get Out of Jail Free card${pack.cardIds.length === 1 ? '' : 's'}`) : ''].filter(Boolean)
      return <div className="money-change" key={giver}>
        <Avatar id={player?.characterId ?? null} size={28} />
        <div className="money-change-label">
          <strong>{player?.name} → {target?.name}</strong>
          <small>{items.join(lang === 'en' ? ', ' : '、') || tx('无', 'Nothing')}</small>
        </div>
      </div>
    })}
    {batch.changes.map((change, index) => {
      const player = game.players.find((p) => p.id === change.playerId)
      return <div className="money-change" key={`${batch.id}-${index}`}>
        <Avatar id={player?.characterId ?? null} size={28} />
        <div className="money-change-label">
          <strong>{player?.name ?? tx('角色', 'Character')}</strong>
          <small>{lang === 'en' ? change.enReason : change.reason}</small>
        </div>
        <b className={change.amount > 0 ? 'income' : 'expense'}>
          {change.amount > 0 ? '+' : '−'}${Math.abs(change.amount).toLocaleString('en-US')}
        </b>
      </div>
    })}
  </section>
}
