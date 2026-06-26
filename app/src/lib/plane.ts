import type { PmoData } from '../data/types'

/** Faithful port of the prototype's provisioning-brief generator. */
export function buildBrief(d: PmoData): string {
  const ownerMap: Record<string, any> = {}
  d.owners.forEach((o) => (ownerMap[o.id] = o))
  let brief = 'PLANE PROVISIONING BRIEF — ABES ERPNext Program\n'
  brief += 'Workspace: ' + (d.plane.workspaceSlug || '<set workspace slug>') + '    Host: ' + (d.plane.baseUrl || '') + '\n'
  brief += 'Structure (Option B): Initiative (objective) -> Project (work stream); vendors as labels; phases as cycles.\n\n'
  brief += '1) LABELS — create in workspace (vendors): ' + d.owners.map((o) => o.name).join(', ') + '\n\n'
  brief += '2) INITIATIVES — create one per objective:\n'
  ;(d.objectives || []).forEach((o) => {
    brief += '   ' + o.code + '  ' + o.name + (o.planeInitiativeId ? '   [id ' + o.planeInitiativeId + ']' : '') + '\n        outcome: ' + (o.outcome || '') + '\n'
  })
  brief += '\n3) PROJECTS — one per work stream; link to its objective initiative; add vendor label; set state:\n'
  ;(d.objectives || []).forEach((o) => {
    d.streams
      .filter((s) => s.objectiveId === o.id)
      .forEach((s) => {
        const ov = ownerMap[s.ownerId] || {}
        brief +=
          '   [' + o.code + '] ' + s.code + '  ' + s.name + '   | type: ' + (s.workType || 'Epic') + '   | vendor: ' + (ov.name || '?') +
          '   | state: ' + ((d.plane.stateMap || {})[s.status] || s.status) + (s.status === 'risk' ? '  (+At Risk update)' : '') +
          (s.planeProjectId ? '   [id ' + s.planeProjectId + ']' : '') + '\n'
      })
  })
  brief += '\n4) CYCLES — one per phase:\n'
  d.phases.forEach((p) => {
    brief += '   Phase ' + p.n + '  ' + p.name + (p.phi ? '  (PHI)' : '') + '\n'
  })
  const deplines = d.streams.filter((s) => (s.deps || []).length)
  if (deplines.length) {
    brief += '\n5) RELATIONS — set blocked-by on the projects/work items:\n'
    deplines.forEach((s) => {
      brief += '   ' + s.code + ' (' + s.name + ')  blocked by  ' + s.deps.join(', ') + '\n'
    })
  }
  return brief
}

/**
 * Mock "push to Plane". In production this runs create_work_item / create_cycle
 * / add_work_items_to_cycle over the Plane MCP. Here it assigns the ids those
 * calls would return so the tool flips to "synced" and View-in-Plane / source
 * links resolve to real-looking Plane URLs. Mutates d.
 */
export function pushToPlane(d: PmoData) {
  ;(d.objectives || []).forEach((o, i) => {
    if (!o.planeInitiativeId) o.planeInitiativeId = 'INIT-' + (i + 1)
  })
  d.streams.forEach((s) => {
    if (!s.planeProjectId) s.planeProjectId = 'PROJ-' + s.code.replace(/[^a-z0-9]/gi, '')
  })
  if (!d.plane.workspaceSlug) d.plane.workspaceSlug = 'amdg'
}
