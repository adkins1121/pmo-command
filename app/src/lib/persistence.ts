// Client persistence — talks to the Railway app's same-origin /api/state proxy
// (which holds the Supabase service key). Keeps the app working offline: if the
// API is absent (e.g. `vite dev` with no server) or unreachable, callers fall
// back to localStorage. fetch is injectable for tests.

import type { PmoData } from '../data/types'

export interface RemoteState {
  data: PmoData
  rev: number
}

export type SaveResult =
  | { ok: true; rev: number }
  | { ok: false; conflict: RemoteState | null }

export interface PersistenceAdapter {
  /** Is a remote backend configured + reachable? */
  available(): Promise<boolean>
  /** Load the current document, or null when nothing is stored yet. */
  load(): Promise<RemoteState | null>
  /** Save with optimistic concurrency; 409 → { ok:false, conflict }. */
  save(data: PmoData, baseRev: number): Promise<SaveResult>
}

type FetchLike = typeof fetch

export class RemotePersistence implements PersistenceAdapter {
  constructor(
    private base: string = '/api/state',
    private configUrl: string = '/api/config',
    private fetchImpl: FetchLike = (...a: Parameters<FetchLike>) => fetch(...a),
  ) {}

  async available(): Promise<boolean> {
    try {
      const res = await this.fetchImpl(this.configUrl, { headers: { Accept: 'application/json' } })
      if (!res.ok) return false
      const body = await res.json()
      return Boolean(body && body.persistence)
    } catch {
      return false
    }
  }

  async load(): Promise<RemoteState | null> {
    const res = await this.fetchImpl(this.base, { headers: { Accept: 'application/json' } })
    if (res.status === 501) return null // persistence not configured
    if (!res.ok) throw new Error('load failed: ' + res.status)
    const body = await res.json()
    if (!body || body.data == null) return null
    return { data: body.data as PmoData, rev: typeof body.rev === 'number' ? body.rev : 0 }
  }

  async save(data: PmoData, baseRev: number): Promise<SaveResult> {
    const res = await this.fetchImpl(this.base, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ data, baseRev }),
    })
    if (res.status === 409) {
      const body = await res.json().catch(() => ({}))
      const c = body && body.conflict
      return { ok: false, conflict: c && c.data != null ? { data: c.data as PmoData, rev: c.rev || 0 } : null }
    }
    if (!res.ok) throw new Error('save failed: ' + res.status)
    const body = await res.json()
    return { ok: true, rev: typeof body.rev === 'number' ? body.rev : baseRev + 1 }
  }
}
