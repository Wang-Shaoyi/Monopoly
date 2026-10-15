import { useEffect, useRef, useState } from 'react'
import type { ShownCard, Snapshot } from '@shared/types.ts'

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function isFx(event: Snapshot['events'][number]) {
  return event.type === 'dice' || event.type === 'move' || event.type === 'card' || event.type === 'jail'
}

export function useFx(snap: Snapshot | null) {
  const [tokens, setTokens] = useState<Record<string, number>>({})
  const [dice, setDice] = useState<[number, number] | null>(null)
  const [rolling, setRolling] = useState(false)
  const [card, setCard] = useState<ShownCard | null>(null)
  const [animating, setAnimating] = useState(false)
  const runRef = useRef(0)
  const snapRef = useRef(snap)
  snapRef.current = snap

  function applyQuiet(current: Snapshot) {
    const game = current.game
    if (!game) {
      setTokens({})
      setDice(null)
      setCard(null)
      return
    }
    const next: Record<string, number> = {}
    for (const player of game.players) next[player.id] = player.position
    setTokens(next)
    setDice(game.lastDice)
    setCard(game.lastCard)
  }

  useEffect(() => {
    const current = snapRef.current
    if (!current?.game) {
      if (runRef.current === 0) {
        setTokens({})
        setDice(null)
        setCard(null)
      }
      return
    }
    const anims = current.events.filter(isFx)
    if (!anims.length) {
      if (runRef.current === 0) applyQuiet(current)
      return
    }
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const my = ++runRef.current
    setAnimating(true)
    void (async () => {
      for (const event of anims) {
        if (runRef.current !== my) return
        if (event.type === 'dice') {
          setRolling(true)
          await wait(reduce ? 0 : 680)
          if (runRef.current !== my) return
          setDice(event.dice)
          setRolling(false)
        } else if (event.type === 'move') {
          for (const pos of event.path) {
            if (runRef.current !== my) return
            setTokens((prev) => ({ ...prev, [event.playerId]: pos }))
            await wait(reduce ? 0 : 130)
          }
        } else if (event.type === 'jail') {
          setTokens((prev) => ({ ...prev, [event.playerId]: 10 }))
          await wait(reduce ? 0 : 280)
        } else if (event.type === 'card') {
          setCard({ id: `${current.rev}-${event.text}`, deck: event.deck, text: event.text })
          await wait(reduce ? 0 : 700)
        }
      }
      if (runRef.current !== my) return
      applyQuiet(current)
      runRef.current = 0
      setAnimating(false)
    })()
  }, [snap?.rev, snap?.code])

  return { tokens, dice, rolling, card, animating }
}
