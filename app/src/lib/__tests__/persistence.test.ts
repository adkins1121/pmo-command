import { describe, it, expect } from 'vitest'
import { RemotePersistence } from '../persistence'
import type { PmoData } from '../../data/types'

const fakeData = { meName: 'x' } as unknown as PmoData

function res(status: number, body: unknown) {
  return Promise.resolve({
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
  } as Response)
}

/** Build an adapter whose fetch is scripted per request URL/method. */
function adapterWith(handler: (url: string, init?: RequestInit) => Promise<Response>) {
  return new RemotePersistence('/api/state', '/api/config', handler as typeof fetch)
}

describe('RemotePersistence client', () => {
  it('available() reflects /api/config persistence flag', async () => {
    expect(await adapterWith(() => res(200, { persistence: true })).available()).toBe(true)
    expect(await adapterWith(() => res(200, { persistence: false })).available()).toBe(false)
  })

  it('available() is false when the network throws (offline / no server)', async () => {
    const a = adapterWith(() => Promise.reject(new Error('ECONNREFUSED')))
    expect(await a.available()).toBe(false)
  })

  it('load() returns remote state when present', async () => {
    const a = adapterWith(() => res(200, { data: fakeData, rev: 7 }))
    expect(await a.load()).toEqual({ data: fakeData, rev: 7 })
  })

  it('load() returns null for empty store and for 501 (not configured)', async () => {
    expect(await adapterWith(() => res(200, { data: null, rev: 0 })).load()).toBeNull()
    expect(await adapterWith(() => res(501, { error: 'persistence-not-configured' })).load()).toBeNull()
  })

  it('load() throws on a real error status', async () => {
    await expect(adapterWith(() => res(500, { error: 'boom' })).load()).rejects.toThrow(/load failed: 500/)
  })

  it('save() returns the new rev on success', async () => {
    let seen: any = null
    const a = adapterWith((_u, init) => {
      seen = JSON.parse(String(init!.body))
      return res(200, { ok: true, rev: 9 })
    })
    expect(await a.save(fakeData, 8)).toEqual({ ok: true, rev: 9 })
    expect(seen).toEqual({ data: fakeData, baseRev: 8 })
  })

  it('save() surfaces a 409 conflict with the server copy', async () => {
    const a = adapterWith(() => res(409, { ok: false, conflict: { data: fakeData, rev: 12 } }))
    expect(await a.save(fakeData, 5)).toEqual({ ok: false, conflict: { data: fakeData, rev: 12 } })
  })

  it('save() throws on unexpected error status', async () => {
    await expect(adapterWith(() => res(500, {})).save(fakeData, 1)).rejects.toThrow(/save failed: 500/)
  })
})
