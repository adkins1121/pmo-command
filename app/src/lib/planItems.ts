// Derive the flat list of "plan items" that environment cards can be associated
// with. These mirror the dataset panels surfaced in the UI: Objectives, Streams
// (work streams), Phases, Vendors, and the DataPlane sync target.

import type { PlanItem, PmoData } from '../data/types'

export function derivePlanItems(d: PmoData): PlanItem[] {
  const items: PlanItem[] = []
  const ownerName: Record<string, string> = {}
  d.owners.forEach((o) => (ownerName[o.id] = o.name))
  const phaseName: Record<string, string> = {}
  d.phases.forEach((p) => (phaseName[p.id] = 'P' + p.n + ' · ' + p.name))

  // Objectives
  ;(d.objectives || []).forEach((o) =>
    items.push({ id: 'plan_obj_' + o.id, kind: 'objective', title: o.name, description: o.outcome, tags: [o.code], metadata: { objectiveId: o.id } }),
  )

  // Work streams — the richest matching surface.
  d.streams.forEach((s) =>
    items.push({
      id: 'plan_stream_' + s.id,
      kind: 'stream',
      title: s.name,
      description: s.blurb,
      tags: [s.code, s.group].filter(Boolean) as string[],
      vendor: ownerName[s.ownerId],
      phase: phaseName[s.phaseId],
      metadata: { streamId: s.id, status: s.status },
    }),
  )

  // Phases
  d.phases.forEach((p) =>
    items.push({ id: 'plan_phase_' + p.id, kind: 'phase', title: p.name, description: p.sub, tags: ['P' + p.n], metadata: { phaseId: p.id } }),
  )

  // Vendors (owners)
  d.owners.forEach((o) =>
    items.push({ id: 'plan_vendor_' + o.id, kind: 'vendor', title: o.name, description: o.role, vendor: o.name, metadata: { ownerId: o.id } }),
  )

  // DataPlane sync target — represents the Plane workspace the program syncs to.
  if (d.plane && d.plane.workspaceSlug)
    items.push({
      id: 'plan_sync_plane',
      kind: 'sync',
      title: 'DataPlane sync · ' + d.plane.workspaceSlug,
      description: 'Two-way project sync with the Plane workspace.',
      tags: ['plane', 'sync', 'dataplane'],
      metadata: { workspaceSlug: d.plane.workspaceSlug },
    })

  return items
}
