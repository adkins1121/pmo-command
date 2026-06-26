// Static server for the built Vite app + a thin, auth-gated persistence API.
//
//   /healthz          → open health check (Railway)
//   /api/config       → { persistence } so the client knows if remote sync is on
//   GET  /api/state   → { data, rev } (data:null when nothing stored yet)
//   PUT  /api/state   → { data, baseRev } → 200 { ok, rev } | 409 { ok:false, conflict }
//   everything else   → static files from dist/ (SPA fallback to index.html)
//
// Auth: when BASIC_AUTH_USER/BASIC_AUTH_PASS are set, every route except
// /healthz requires those credentials. Persistence: when SUPABASE_URL +
// SUPABASE_SERVICE_KEY are set, /api/state is backed by Supabase; otherwise the
// API reports persistence:false and the client falls back to localStorage only.
import { createServer } from 'node:http'
import { readFile, stat } from 'node:fs/promises'
import { join, normalize, extname } from 'node:path'
import { createStore } from './server/store.mjs'
import { createPlane } from './server/plane.mjs'

const DIST = join(process.cwd(), 'dist')
const PORT = Number(process.env.PORT) || 8080
const USER = process.env.BASIC_AUTH_USER
const PASS = process.env.BASIC_AUTH_PASS
const AUTH_ON = Boolean(USER && PASS)
const MAX_BODY = 8 * 1024 * 1024 // 8 MB cap on state uploads

const store = createStore()
const plane = createPlane()

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.map': 'application/json',
}

function send(res, status, obj) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' })
  res.end(JSON.stringify(obj))
}
function unauthorized(res) {
  res.writeHead(401, { 'WWW-Authenticate': 'Basic realm="AMDG PMO", charset="UTF-8"' })
  res.end('Authentication required')
}
function readBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0
    const chunks = []
    req.on('data', (c) => {
      size += c.length
      if (size > MAX_BODY) { reject(new Error('payload too large')); req.destroy() }
      else chunks.push(c)
    })
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')))
    req.on('error', reject)
  })
}

async function handleApi(req, res, urlPath) {
  if (urlPath === '/api/config') return send(res, 200, { persistence: store.enabled, plane: plane.enabled })

  if (urlPath === '/api/plane/status') return send(res, 200, plane.status())
  if (urlPath === '/api/plane/pull') {
    if (req.method !== 'POST') return send(res, 405, { error: 'method-not-allowed' })
    if (!plane.enabled) return send(res, 501, { error: 'plane-not-configured' })
    const result = await plane.pull()
    return send(res, 200, result)
  }

  if (urlPath === '/api/state') {
    if (!store.enabled) return send(res, 501, { error: 'persistence-not-configured' })

    if (req.method === 'GET') {
      const cur = await store.load()
      return send(res, 200, cur ? { data: cur.data, rev: cur.rev, updatedAt: cur.updatedAt } : { data: null, rev: 0 })
    }
    if (req.method === 'PUT') {
      let body
      try {
        body = JSON.parse(await readBody(req))
      } catch {
        return send(res, 400, { error: 'invalid-json' })
      }
      if (!body || typeof body !== 'object' || body.data == null) return send(res, 400, { error: 'missing-data' })
      const result = await store.save({ data: body.data, baseRev: Number(body.baseRev) || 0, updatedBy: body.updatedBy })
      if (result.ok) return send(res, 200, { ok: true, rev: result.rev })
      return send(res, 409, { ok: false, conflict: result.conflict })
    }
    return send(res, 405, { error: 'method-not-allowed' })
  }
  return send(res, 404, { error: 'not-found' })
}

const server = createServer(async (req, res) => {
  const urlPath = decodeURIComponent((req.url || '/').split('?')[0])

  if (urlPath === '/healthz') {
    res.writeHead(200, { 'Content-Type': 'text/plain' })
    return res.end('ok')
  }

  if (AUTH_ON) {
    const [scheme, encoded] = (req.headers.authorization || '').split(' ')
    if (scheme !== 'Basic' || !encoded) return unauthorized(res)
    const [u, p] = Buffer.from(encoded, 'base64').toString().split(':')
    if (u !== USER || p !== PASS) return unauthorized(res)
  }

  if (urlPath === '/api/config' || urlPath === '/api/state' || urlPath.startsWith('/api/plane/')) {
    try {
      return await handleApi(req, res, urlPath)
    } catch (err) {
      return send(res, 500, { error: 'server-error', message: String(err && err.message || err) })
    }
  }

  // Static files, SPA fallback to index.html.
  let rel = normalize(urlPath).replace(/^(\.\.([/\\]|$))+/, '')
  if (rel === '/' || rel === '\\' || rel === '.') rel = '/index.html'
  let filePath = join(DIST, rel)
  try {
    if ((await stat(filePath)).isDirectory()) filePath = join(filePath, 'index.html')
  } catch {
    filePath = join(DIST, 'index.html')
  }
  try {
    const fileBody = await readFile(filePath)
    const ext = extname(filePath)
    res.writeHead(200, {
      'Content-Type': TYPES[ext] || 'application/octet-stream',
      'Cache-Control': ext === '.html' ? 'no-cache' : 'public, max-age=86400',
    })
    res.end(fileBody)
  } catch {
    res.writeHead(404, { 'Content-Type': 'text/plain' })
    res.end('Not found')
  }
})

server.listen(PORT, '0.0.0.0', () =>
  console.log(`AMDG PMO serving dist/ on :${PORT}${AUTH_ON ? ' (basic auth on)' : ''}${store.enabled ? ' (persistence on)' : ''}`),
)
