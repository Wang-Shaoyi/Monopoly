import { useEffect, useRef, useState } from 'react'
import type { Deck, ShownCard, Snapshot } from '@shared/types.ts'
import { sfx } from './sound'

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function isFx(event: Snapshot['events'][number]) {
  return event.type === 'dice' || event.type === 'move' || event.type === 'card' || event.type === 'jail'
}

const DICE_MS = 920
const STEP_MS = 420
const LAND_MS = 720
const GO_MS = 980
const CARD_BACK_MS = 820
const CARD_READ_MS = 1600
const JAIL_MS = 900

export function useFx(snap: Snapshot | null) {
  const [tokens, setTokens] = useState<Record<string, number>>({})
  const [dice, setDice] = useState<[number, number] | null>(null)
  const [rolling, setRolling] = useState(false)
  const [card, setCard] = useState<ShownCard | null>(null)
  const [cardFace, setCardFace] = useState<'back' | 'open' | null>(null)
  const [cardDeck, setCardDeck] = useState<Deck | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
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
      setCardFace(null)
      setCardDeck(null)
      setNotice(null)
      return
    }
    const next: Record<string, number> = {}
    for (const player of game.players) next[player.id] = player.position
    setTokens(next)
    setDice(game.lastDice)
    setCard(game.lastCard)
    setCardFace(game.lastCard ? 'open' : null)
    setCardDeck(game.lastCard?.deck ?? null)
    setNotice(null)
  }

  useEffect(() => {
    const current = snapRef.current
    if (!current?.game) {
      if (runRef.current === 0) {
        setTokens({})
        setDice(null)
        setCard(null)
        setCardFace(null)
        setCardDeck(null)
        setNotice(null)
      }
      return
    }
    const anims = current.events.filter(isFx)
    if (!anims.length) {
      if (runRef.current === 0) applyQuiet(current)
      return
    }
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const pace = (ms: number) => wait(reduce ? 0 : ms)
    const my = ++runRef.current
    setAnimating(true)
    void (async () => {
      for (const event of anims) {
        if (runRef.current !== my) return
        if (event.type === 'dice') {
          setNotice(null)
          setRolling(true)
          sfx.roll()
          await pace(DICE_MS)
          if (runRef.current !== my) return
          setDice(event.dice)
          setRolling(false)
        } else if (event.type === 'move') {
          const path = event.path
          if (event.jump) {
            const dest = path[path.length - 1]
            const passed = path.includes(0)
            if (runRef.current !== my) return
            sfx.taps(3)
            setTokens((prev) => ({ ...prev, [event.playerId]: dest! }))
            if (passed) {
              sfx.coin()
              setNotice('salary')
              await pace(GO_MS)
            } else {
              sfx.land()
              await pace(LAND_MS)
            }
          } else {
            for (let i = 0; i < path.length; i++) {
              if (runRef.current !== my) return
              const pos = path[i]
              const last = i === path.length - 1
              if (pos !== 0) setNotice(null)
              setTokens((prev) => ({ ...prev, [event.playerId]: pos }))
              if (pos === 0) {
                sfx.coin()
                setNotice('salary')
                await pace(GO_MS)
              } else if (last) {
                sfx.land()
                await pace(LAND_MS)
              } else {
                sfx.step()
                await pace(STEP_MS)
              }
            }
          }
        } else if (event.type === 'jail') {
          setNotice('jail')
          setTokens((prev) => ({ ...prev, [event.playerId]: 10 }))
          sfx.jail()
          await pace(JAIL_MS)
          if (runRef.current !== my) return
          setNotice(null)
        } else if (event.type === 'card') {
          setNotice(null)
          setCard(null)
          setCardDeck(event.deck)
          setCardFace('back')
          sfx.shuffle()
          await pace(CARD_BACK_MS)
          if (runRef.current !== my) return
          setCard({ id: `${current.rev}-${event.text}`, deck: event.deck, text: event.text, en: event.en })
          setCardFace('open')
          sfx.reveal()
          await pace(CARD_READ_MS)
        }
      }
      if (runRef.current !== my) return
      applyQuiet(current)
      runRef.current = 0
      setAnimating(false)
    })()
  }, [snap?.rev, snap?.code])

  return { tokens, dice, rolling, card, cardFace, cardDeck, notice, animating }
}
