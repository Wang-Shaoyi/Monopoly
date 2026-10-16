import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import type { Lang } from '@shared/board.ts'
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

export function useI18n() {
  const { lang, toggle } = useContext(LangContext)
  return {
    lang,
    toggle,
    tx: (zh: string, en: string) => (lang === 'en' ? en : zh),
    say: (text: string) => translate(lang, text),
  }
}
