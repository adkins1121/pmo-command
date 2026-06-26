// Pure merge of a Plane pull into the program data. A pulled Plane project maps
// to a work stream (Structure B): match an existing stream by planeProjectId,
// then by name; update its status + Plane snapshot. Unmatched projects are
// imported as new streams. Mutates `d` (intended for use inside store.setData).

import type { PmoData, Status, Stream } from '../data/types'
import { nid } from '../data/helpers'

export interface PlaneProject {
  id: string
  name: string
  identifier?: string
  description?: string
  status: Status
  counts: Record<string, number>
  completion: number
  url?: string
}

export interface PullSummary {
  matched: number
  imported: number
  total: number
  pulledAt: string
}

const norm = (s: string) => (s || '').trim().toLowerCase()

export function mergePlanePull(d: PmoData, projects: PlaneProject[], pulledAt: string): PullSummary {
  const byPlaneId: Record<string, Stream> = {}
  const byName: Record<string, Stream> = {}
  d.streams.forEach((s) => {
    if (s.planeProjectId) byPlaneId[s.planeProjectId] = s
    byName[norm(s.name)] = s
  })

  const defOwner = (d.owners[0] || { id: 'o_amdg' }).id
  const defPhase = (d.phases[0] || { id: 'p1' }).id
  const defObj = ((d.objectives || [])[0] || { id: 'obj1' }).id

  let matched = 0
  let imported = 0

  for (const p of projects) {
    const meta = { completion: p.completion, counts: p.counts, identifier: p.identifier, url: p.url, pulledAt }
    let s = byPlaneId[p.id] || byName[norm(p.name)]
    if (s) {
      s.planeProjectId = p.id
      s.status = p.status
      if (!s.blurb && p.description) s.blurb = p.description
      s.planeMeta = meta
      matched++
    } else {
      const fresh: Stream = {
        id: nid('s'),
        code: p.identifier || 'PL-' + (d.streams.length + imported + 1),
        name: p.name,
        ownerId: defOwner,
        status: p.status,
        phaseId: defPhase,
        group: 'Plane import',
        start: 1,
        span: 1,
        deps: [],
        blurb: p.description || '',
        objectiveId: defObj,
        planeProjectId: p.id,
        committed: true,
        completedAt: p.status === 'done' ? Date.now() : null,
        workType: 'Epic',
        planeMeta: meta,
      }
      d.streams.push(fresh)
      byPlaneId[p.id] = fresh
      byName[norm(p.name)] = fresh
      imported++
    }
  }

  if (!d.plane) d.plane = { workspaceSlug: '', baseUrl: 'https://app.plane.so', structure: 'B', stateMap: {} }
  d.plane.lastPullAt = pulledAt
  d.plane.lastPullSummary = { matched, imported, total: projects.length }
  return { matched, imported, total: projects.length, pulledAt }
}
