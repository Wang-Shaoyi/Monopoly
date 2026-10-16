// Open /tests/fx.html on the Vite dev server to run real React animation checks.
// This entry is excluded from the production app.
import { useState } from 'react'
import { createRoot } from 'react-dom/client'
import { flushSync } from 'react-dom'
import { createGame } from '../../server/src/engine.ts'
import { DEFAULT_RULES, type Snapshot } from '@shared/types.ts'
import { useFx } from './fx'

const game = createGame([
  { id: 'a', name: 'Ada', characterId: 'ada', connected: true },
  { id: 'b', name: 'Ginger', characterId: 'ginger', connected: true },
], DEFAULT_RULES)
const card = { id: 'h16', deck: 'chest' as const, text: '公益金测试', en: 'Community Chest test' }
let rev = 0
function snapshot(currentId = 'a', draw = false, code = 'TEST'): Snapshot {
  return {
    rev: ++rev, code, hostId: 'a', youId: 'a', seats: [],
    rules: DEFAULT_RULES, draw: null,
    game: { ...structuredClone(game), currentId, lastCard: draw ? card : null },
    events: draw ? [{ type: 'card', playerId: 'a', ...card }] : [],
  }
}
const pause = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

function Checks() {
  const [snap, setSnap] = useState<Snapshot | null>(null)
  const [result, setResult] = useState('Ready')
  const [running, setRunning] = useState(false)
  const fx = useFx(snap)
  // Read the committed UI as users see it, including when stale timers finish.
  const clear = () => {
    if (document.querySelector('[data-card]')?.textContent !== 'none') throw Error('Stale card visible')
    if (document.querySelector('[data-busy]')?.textContent !== 'idle') throw Error('Animation stuck')
  }
  const update = async (next: Snapshot | null) => {
    flushSync(() => setSnap(next))
    await pause(40)
  }
  async function run() {
    setRunning(true)
    setResult('Running…')
    try {
      // An end-turn snapshot arriving while the card is opening must clear it.
      await update(snapshot('a', true))
      await pause(900)
      await update(snapshot('b'))
      clear()
      await pause(1700)
      clear()

      // Also exercise the same-player case (a solo turn or a quiet new state).
      await update(snapshot('a', true))
      await pause(900)
      await update(snapshot('a'))
      await pause(1700)
      clear()

      // A fresh roll clears the displayed card before dice playback begins.
      await update(snapshot('a', true))
      await pause(2500)
      const roll = snapshot('a')
      roll.events = [{ type: 'dice', playerId: 'a', dice: [1, 2] }]
      await update(roll)
      if (document.querySelector('[data-card]')?.textContent !== 'none') throw Error('Card survived new roll')
      await pause(1100)
      clear()

      // Leaving a room cancels its timers and unlocks the UI immediately.
      await update(snapshot('a', true))
      await update(null)
      clear()
      await pause(1000)
      clear()

      // Joining a different room also invalidates the previous animation.
      await update(snapshot('a', true))
      await update(snapshot('b', false, 'NEW'))
      clear()
      await pause(1000)
      clear()
      setResult('PASS: 5 animation regression checks')
    } catch (error) {
      setResult(`FAIL: ${String(error)}`)
    } finally {
      setRunning(false)
    }
  }
  return <main>
    <h1>Card animation regression checks</h1>
    <button disabled={running} onClick={run}>Run checks</button>
    <p role="status">{result}</p>
    <p data-card>{fx.cardFace === 'back' ? 'back' : fx.card?.text ?? 'none'}</p>
    <p data-busy>{fx.animating ? 'playing' : 'idle'}</p>
  </main>
}

createRoot(document.getElementById('root')!).render(<Checks />)
