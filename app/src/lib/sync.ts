// Pragmatic sync layer (spec phase 1 + 2). A `SyncAdapter` abstracts the remote;
// the bundled `LocalSyncAdapter` treats a second localStorage slot as the
// "server" so Pull/Push/Resolve all work end-to-end with no backend.
//
// Conflict policy:
//   - low-risk settings → last-write-wins
//   - mappings (plan links) + structured data → reviewable conflicts
//   - manual plan-link overrides are NEVER silently discarded

import type { AppStatePayload, PlanItem, PlanLink, PmoData } from '../data/types'
import { deriveCanvasItems } from './canvasItems'
import { derivePlanItems } from './planItems'
import { defaultAdminSettings, mergeAdminSettings } from './admin'

export const PAYLOAD_VERSION = 1
export const REMOTE_KEY = 'amdg_pmo_remote_v1'

/* ----------------------------- serialization ----------------------------- */

export function buildPayload(d: PmoData, source = 'local', updatedAt?: string): AppStatePayload {
  return {
    canvasItems: deriveCanvasItems(d),
    planItems: derivePlanItems(d),
    planLinks: d.planLinks || [],
    adminSettings: d.adminSettings || defaultAdminSettings(),
    metadata: {
      version: PAYLOAD_VERSION,
      updatedAt: updatedAt || new Date().toISOString(),
      source,
    },
  }
}

export function serializePayload(p: AppStatePayload): string {
  return JSON.stringify(p, null, 2)
}

export function deserializePayload(raw: string): AppStatePayload {
  const p = JSON.parse(raw)
  if (!p || typeof p !== 'object') throw new Error('Invalid payload')
  return {
    canvasItems: Array.isArray(p.canvasItems) ? p.canvasItems : [],
    planItems: Array.isArray(p.planItems) ? p.planItems : [],
    planLinks: Array.isArray(p.planLinks) ? p.planLinks : [],
    adminSettings: mergeAdminSettings(p.adminSettings),
    metadata: {
      version: typeof p.metadata?.version === 'number' ? p.metadata.version : PAYLOAD_VERSION,
      updatedAt: p.metadata?.updatedAt || new Date().toISOString(),
      source: p.metadata?.source || 'unknown',
    },
  }
}

/* ------------------------------- conflicts ------------------------------- */

export interface LinkConflict {
  canvasItemId: string
  planItemId: string
  local?: PlanLink
  remote?: PlanLink
  /** Why this needs a human: 'manual-divergence' protects manual overrides. */
  kind: 'manual-divergence' | 'status-divergence'
}

const linkKey = (l: PlanLink) => l.canvasItemId + '::' + l.planItemId

/**
 * Merge remote plan links into local ones.
 *  - Manual local links always win and never get clobbered.
 *  - If both sides edited the same pair and at least one is manual with a
 *    different status, it's surfaced as a reviewable conflict (not auto-merged).
 *  - Otherwise the newer updatedAt wins (last-write-wins for AI links).
 */
export function mergePlanLinks(
  local: PlanLink[],
  remote: PlanLink[],
): { merged: PlanLink[]; conflicts: LinkConflict[] } {
  const byKey: Record<string, { local?: PlanLink; remote?: PlanLink }> = {}
  local.forEach((l) => ((byKey[linkKey(l)] = byKey[linkKey(l)] || {}).local = l))
  remote.forEach((r) => ((byKey[linkKey(r)] = byKey[linkKey(r)] || {}).remote = r))

  const merged: PlanLink[] = []
  const conflicts: LinkConflict[] = []

  Object.values(byKey).forEach(({ local: l, remote: r }) => {
    if (l && !r) return merged.push(l)
    if (r && !l) return merged.push(r)
    if (!l || !r) return

    // Never discard a manual override.
    if (l.source === 'manual' && r.source !== 'manual') return merged.push(l)
    if (r.source === 'manual' && l.source !== 'manual') return merged.push(r)

    if (l.source === 'manual' && r.source === 'manual' && l.status !== r.status) {
      conflicts.push({ canvasItemId: l.canvasItemId, planItemId: l.planItemId, local: l, remote: r, kind: 'manual-divergence' })
      merged.push(l) // keep local pending resolution
      return
    }

    // Both AI (or matching manual) → last-write-wins by timestamp.
    merged.push(Date.parse(r.updatedAt) > Date.parse(l.updatedAt) ? r : l)
  })

  return { merged, conflicts }
}

/* -------------------------------- adapter -------------------------------- */

export interface SyncAdapter {
  pull(): Promise<AppStatePayload>
  push(payload: AppStatePayload): Promise<{ ok: boolean; conflicts?: unknown[] }>
  getStatus(): Promise<{ lastSyncAt?: string; healthy: boolean; message?: string }>
}

/** localStorage-backed adapter used as the default "remote". */
export class LocalSyncAdapter implements SyncAdapter {
  constructor(private key: string = REMOTE_KEY) {}

  async pull(): Promise<AppStatePayload> {
    const raw = localStorage.getItem(this.key)
    if (!raw) throw new Error('Nothing has been pushed yet.')
    return deserializePayload(raw)
  }

  async push(payload: AppStatePayload): Promise<{ ok: boolean; conflicts?: unknown[] }> {
    let conflicts: LinkConflict[] = []
    const existing = localStorage.getItem(this.key)
    if (existing) {
      try {
        const remote = deserializePayload(existing)
        conflicts = mergePlanLinks(payload.planLinks, remote.planLinks).conflicts
      } catch {
        /* corrupt remote — overwrite */
      }
    }
    localStorage.setItem(this.key, serializePayload(payload))
    return { ok: true, conflicts: conflicts.length ? conflicts : undefined }
  }

  async getStatus() {
    const raw = localStorage.getItem(this.key)
    if (!raw) return { healthy: true, message: 'No snapshot pushed yet.' }
    try {
      const p = deserializePayload(raw)
      return { healthy: true, lastSyncAt: p.metadata.updatedAt, message: 'Local snapshot available.' }
    } catch {
      return { healthy: false, message: 'Remote snapshot is corrupt.' }
    }
  }
}

/** Apply a pulled payload onto local data (mutates `d`). Manual links protected. */
export function applyPayload(d: PmoData, payload: AppStatePayload): { conflicts: LinkConflict[] } {
  const { merged, conflicts } = mergePlanLinks(d.planLinks || [], payload.planLinks)
  d.planLinks = merged
  // Admin settings are low-risk → last-write-wins from the incoming payload.
  d.adminSettings = payload.adminSettings
  // Re-apply geometry from canvas items (resize/move persist across sync).
  applyCanvasGeometry(d, payload.canvasItems)
  return { conflicts }
}

function applyCanvasGeometry(d: PmoData, items: AppStatePayload['canvasItems']) {
  const env = d.environment
  env.canvasPos = env.canvasPos || {}
  env.canvasSize = env.canvasSize || {}
  env.fwLocked = env.fwLocked || {}
  env.lockSize = env.lockSize || {}
  items.forEach((it) => {
    if (typeof it.x === 'number' && typeof it.y === 'number' && (it.x || it.y)) env.canvasPos![it.id] = { x: it.x, y: it.y }
    if (typeof it.width === 'number') env.canvasSize![it.id] = typeof it.height === 'number' ? { w: it.width, h: it.height } : { w: it.width }
    if (it.locked) env.fwLocked![it.id] = true
    if (it.lockSize) env.lockSize![it.id] = true
  })
}

/** Re-export so callers can keep a single import surface. */
export type { PlanItem }
