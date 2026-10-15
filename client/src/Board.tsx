import type { ReactNode } from 'react'
import { GROUPS, SPACES } from '@shared/board.ts'
import type { GameState } from '@shared/types.ts'
import { Avatar } from './avatars'

export interface Piece {
  id: string
  characterId: string
  position: number
  inJail: boolean
  active: boolean
  yours: boolean
}

function cellOf(id: number) {
  if (id <= 10) return { gridColumn: 11 - id, gridRow: 11 }
  if (id <= 20) return { gridColumn: 1, gridRow: 21 - id }
  if (id <= 30) return { gridColumn: id - 19, gridRow: 1 }
  return { gridColumn: 11, gridRow: id - 29 }
}

function sideOf(id: number) {
  if (id <= 10) return 'bottom'
  if (id <= 20) return 'left'
  if (id <= 30) return 'top'
  return 'right'
}

export function Board({
  pieces,
  selected,
  game,
  onSelect,
  children,
}: {
  pieces: Piece[]
  selected: number | null
  game: GameState | null
  onSelect?: (id: number) => void
  children?: ReactNode
}) {
  return (
    <div className="board">
      <div className="grid">
        {SPACES.map((space) => {
          const here = pieces.filter((piece) => piece.position === space.id)
          const plot = game?.plots[space.id]
          const group = space.group ? GROUPS[space.group] : null
          const corner = space.id % 10 === 0
          return (
            <button
              key={space.id}
              type="button"
              className={[
                'tile',
                sideOf(space.id),
                corner ? 'corner' : '',
                space.type,
                plot?.mortgaged ? 'is-mortgaged' : '',
                selected === space.id ? 'is-selected' : '',
              ].filter(Boolean).join(' ')}
              style={cellOf(space.id)}
              title={space.name}
              onClick={() => onSelect?.(space.id)}
            >
              {group && <i className="bar" style={{ background: group.color }} />}
              <span className="tile-body">
                {space.type === 'go' && (
                  <span className="corner-go">
                    <strong>起点</strong>
                    <em>经过 +$200</em>
                  </span>
                )}
                {space.type === 'jail' && (
                  <span className="corner-jail">
                    <strong>监狱</strong>
                    <em>探监路过</em>
                  </span>
                )}
                {space.type === 'parking' && (
                  <span className="corner-park">
                    <strong>免费</strong>
                    <em>停车</em>
                  </span>
                )}
                {space.type === 'gotojail' && (
                  <span className="corner-gojail">
                    <strong>进监狱</strong>
                  </span>
                )}
                {space.type === 'chance' && <Mark kind="?" label="机会" />}
                {space.type === 'chest' && <Mark kind="箱" label="公益" />}
                {(space.type === 'railroad' || space.type === 'utility' || space.type === 'tax') && (
                  <>
                    <span className="tname">{space.short}</span>
                    {space.price ? <span className="tprice">${space.price}</span> : null}
                    {space.tax ? <span className="tprice">${space.tax}</span> : null}
                  </>
                )}
                {space.type === 'property' && (
                  <>
                    <span className="tname">{space.short}</span>
                    <span className="tprice">${space.price}</span>
                  </>
                )}
                {plot && plot.houses > 0 && <Buildings count={plot.houses} />}
                {plot?.mortgaged && <span className="stamp">押</span>}
              </span>
              {here.length > 0 && (
                <span className="pieces">
                  {here.map((piece) => (
                    <span
                      key={piece.id}
                      className={[
                        'piece',
                        piece.active ? 'is-turn' : '',
                        piece.yours ? 'is-you' : '',
                        piece.inJail && piece.position === 10 ? 'is-jailed' : '',
                      ].filter(Boolean).join(' ')}
                      style={{ ['--ring' as string]: ring(piece.characterId) }}
                    >
                      <Avatar id={piece.characterId} size={30} />
                    </span>
                  ))}
                </span>
              )}
            </button>
          )
        })}
        <div className="center">
          <div className="watermark">柴果城堡</div>
          <div className="card-backs" aria-hidden>
            <i className="back chance" />
            <i className="back deed" />
          </div>
          <div className="center-content">{children}</div>
        </div>
      </div>
    </div>
  )
}

function ring(id: string) {
  const colors: Record<string, string> = {
    shibagy: '#e2b657',
    ada: '#6d5b8c',
    erchai: '#6e8eb5',
    orangie: '#ef8b3a',
    tutu: '#d4566a',
    ginger: '#3f8f62',
  }
  return colors[id] || '#fff'
}

function Mark({ kind, label }: { kind: string; label: string }) {
  return (
    <span className="mark">
      <b>{kind}</b>
      <small>{label}</small>
    </span>
  )
}

function Buildings({ count }: { count: number }) {
  if (count >= 5) return <span className="hotel" />
  return (
    <span className="houses">
      {Array.from({ length: count }, (_, i) => (
        <i key={i} />
      ))}
    </span>
  )
}
