import { describe, it, expect } from 'vitest'
import { createStore } from '../store.mjs'

function jsonRes(status, body) {
  return Promise.resolve({ ok: status >= 200 && status < 300, status, json: () => Promise.resolve(body) })
}

const cfg = { url: 'https://proj.supabase.co', serviceKey: 'svc', workspace: 'default' }

describe('server store (Supabase optimistic concurrency)', () => {
  it('is disabled without url/key', () => {
    expect(createStore({ fetchImpl: () => jsonRes(200, []) }).enabled).toBe(false)
  })

  it('load() returns null when the table is empty', async () => {
    const store = createStore({ ...cfg, fetchImpl: () => jsonRes(200, []) })
    expect(await store.load()).toBeNull()
  })

  it('load() maps the first row', async () => {
    const store = createStore({ ...cfg, fetchImpl: () => jsonRes(200, [{ data: { a: 1 }, rev: 3, updated_at: 't' }]) })
    expect(await store.load()).toEqual({ data: { a: 1 }, rev: 3, updatedAt: 't' })
  })

  it('save() with no baseRev inserts at rev 1 (POST 201)', async () => {
    let method, body
    const store = createStore({
      ...cfg,
      fetchImpl: (_u, init) => {
        method = init.method
        body = JSON.parse(init.body)
        return jsonRes(201, [{ rev: 1 }])
      },
    })
    expect(await store.save({ data: { a: 1 }, baseRev: 0 })).toEqual({ ok: true, rev: 1 })
    expect(method).toBe('POST')
    expect(body.rev).toBe(1)
  })

  it('save() insert race (POST 409) becomes a conflict with the current row', async () => {
    const calls = []
    const store = createStore({
      ...cfg,
      fetchImpl: (_u, init) => {
        calls.push(init?.method || 'GET')
        if (init?.method === 'POST') return jsonRes(409, { code: '23505' })
        return jsonRes(200, [{ data: { a: 9 }, rev: 4, updated_at: 't' }]) // the follow-up load()
      },
    })
    const r = await store.save({ data: { a: 1 }, baseRev: 0 })
    expect(r).toEqual({ ok: false, conflict: { data: { a: 9 }, rev: 4, updatedAt: 't' } })
    expect(calls).toEqual(['POST', 'GET'])
  })

  it('save() with matching baseRev updates to baseRev+1 (PATCH returns 1 row)', async () => {
    let url, method, body
    const store = createStore({
      ...cfg,
      fetchImpl: (u, init) => {
        url = u
        method = init.method
        body = JSON.parse(init.body)
        return jsonRes(200, [{ rev: 6 }])
      },
    })
    expect(await store.save({ data: { a: 2 }, baseRev: 5 })).toEqual({ ok: true, rev: 6 })
    expect(method).toBe('PATCH')
    expect(url).toContain('rev=eq.5')
    expect(body.rev).toBe(6)
  })

  it('save() with stale baseRev (PATCH returns 0 rows) becomes a conflict', async () => {
    const calls = []
    const store = createStore({
      ...cfg,
      fetchImpl: (_u, init) => {
        calls.push(init?.method || 'GET')
        if (init?.method === 'PATCH') return jsonRes(200, []) // nothing matched the stale rev
        return jsonRes(200, [{ data: { a: 99 }, rev: 8, updated_at: 't' }])
      },
    })
    const r = await store.save({ data: { a: 2 }, baseRev: 5 })
    expect(r).toEqual({ ok: false, conflict: { data: { a: 99 }, rev: 8, updatedAt: 't' } })
    expect(calls).toEqual(['PATCH', 'GET'])
  })
})
