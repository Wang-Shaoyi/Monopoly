import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import express from 'express'
import { createServer } from 'node:http'
import { Server } from 'socket.io'
import type { Action, Rules } from '../../shared/types.ts'
import {
  act,
  createRoom,
  disband,
  disconnect,
  initStore,
  joinRoom,
  kick,
  leave,
  locate,
  rename,
  resume,
  sanitizeName,
  selectCharacter,
  setRules,
  snapshot,
  start,
  swept,
  targets,
} from './store.ts'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const config = JSON.parse(fs.readFileSync(path.join(__dirname, '../config.json'), 'utf8')) as { sitePassword?: string }
const sitePassword = String(config.sitePassword || '')
const PORT = Number(process.env.PORT || 3001)
const prod = process.env.NODE_ENV === 'production'

initStore(path.join(__dirname, '../../data/rooms.json'))

const app = express()
const server = createServer(app)
const io = new Server(server, { cors: { origin: true } })

app.get('/api/meta', (_req, res) => {
  res.json({ sitePassword: Boolean(sitePassword), title: '木匣' })
})

if (prod) {
  const dist = path.join(__dirname, '../../dist')
  app.use(express.static(dist))
  app.get(/^(?!\/api|\/socket\.io).*/, (_req, res) => {
    res.sendFile(path.join(dist, 'index.html'))
  })
}

function allowed(password: unknown) {
  if (!sitePassword) return true
  return String(password || '') === sitePassword
}

function send(room: NonNullable<ReturnType<typeof locate>>['room'], events: Parameters<typeof snapshot>[2] = []) {
  for (const person of targets(room)) {
    io.to(person.socketId!).emit('snapshot', snapshot(room, person.id, events))
  }
}

function problem(socketId: string, message: string, fatal = false, code?: string) {
  io.to(socketId).emit('problem', { message, fatal, code })
}

io.on('connection', (socket) => {
  socket.on('create', (body: { name?: string; password?: string; sitePassword?: string }) => {
    if (!allowed(body?.sitePassword)) return problem(socket.id, '口令不对', true, 'site')
    const name = sanitizeName(body?.name)
    if (!name) return problem(socket.id, '先写个名字')
    const password = String(body?.password || '').slice(0, 32)
    const { room, person } = createRoom(name, password, socket.id)
    socket.emit('welcome', { playerId: person.id, token: person.token, code: room.code })
    send(room)
  })

  socket.on('join', (body: { code?: string; name?: string; password?: string; sitePassword?: string }) => {
    if (!allowed(body?.sitePassword)) return problem(socket.id, '口令不对', true, 'site')
    const name = sanitizeName(body?.name)
    if (!name) return problem(socket.id, '先写个名字')
    const code = String(body?.code || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 4)
    const result = joinRoom(code, name, String(body?.password || '').slice(0, 32), socket.id)
    if ('error' in result && result.error) return problem(socket.id, result.error, Boolean(result.fatal))
    if (!('room' in result) || !result.room || !result.person) return
    socket.emit('welcome', { playerId: result.person.id, token: result.person.token, code: result.room.code })
    send(result.room)
  })

  socket.on('resume', (body: { code?: string; token?: string; sitePassword?: string }) => {
    if (!allowed(body?.sitePassword)) return problem(socket.id, '口令不对', true, 'site')
    const result = resume(String(body?.code || '').toUpperCase(), String(body?.token || ''), socket.id)
    if ('error' in result && result.error) return problem(socket.id, result.error, Boolean(result.fatal))
    if (!('room' in result) || !result.room || !result.person) return
    socket.emit('welcome', { playerId: result.person.id, token: result.person.token, code: result.room.code })
    send(result.room)
  })

  socket.on('leave', () => {
    const { room, events } = leave(socket.id)
    if (room) send(room, events)
  })

  socket.on('disconnect', () => {
    const room = disconnect(socket.id)
    if (room) send(room)
  })

  socket.on('select-character', (body: { characterId?: string | null }) => {
    const loc = locate(socket.id)
    if (!loc) return problem(socket.id, '你不在这房间里', true)
    const error = selectCharacter(loc.room, loc.person, body?.characterId || null)
    if (error) return problem(socket.id, error)
    send(loc.room)
  })

  socket.on('rename', (body: { name?: string }) => {
    const loc = locate(socket.id)
    if (!loc) return
    const error = rename(loc.room, loc.person, sanitizeName(body?.name))
    if (error) return problem(socket.id, error)
    send(loc.room)
  })

  socket.on('rules', (body: Partial<Rules>) => {
    const loc = locate(socket.id)
    if (!loc) return
    const error = setRules(loc.room, loc.person, body || {})
    if (error) return problem(socket.id, error)
    send(loc.room)
  })

  socket.on('kick', (body: { playerId?: string }) => {
    const loc = locate(socket.id)
    if (!loc) return
    const result = kick(loc.room, loc.person, String(body?.playerId || ''))
    if (result.error) return problem(socket.id, result.error)
    if (result.kickedSocketId) problem(result.kickedSocketId, '你被请出去了', true)
    send(loc.room)
  })

  socket.on('start', () => {
    const loc = locate(socket.id)
    if (!loc) return
    const error = start(loc.room, loc.person)
    if (error) return problem(socket.id, error)
    send(loc.room)
  })

  socket.on('action', (body: Action) => {
    const loc = locate(socket.id)
    if (!loc) return problem(socket.id, '你不在这房间里', true)
    const { error, result } = act(loc.room, loc.person, body)
    if (error) return problem(socket.id, error)
    send(loc.room, result?.events || [])
  })

  socket.on('disband', () => {
    const loc = locate(socket.id)
    if (!loc) return
    const error = disband(loc.room, loc.person)
    if (error) return problem(socket.id, error)
    send(loc.room)
  })

  socket.on('rematch', () => {
    const loc = locate(socket.id)
    if (!loc) return
    const error = disband(loc.room, loc.person)
    if (error) return problem(socket.id, error)
    send(loc.room)
  })
})

setInterval(swept, 60_000)

server.listen(PORT, '0.0.0.0', () => {
  const ips = Object.values(os.networkInterfaces())
    .flat()
    .filter((item) => item && item.family === 'IPv4' && !item.internal)
    .map((item) => item!.address)
  console.log(`木匣服务器 http://localhost:${PORT}`)
  for (const ip of ips) console.log(`同一网络里的朋友可以用 http://${ip}:${prod ? PORT : 5173}`)
})
