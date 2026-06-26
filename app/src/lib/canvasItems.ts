// A flat, serializable view of everything that lives on the Environment map.
//
// The app stores the canvas as structured data (zones → services, extCloud,
// firewalls, notes) plus geometry side-maps on `environment` (canvasPos,
// canvasSize, fwLocked, lockSize). The sync layer and the AI matcher both want
// a single flat list, so we derive `CanvasItem[]` from that structure without
// changing how the canvas itself is stored.

import type { Environment, PmoData } from '../data/types'

export interface CanvasItem {
  id: string
  type: 'service' | 'container' | 'firewall' | 'sticky' | string
  x: number
  y: number
  width?: number
  height?: number
  locked?: boolean
  lockSize?: boolean
  zoneId?: string
  title: string
  description?: string
  metadata?: Record<string, unknown>
}

const geom = (env: Environment, id: string) => {
  const pos = (env.canvasPos || {})[id]
  const size = (env.canvasSize || {})[id]
  return {
    x: pos ? pos.x : 0,
    y: pos ? pos.y : 0,
    width: size ? size.w : undefined,
    height: size && typeof size.h === 'number' ? size.h : undefined,
    locked: !!(env.fwLocked || {})[id],
    lockSize: !!(env.lockSize || {})[id],
  }
}

/** Flatten the environment into the spec's CanvasItem[] for sync / analysis. */
export function deriveCanvasItems(d: PmoData): CanvasItem[] {
  const env = d.environment
  const items: CanvasItem[] = []

  // Service cards — id is the raw service id (also used as PlanLink.canvasItemId).
  const pushServices = (zoneId: string, services: { id: string; name: string; type: string; note: string }[]) => {
    services.forEach((s) => {
      items.push({ id: s.id, type: 'service', zoneId, title: s.name, description: s.note, metadata: { svcType: s.type }, ...geom(env, s.id) })
    })
  }
  pushServices('ext', env.extCloud.services)
  env.zones.forEach((z) => pushServices(z.id, z.services))

  // Containers (external cloud + each zone).
  items.push({ id: 'cont_ext', type: 'container', title: env.extCloud.title, ...geom(env, 'cont_ext') })
  env.zones.forEach((z) =>
    items.push({ id: 'cont_' + z.id, type: 'container', zoneId: z.id, title: z.name, description: z.badge, ...geom(env, 'cont_' + z.id) }),
  )

  // Firewalls — the WAN edge, per-zone boundaries, and any extra ones.
  items.push({ id: 'fw_wan', type: 'firewall', title: env.wanFw, ...geom(env, 'fw_wan') })
  env.zones.forEach((z) => {
    if (z.fwAbove) items.push({ id: 'fw_' + z.id, type: 'firewall', zoneId: z.id, title: z.fwAbove, ...geom(env, 'fw_' + z.id) })
  })
  ;(env.extraFw || []).forEach((f) => items.push({ id: f.id, type: 'firewall', title: f.label, ...geom(env, f.id) }))

  // Sticky notes.
  ;(env.notes || []).forEach((n) => items.push({ id: n.id, type: 'sticky', title: n.text || 'Note', description: n.text, ...geom(env, n.id) }))

  return items
}

/** Every environment service as a {id, name, note, type, zone} record — handy for matching. */
export function listServices(d: PmoData): { id: string; name: string; note: string; type: string; zoneId: string; zoneName: string }[] {
  const env = d.environment
  const out: { id: string; name: string; note: string; type: string; zoneId: string; zoneName: string }[] = []
  env.extCloud.services.forEach((s) => out.push({ id: s.id, name: s.name, note: s.note, type: s.type, zoneId: 'ext', zoneName: env.extCloud.title }))
  env.zones.forEach((z) => z.services.forEach((s) => out.push({ id: s.id, name: s.name, note: s.note, type: s.type, zoneId: z.id, zoneName: z.name })))
  return out
}
