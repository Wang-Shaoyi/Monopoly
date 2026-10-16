import ada from './assets/avatars/ada.png'
import erchai from './assets/avatars/erchai.png'
import ginger from './assets/avatars/ginger-v2.png'
import orangie from './assets/avatars/orangie.png'
import shibagy from './assets/avatars/shibagy.png'
import tutu from './assets/avatars/tutu.png'

const portraits: Record<string, string> = {
  shibagy,
  ada,
  erchai,
  orangie,
  tutu,
  ginger,
}

export function Avatar({ id, size = 64 }: { id: string | null; size?: number }) {
  const src = id ? portraits[id] : undefined
  if (!src) {
    return (
      <svg className="avatar" width={size} height={size} viewBox="0 0 64 64" aria-hidden>
        <circle cx="32" cy="32" r="22" fill="#d9d0c3" />
        <circle cx="32" cy="32" r="10" fill="none" stroke="#8a7b6b" strokeDasharray="3 3" />
      </svg>
    )
  }
  return <img className="avatar" src={src} width={size} height={size} alt="" draggable={false} />
}
