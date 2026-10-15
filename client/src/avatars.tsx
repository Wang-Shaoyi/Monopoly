import { characterById } from '@shared/characters.ts'

export function Avatar({ id, size = 64 }: { id: string | null; size?: number }) {
  const character = characterById(id)
  return (
    <svg className="avatar" width={size} height={size} viewBox="0 0 64 64" aria-hidden>
      <circle cx="32" cy="34" r="22" fill={character?.color || '#d9d0c3'} />
      {id === 'shibagy' && <Shibagy />}
      {id === 'ada' && <Ada />}
      {id === 'erchai' && <Erchai />}
      {id === 'orangie' && <Orangie />}
      {id === 'tutu' && <Tutu />}
      {id === 'ginger' && <Ginger />}
      {!character && <circle cx="32" cy="34" r="10" fill="none" stroke="#8a7b6b" strokeDasharray="3 3" />}
    </svg>
  )
}

function Shibagy() {
  return (
    <g>
      <path d="M18 28 14 12l12 8z" fill="#e2a15a" />
      <path d="M46 28 50 12 38 20z" fill="#e2a15a" />
      <ellipse cx="32" cy="36" rx="16" ry="14" fill="#f3c98a" />
      <ellipse cx="32" cy="42" rx="8" ry="6" fill="#fff6ea" />
      <circle cx="26" cy="34" r="2" fill="#2b2118" />
      <circle cx="38" cy="34" r="2" fill="#2b2118" />
      <ellipse cx="32" cy="39" rx="2.2" ry="1.5" fill="#2b2118" />
      <path d="M28 42.5c2 2 6 2 8 0" fill="none" stroke="#2b2118" strokeWidth="1.4" strokeLinecap="round" />
    </g>
  )
}

function Ada() {
  return (
    <g>
      <path d="M20 30 16 14l12 10z" fill="#241e27" />
      <path d="M44 30 48 14 36 24z" fill="#241e27" />
      <path d="M22 24 18 16l8 6z" fill="#e7b4c6" />
      <path d="M42 24 46 16l-8 6z" fill="#e7b4c6" />
      <ellipse cx="32" cy="36" rx="15" ry="13" fill="#2a2430" />
      <ellipse cx="32" cy="42" rx="6" ry="4" fill="#f4efe6" />
      <ellipse cx="26" cy="34" rx="2.2" ry="2.6" fill="#f0d56a" />
      <ellipse cx="38" cy="34" rx="2.2" ry="2.6" fill="#f0d56a" />
      <path d="M24 28h16" stroke="#c7b4e4" strokeWidth="2" strokeLinecap="round" />
    </g>
  )
}

function Erchai() {
  return (
    <g>
      <path d="M18 28 13 13l13 8z" fill="#5d534c" />
      <path d="M46 28 51 13 38 21z" fill="#5d534c" />
      <ellipse cx="32" cy="36" rx="16" ry="14" fill="#ddd6cc" />
      <path d="M18 30c4-8 10-6 12 2 4-10 14-8 16 2" fill="#3c3834" />
      <ellipse cx="32" cy="43" rx="8" ry="5.5" fill="#fff" />
      <circle cx="26" cy="35" r="1.8" fill="#241e18" />
      <circle cx="38" cy="35" r="1.8" fill="#241e18" />
      <ellipse cx="32" cy="40" rx="2" ry="1.4" fill="#241e18" />
    </g>
  )
}

function Orangie() {
  return (
    <g>
      <circle cx="22" cy="24" r="6" fill="#f3a04a" />
      <circle cx="42" cy="24" r="6" fill="#f3a04a" />
      <circle cx="32" cy="36" r="15" fill="#f6a84a" />
      <path d="M32 16c2 4 2 4 0 8-2-4-2-4 0-8z" fill="#6ea15a" />
      <circle cx="26" cy="35" r="2" fill="#3a2414" />
      <circle cx="38" cy="35" r="2" fill="#3a2414" />
      <ellipse cx="32" cy="41" rx="3" ry="2" fill="#fff3e4" />
      <path d="M27 43c3 3 7 3 10 0" fill="none" stroke="#3a2414" strokeWidth="1.4" strokeLinecap="round" />
    </g>
  )
}

function Tutu() {
  return (
    <g>
      <ellipse cx="24" cy="18" rx="5" ry="12" fill="#fff" />
      <ellipse cx="40" cy="18" rx="5" ry="12" fill="#fff" />
      <ellipse cx="24" cy="18" rx="2.4" ry="8" fill="#f3c2d0" />
      <ellipse cx="40" cy="18" rx="2.4" ry="8" fill="#f3c2d0" />
      <circle cx="32" cy="36" r="13" fill="#fffaf6" />
      <circle cx="27" cy="35" r="1.7" fill="#2a2428" />
      <circle cx="37" cy="35" r="1.7" fill="#2a2428" />
      <path d="M29 40h6" stroke="#d4566a" strokeWidth="1.6" strokeLinecap="round" />
      <path d="M22 48c4 5 16 5 20 0" fill="#e7a3b4" />
    </g>
  )
}

function Ginger() {
  return (
    <g>
      <path d="M20 30 15 14l13 9z" fill="#e07a3d" />
      <path d="M44 30 49 14 36 23z" fill="#e07a3d" />
      <ellipse cx="32" cy="36" rx="15" ry="13" fill="#e88345" />
      <path d="M24 28c2 3 3 3 4 0M32 27c2 4 3 4 5 0M30 36c3 2 6 2 8-1" fill="none" stroke="#b85a2c" strokeWidth="1.6" strokeLinecap="round" />
      <ellipse cx="26" cy="34" rx="2" ry="2.4" fill="#8dbe74" />
      <ellipse cx="38" cy="34" rx="2" ry="2.4" fill="#8dbe74" />
      <ellipse cx="32" cy="40" rx="2" ry="1.4" fill="#f4d2c4" />
      <path d="M28 43c2.2 2 5.8 2 8 0" fill="none" stroke="#6a341c" strokeWidth="1.3" strokeLinecap="round" />
    </g>
  )
}
