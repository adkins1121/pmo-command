import { describe, it, expect } from 'vitest'
import { createPlane, deriveStatus, tallyIssues } from '../plane.mjs'

function jsonRes(status, body) {
  return Promise.resolve({ ok: status >= 200 && status < 300, status, json: () => Promise.resolve(body) })
}

describe('plane status derivation', () => {
  it('maps issue tallies to app statuses', () => {
    expect(deriveStatus({ total: 0 })).toBe('plan')
    expect(deriveStatus({ total: 3, completed: 3 })).toBe('done')
    expect(deriveStatus({ total: 4, completed: 2 })).toBe('mixed')
    expect(deriveStatus({ total: 4, completed: 0, started: 2 })).toBe('wip')
    expect(deriveStatus({ total: 2, completed: 0, started: 0, backlog: 2 })).toBe('plan')
  })

  it('tallies issues by state group', () => {
    const groups = { s_done: 'completed', s_prog: 'started', s_back: 'backlog' }
    const counts = tallyIssues([{ state: 's_done' }, { state: 's_done' }, { state: 's_prog' }, { state: 's_back' }], groups)
    expect(counts.total).toBe(4)
    expect(counts.completed).toBe(2)
    expect(counts.started).toBe(1)
    expect(counts.backlog).toBe(1)
  })
})

describe('plane connector pull', () => {
  it('is disabled without a token + workspace', () => {
    expect(createPlane({ fetchImpl: () => jsonRes(200, []) }).enabled).toBe(false)
    expect(createPlane({ apiToken: 't', fetchImpl: () => jsonRes(200, []) }).enabled).toBe(false)
  })

  it('status() reports config + normalized base url', () => {
    const p = createPlane({ apiToken: 't', workspace: 'amdg', baseUrl: 'https://plane.example.com', fetchImpl: () => jsonRes(200, []) })
    expect(p.status()).toEqual({ configured: true, workspace: 'amdg', baseUrl: 'https://plane.example.com/api/v1' })
  })

  it('pulls projects and derives status + completion from their issues', async () => {
    const routes = {
      '/workspaces/amdg/projects/': [
        { id: 'p1', name: 'Data Migration · QuickBooks', identifier: 'QBO', description: 'migrate' },
        { id: 'p2', name: 'New thing', identifier: 'NEW' },
      ],
      '/workspaces/amdg/projects/p1/states/': [
        { id: 'st_done', name: 'Done', group: 'completed' },
        { id: 'st_prog', name: 'In Progress', group: 'started' },
      ],
      '/workspaces/amdg/projects/p1/issues/': [{ state: 'st_done' }, { state: 'st_done' }, { state: 'st_prog' }],
      '/workspaces/amdg/projects/p2/states/': [{ id: 'b', name: 'Backlog', group: 'backlog' }],
      '/workspaces/amdg/projects/p2/issues/': [{ state: 'b' }, { state: 'b' }],
    }
    const seen = []
    const p = createPlane({
      apiToken: 't',
      workspace: 'amdg',
      fetchImpl: (url) => {
        const path = url.replace(/^.*\/api\/v1/, '')
        seen.push(path)
        return jsonRes(200, routes[path] ?? [])
      },
    })
    const res = await p.pull()
    expect(res.ok).toBe(true)
    expect(res.workspace).toBe('amdg')
    expect(res.projects).toHaveLength(2)

    const p1 = res.projects.find((x) => x.id === 'p1')
    expect(p1.status).toBe('mixed') // 2 of 3 done
    expect(p1.completion).toBe(67)
    expect(p1.identifier).toBe('QBO')
    expect(p1.url).toContain('/amdg/projects/p1/issues/')

    const p2 = res.projects.find((x) => x.id === 'p2')
    expect(p2.status).toBe('plan') // all backlog
    expect(p2.completion).toBe(0)

    // it actually walked projects → states → issues
    expect(seen).toContain('/workspaces/amdg/projects/')
    expect(seen).toContain('/workspaces/amdg/projects/p1/issues/')
  })

  it('unwraps paginated { results } responses', async () => {
    const p = createPlane({
      apiToken: 't',
      workspace: 'amdg',
      fetchImpl: (url) => {
        if (url.endsWith('/projects/')) return jsonRes(200, { results: [{ id: 'p1', name: 'Only' }] })
        return jsonRes(200, { results: [] })
      },
    })
    const res = await p.pull()
    expect(res.projects.map((x) => x.name)).toEqual(['Only'])
  })
})
