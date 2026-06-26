// Minimal, dependency-free static server for the built Vite app.
// Serves dist/ on $PORT, with optional HTTP Basic Auth gated by env vars so the
// public Railway URL can be shared with the team without being wide open.
//
//   BASIC_AUTH_USER / BASIC_AUTH_PASS  → when both set, every request (except
//                                        /healthz) requires those credentials.
//   PORT                               → injected by Railway; defaults to 8080.
import { createServer } from 'node:http'
import { readFile, stat } from 'node:fs/promises'
import { join, normalize, extname } from 'node:path'

const DIST = join(process.cwd(), 'dist')
const PORT = Number(process.env.PORT) || 8080
const USER = process.env.BASIC_AUTH_USER
const PASS = process.env.BASIC_AUTH_PASS
const AUTH_ON = Boolean(USER && PASS)

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

function unauthorized(res) {
  res.writeHead(401, { 'WWW-Authenticate': 'Basic realm="AMDG PMO", charset="UTF-8"' })
  res.end('Authentication required')
}

const server = createServer(async (req, res) => {
  const urlPath = decodeURIComponent((req.url || '/').split('?')[0])

  // Health endpoint stays open so Railway's checks pass even with auth on.
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

  // Resolve a safe path inside dist/, with SPA fallback to index.html.
  let rel = normalize(urlPath).replace(/^(\.\.([/\\]|$))+/, '')
  if (rel === '/' || rel === '\\' || rel === '.') rel = '/index.html'
  let filePath = join(DIST, rel)
  try {
    if ((await stat(filePath)).isDirectory()) filePath = join(filePath, 'index.html')
  } catch {
    filePath = join(DIST, 'index.html')
  }

  try {
    const body = await readFile(filePath)
    const ext = extname(filePath)
    res.writeHead(200, {
      'Content-Type': TYPES[ext] || 'application/octet-stream',
      'Cache-Control': ext === '.html' ? 'no-cache' : 'public, max-age=86400',
    })
    res.end(body)
  } catch {
    res.writeHead(404, { 'Content-Type': 'text/plain' })
    res.end('Not found')
  }
})

server.listen(PORT, '0.0.0.0', () => console.log(`AMDG PMO serving dist/ on :${PORT}${AUTH_ON ? ' (basic auth on)' : ''}`))
