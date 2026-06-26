// Derive per-service coverage status from plan links + admin thresholds, plus a
// program-wide roll-up for toolbar counters.

import type { AdminSettings, CoverageStatus, PlanLink, PmoData } from '../data/types'
import { listServices } from './canvasItems'

export interface CoverageInfo {
  status: CoverageStatus
  /** Best confidence among non-rejected links (0 when none). */
  best: number
  linkCount: number
  /** Short human explanation of why the item has this status. */
  reason: string
}

const CHIP: Record<CoverageStatus, { label: string; color: string; bg: string }> = {
  covered: { label: 'Covered', color: '#2F6B53', bg: '#E4EEE9' },
  partial: { label: 'Partial', color: '#8A6320', bg: '#F6EFE2' },
  review: { label: 'Needs review', color: '#2D6FE0', bg: '#E7EEFB' },
  missing: { label: 'Missing from plan', color: '#A8553F', bg: '#F6EAE6' },
}

export function coverageChip(status: CoverageStatus) {
  return CHIP[status]
}

/** Status for one service given its (already filtered to that service) links. */
export function deriveCoverage(links: PlanLink[], settings: AdminSettings): CoverageInfo {
  const active = links.filter((l) => l.status !== 'rejected')
  if (active.length === 0) return { status: 'missing', best: 0, linkCount: 0, reason: 'No plan items are associated with this service yet.' }

  const manualLinked = active.find((l) => l.source === 'manual' && l.status === 'linked')
  const best = active.reduce((m, l) => Math.max(m, l.confidence), 0)
  const { coverThreshold, reviewThreshold } = settings.coverage

  if (manualLinked) return { status: 'covered', best: Math.max(best, 1), linkCount: active.length, reason: 'Manually linked to a plan item.' }
  if (best >= coverThreshold) return { status: 'covered', best, linkCount: active.length, reason: `Linked with ${Math.round(best * 100)}% confidence.` }
  if (best >= reviewThreshold) return { status: 'review', best, linkCount: active.length, reason: `Top match is only ${Math.round(best * 100)}% confident — confirm or reject it.` }
  return { status: 'partial', best, linkCount: active.length, reason: 'Only weak associations were found.' }
}

/** Map every environment service id → its coverage info. */
export function coverageByService(d: PmoData, settings: AdminSettings): Record<string, CoverageInfo> {
  const byId: Record<string, PlanLink[]> = {}
  ;(d.planLinks || []).forEach((l) => (byId[l.canvasItemId] = byId[l.canvasItemId] || []).push(l))
  const out: Record<string, CoverageInfo> = {}
  listServices(d).forEach((s) => (out[s.id] = deriveCoverage(byId[s.id] || [], settings)))
  return out
}

export interface CoverageSummary {
  total: number
  covered: number
  partial: number
  review: number
  missing: number
  /** missing + review — the "needs attention" count. */
  attention: number
}

export function coverageSummary(map: Record<string, CoverageInfo>): CoverageSummary {
  const s: CoverageSummary = { total: 0, covered: 0, partial: 0, review: 0, missing: 0, attention: 0 }
  Object.values(map).forEach((c) => {
    s.total++
    s[c.status]++
  })
  s.attention = s.missing + s.review
  return s
}
