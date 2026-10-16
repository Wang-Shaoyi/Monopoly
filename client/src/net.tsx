import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import { io, type Socket } from 'socket.io-client'
import type { Action, MapId, Snapshot } from '@shared/types.ts'

const SESSION = 'woodbox-session'
const SITE = 'woodbox-site'

interface Welcome {
  playerId: string
  token: string
  code: string
}

interface Problem {
  message: string
  fatal?: boolean
  code?: string
}

interface Net {
  online: boolean
  booting: boolean
  metaReady: boolean
  siteRequired: boolean
  sitePassword: string
  setSitePassword: (value: string) => void
  snap: Snapshot | null
  error: string | null
  clearError: () => void
  pending: boolean
  create: (name: string, mapId: MapId) => void
  join: (code: string, name: string) => void
  send: (action: Action) => void
  emit: (event: string, body?: unknown) => void
  leave: () => void
}

const Ctx = createContext<Net | null>(null)

export function NetProvider({ children }: { children: ReactNode }) {
  const socketRef = useRef<Socket | null>(null)
  const siteRef = useRef(localStorage.getItem(SITE) || '')
  const tried = useRef(false)
  const [online, setOnline] = useState(false)
  const [booting, setBooting] = useState(Boolean(localStorage.getItem(SESSION)))
  const [metaReady, setMetaReady] = useState(false)
  const [siteRequired, setSiteRequired] = useState(false)
  const [sitePassword, setSitePasswordState] = useState(siteRef.current)
  const [snap, setSnap] = useState<Snapshot | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  function setSitePassword(value: string) {
    siteRef.current = value
    setSitePasswordState(value)
    if (value) localStorage.setItem(SITE, value)
    else localStorage.removeItem(SITE)
  }

  useEffect(() => {
    fetch('/api/meta')
      .then((res) => res.json())
      .then((meta: { sitePassword?: boolean }) => {
        setSiteRequired(Boolean(meta.sitePassword))
        setMetaReady(true)
      })
      .catch(() => {
        setMetaReady(true)
        setError('暂时无法连接服务器，请稍后重试。')
      })
  }, [])

  useEffect(() => {
    const socket = io({ autoConnect: true })
    socketRef.current = socket
    socket.on('connect', () => setOnline(true))
    socket.on('disconnect', () => setOnline(false))
    socket.on('welcome', (welcome: Welcome) => {
      localStorage.setItem(
        SESSION,
        JSON.stringify({ code: welcome.code, token: welcome.token, sitePassword: siteRef.current }),
      )
    })
    socket.on('snapshot', (next: Snapshot) => {
      setSnap(next)
      setBooting(false)
      setPending(false)
      setError(null)
    })
    socket.on('problem', (issue: Problem) => {
      setPending(false)
      setError(issue.message)
      if (issue.fatal) {
        localStorage.removeItem(SESSION)
        setSnap(null)
        setBooting(false)
        if (issue.code === 'site') setSitePassword('')
      }
    })
    return () => {
      socket.disconnect()
    }
  }, [])

  useEffect(() => {
    const socket = socketRef.current
    if (!metaReady || !online || !socket || tried.current) return
    if (siteRequired && !sitePassword) return
    const raw = localStorage.getItem(SESSION)
    tried.current = true
    if (!raw) {
      setBooting(false)
      return
    }
    try {
      const saved = JSON.parse(raw) as { code: string; token: string }
      socket.emit('resume', { ...saved, sitePassword })
    } catch {
      localStorage.removeItem(SESSION)
      setBooting(false)
    }
  }, [metaReady, online, siteRequired, sitePassword])

  const api: Net = {
    online,
    booting,
    metaReady,
    siteRequired,
    sitePassword,
    setSitePassword,
    snap,
    error,
    clearError: () => setError(null),
    pending,
    create: (name, mapId) => {
      setError(null)
      socketRef.current?.emit('create', { name, mapId, sitePassword: siteRef.current })
    },
    join: (code, name) => {
      setError(null)
      socketRef.current?.emit('join', { code, name, sitePassword: siteRef.current })
    },
    send: (action) => {
      setPending(true)
      setError(null)
      socketRef.current?.emit('action', action)
    },
    emit: (event, body) => {
      setError(null)
      socketRef.current?.emit(event, body)
    },
    leave: () => {
      setPending(false)
      setError(null)
      localStorage.removeItem(SESSION)
      setSnap(null)
      socketRef.current?.emit('leave')
    },
  }

  return <Ctx.Provider value={api}>{children}</Ctx.Provider>
}

export function useNet() {
  const net = useContext(Ctx)
  if (!net) throw new Error('net')
  return net
}
