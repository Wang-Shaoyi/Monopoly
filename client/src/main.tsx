import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './App'
import { LangProvider } from './locale'
import { NetProvider } from './net'
import './styles.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <LangProvider>
      <NetProvider>
        <App />
      </NetProvider>
    </LangProvider>
  </StrictMode>,
)
