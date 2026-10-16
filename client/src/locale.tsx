import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { spacesForMap, type Lang } from '@shared/board.ts'
import type { MapId } from '@shared/types.ts'
import { translate } from '@shared/phrases.ts'

const KEY = 'woodbox-lang'

const LangContext = createContext<{ lang: Lang; toggle: () => void }>({
  lang: 'zh',
  toggle: () => {},
})

export function LangProvider({ children }: { children: ReactNode }) {
  const [lang, setLang] = useState<Lang>(() => (localStorage.getItem(KEY) === 'en' ? 'en' : 'zh'))
  useEffect(() => {
    localStorage.setItem(KEY, lang)
    document.documentElement.lang = lang === 'en' ? 'en' : 'zh-CN'
  }, [lang])
  return (
    <LangContext.Provider value={{ lang, toggle: () => setLang((current) => (current === 'zh' ? 'en' : 'zh')) }}>
      {children}
    </LangContext.Provider>
  )
}

const MapContext = createContext<MapId>('china')
export const BoardMapProvider = MapContext.Provider

export function useI18n() {
  const { lang, toggle } = useContext(LangContext)
  const mapId = useContext(MapContext)
  return {
    lang,
    mapId,
    spaces: spacesForMap(mapId),
    toggle,
    tx: (zh: string, en: string) => (lang === 'en' ? en : zh),
    say: (text: string) => translate(lang, text, mapId),
  }
}
