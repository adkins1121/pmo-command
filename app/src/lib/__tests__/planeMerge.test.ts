import { describe, it, expect } from 'vitest'
import { mergePlanePull } from '../planeMerge'
import type { PlaneProject } from '../planeMerge'
import { normalize } from '../../data/normalize'
import { getDefaults } from '../../data/defaults'
import type { PmoData } from '../../data/types'

const fresh = (): PmoData => normalize(getDefaults())
const proj = (over: Partial<PlaneProject>): PlaneProject => ({
  id: 'pid', name: 'X', identifier: 'X', description: '', status: 'wip', counts: { total: 1 }, completion: 50, ...over,
})

describe('mergePlanePull', () => {
  it('matches an existing stream by name and updates status + meta', () => {
    const d = fresh()
    const target = d.streams.find((s) => /quickbooks/i.test(s.name))!
    const before = d.streams.length
    const sum = mergePlanePull(d, [proj({ id: 'PL1', name: target.name, status: 'done', completion: 100 })], '2026-06-26T00:00:00Z')
    expect(sum).toMatchObject({ matched: 1, imported: 0, total: 1 })
    expect(d.streams.length).toBe(before) // no import
    const updated = d.streams.find((s) => s.id === target.id)!
    expect(updated.planeProjectId).toBe('PL1')
    expect(updated.status).toBe('done')
    expect(updated.planeMeta?.completion).toBe(100)
  })

  it('prefers matching by planeProjectId over name', () => {
    const d = fresh()
    const s = d.streams[0]
    s.planeProjectId = 'KEEP'
    mergePlanePull(d, [proj({ id: 'KEEP', name: 'totally different name', status: 'risk' })], 't')
    const updated = d.streams.find((x) => x.id === s.id)!
    expect(updated.status).toBe('risk')
    // no new stream created for the different name
    expect(d.streams.filter((x) => x.name === 'totally different name')).toHaveLength(0)
  })

  it('imports unmatched projects as new streams', () => {
    const d = fresh()
    const before = d.streams.length
    const sum = mergePlanePull(d, [proj({ id: 'NEW1', name: 'Brand New Project', identifier: 'BNP', status: 'plan' })], 't')
    expect(sum.imported).toBe(1)
    expect(d.streams.length).toBe(before + 1)
    const created = d.streams.find((s) => s.planeProjectId === 'NEW1')!
    expect(created.name).toBe('Brand New Project')
    expect(created.code).toBe('BNP')
    expect(created.group).toBe('Plane import')
  })

  it('records the pull summary + timestamp on the plane config', () => {
    const d = fresh()
    mergePlanePull(d, [proj({ id: 'a', name: 'a' }), proj({ id: 'b', name: 'b' })], '2026-06-26T12:00:00Z')
    expect(d.plane.lastPullAt).toBe('2026-06-26T12:00:00Z')
    expect(d.plane.lastPullSummary).toEqual({ matched: 0, imported: 2, total: 2 })
  })

  it('is idempotent — a second identical pull imports nothing new', () => {
    const d = fresh()
    const projects = [proj({ id: 'X1', name: 'Once Imported' })]
    mergePlanePull(d, projects, 't1')
    const afterFirst = d.streams.length
    const sum = mergePlanePull(d, projects, 't2')
    expect(sum).toMatchObject({ matched: 1, imported: 0 })
    expect(d.streams.length).toBe(afterFirst)
  })
})
