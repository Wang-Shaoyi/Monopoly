import type { ReactNode } from 'react'
import { GROUPS, spaceLabel } from '@shared/board.ts'
import { characterById } from '@shared/characters.ts'
import type { GameState } from '@shared/types.ts'
import { Avatar } from './avatars'
import { useI18n } from './locale'
import { boardIcon } from './boardIcons'

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
  const { lang, tx, spaces, mapId } = useI18n()
  return (
    <div className="board" data-map={mapId}>
      <div className="grid">
        {spaces.map((space) => {
          const here = pieces.filter((piece) => piece.position === space.id)
          const plot = game?.plots[space.id]
          const group = space.group ? GROUPS[space.group] : null
          const owner = game?.players.find((player) => player.id === plot?.ownerId)
          const ownerColor = owner ? characterById(owner.characterId)?.color : undefined
          const corner = space.id % 10 === 0
          const label = spaceLabel(space, lang, true)
          const icon = boardIcon(space, mapId)
          return (
            <button
              key={space.id}
              type="button"
              className={[
                'tile',
                sideOf(space.id),
                corner ? 'corner' : '',
                space.type,
                icon ? 'has-icon' : '',
                space.type === 'property' || space.type === 'railroad' ? 'edge-icon' : '',
                plot?.mortgaged ? 'is-mortgaged' : '',
                selected === space.id ? 'is-selected' : '',
              ].filter(Boolean).join(' ')}
              style={cellOf(space.id)}
              title={spaceLabel(space, lang)}
              onClick={() => onSelect?.(space.id)}
            >
              {group && <i className="bar" style={{ background: group.color }} />}
              {icon && <img className="tile-icon" src={icon} alt="" aria-hidden="true" draggable={false} decoding="async" />}
              <span className="tile-body" style={ownerColor ? { background: ownerColor } : undefined}>
                {space.type === 'go' && (
                  <span className="corner-go">
                    <strong>{tx('起点', 'GO')}</strong>
                    <em>{tx('经过 +$200', 'Collect $200')}</em>
                  </span>
                )}
                {space.type === 'jail' && (
                  <span className="corner-jail">
                    <strong>{tx('监狱', 'Jail')}</strong>
                    <em>{tx('只是路过', 'Just visiting')}</em>
                  </span>
                )}
                {space.type === 'parking' && (
                  <span className="corner-park">
                    <strong>{tx('免费', 'Free')}</strong>
                    <em>{tx('停车', 'Parking')}</em>
                  </span>
                )}
                {space.type === 'gotojail' && (
                  <span className="corner-gojail">
                    <strong>{tx('前往监狱', 'Go to Jail')}</strong>
                  </span>
                )}
                {space.type === 'chance' && <span className="tname">{tx('机会', 'Chance')}</span>}
                {space.type === 'chest' && <span className="tname">{tx('公益金', 'Chest')}</span>}
                {(space.type === 'railroad' || space.type === 'utility' || space.type === 'tax') && (
                  <>
                    <span className={label.length > 9 ? 'tname is-long' : 'tname'}>{label}</span>
                    {space.price ? <span className="tprice">${space.price}</span> : null}
                    {space.tax ? <span className="tprice">${space.tax}</span> : null}
                  </>
                )}
                {space.type === 'property' && (
                  <>
                    <span className={label.length > 9 ? 'tname is-long' : 'tname'}>{label}</span>
                    <span className="tprice">${space.price}</span>
                  </>
                )}
                {plot && plot.houses > 0 && <Buildings count={plot.houses} />}
                {plot?.mortgaged && <span className="stamp">{tx('押', 'M')}</span>}
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
                      style={{ ['--ring' as string]: characterById(piece.characterId)?.color || '#fff' }}
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
          <div className="watermark">Private Monopoly</div>
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
