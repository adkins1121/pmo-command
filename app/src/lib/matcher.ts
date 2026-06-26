// Deterministic, heuristic AI matcher that proposes associations between
// environment service cards and project-plan items. The scoring combines title
// similarity, keyword overlap, vendor names and zone context — each weighted by
// admin-managed weights — and emits a confidence (0..1) plus a human rationale.
//
// An LLM hook (`MatchProvider`) is defined behind an interface so a real model
// can be wired in later without touching callers; the heuristic provider is the
// default and needs no network.

import type { AdminSettings, PlanItem, PlanLink, PmoData } from '../data/types'
import { listServices } from './canvasItems'
import { derivePlanItems } from './planItems'
import { nid } from '../data/helpers'

const STOP = new Set(['the', 'a', 'an', 'and', 'or', 'of', 'to', 'in', 'on', 'for', 'with', 'via', 'is', 'are', 'be', 'by', 'at', '·', '—', '-', '&', '/', 'only', 'every', 'this', 'that', 'from', 'same'])

export function tokenize(s: string): string[] {
  return (s || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .split(' ')
    .map((w) => w.trim())
    .filter((w) => w.length > 1 && !STOP.has(w))
}

// Curated domain keyword → plan-item-title fragments. Each hit is a strong
// signal that lifts confidence and is cited in the rationale.
const DOMAIN_HINTS: { keys: string[]; planMatch: RegExp; label: string }[] = [
  { keys: ['quickbooks', 'qbo', 'erpnext', 'finance', 'financial', 'ledger', 'reconcile', 'reconciliation'], planMatch: /financial|quickbooks|migration|reconcil/i, label: 'finance/migration' },
  { keys: ['ocr', 'paperless', 'document', 'receipt', 'invoice'], planMatch: /ocr|document/i, label: 'document/OCR' },
  { keys: ['ollama', 'llm', 'claude', 'gpt', 'embedding', 'embeddings', 'pgvector', 'graphiti', 'neo4j', 'graph', 'vector', 'agent', 'orchestrator', 'hermes', 'openclaw'], planMatch: /ai|architecture|data governance|talent/i, label: 'AI/architecture' },
  { keys: ['security', 'hipaa', 'phi', 'firewall', 'audit', 'custody', 'immutable', 'tls', 'vault'], planMatch: /security|hipaa|compliance/i, label: 'security/HIPAA' },
  { keys: ['nats', 'fastapi', 'graph', 'connector', 'connectors', 'bridge', 'devops', 'infrastructure', 'minio', 'postgres', 'backup', 'ci'], planMatch: /infrastructure|devops|engineering|repo/i, label: 'infra/devops' },
  { keys: ['report', 'reporting', 'bi', 'dashboard', 'p&l'], planMatch: /reporting|bi/i, label: 'reporting/BI' },
  { keys: ['rethink', 'rethinkbh', 'clinical', 'scheduling'], planMatch: /clinical|scheduling/i, label: 'clinical/scheduling' },
  { keys: ['email', 'outlook', 'gmail', 'intake', 'resume', 'talent', 'candidate'], planMatch: /talent|email|intake/i, label: 'talent/email-intake' },
  { keys: ['erpnext', 'appflowy', 'affine', 'obsidian', 'change', 'adoption', 'training'], planMatch: /change mgmt|organizational/i, label: 'change-management' },
]

export interface ScoreResult {
  confidence: number
  rationale: string
}

/** Score one service against one plan item. Pure + deterministic. */
export function scorePair(
  svc: { name: string; note: string; zoneName: string },
  plan: PlanItem,
  weights: AdminSettings['matcher'],
): ScoreResult {
  const svcTitleTok = tokenize(svc.name)
  const svcAllTok = new Set([...svcTitleTok, ...tokenize(svc.note)])
  const planTitleTok = tokenize(plan.title)
  const planAllTok = new Set([...planTitleTok, ...tokenize(plan.description || ''), ...(plan.tags || []).flatMap(tokenize)])

  // 1) Title similarity (Jaccard over title tokens).
  const titleInter = svcTitleTok.filter((t) => new Set(planTitleTok).has(t)).length
  const titleUnion = new Set([...svcTitleTok, ...planTitleTok]).size || 1
  const titleSim = titleInter / titleUnion

  // 2) Keyword overlap across full token sets.
  const kwInter = [...svcAllTok].filter((t) => planAllTok.has(t)).length
  const kwUnion = new Set([...svcAllTok, ...planAllTok]).size || 1
  let keywordSim = kwInter / kwUnion
  const reasons: string[] = []

  // Domain hints — a curated, high-signal match. Boost keyword similarity and
  // also add a flat confidence bonus so a clear domain match (e.g. QuickBooks →
  // Data Migration) lands in "covered" territory rather than scraping the floor.
  let domainBonus = 0
  for (const hint of DOMAIN_HINTS) {
    const svcHit = hint.keys.some((k) => svcAllTok.has(k))
    const planHit = hint.planMatch.test(plan.title) || hint.planMatch.test(plan.description || '')
    if (svcHit && planHit) {
      keywordSim = Math.min(1, keywordSim + 0.4)
      domainBonus = 0.3
      reasons.push('shared ' + hint.label + ' keywords')
      break
    }
  }
  if (kwInter > 0 && reasons.length === 0) reasons.push(kwInter + ' overlapping term' + (kwInter > 1 ? 's' : ''))

  // 3) Vendor match — plan item's vendor token appears in the service text.
  let vendorSim = 0
  if (plan.vendor) {
    const vTok = tokenize(plan.vendor)
    if (vTok.some((t) => svcAllTok.has(t))) {
      vendorSim = 1
      reasons.push('vendor ' + plan.vendor)
    }
  }

  // 4) Zone context — zone name tokens overlapping plan text.
  const zoneTok = tokenize(svc.zoneName)
  const zoneInter = zoneTok.filter((t) => planAllTok.has(t)).length
  const zoneSim = zoneTok.length ? zoneInter / zoneTok.length : 0
  if (zoneInter > 0) reasons.push('zone context')

  if (titleInter > 0) reasons.unshift('title overlap')

  const wSum = weights.weightTitle + weights.weightKeyword + weights.weightVendor + weights.weightZone || 1
  const raw =
    (weights.weightTitle * titleSim +
      weights.weightKeyword * keywordSim +
      weights.weightVendor * vendorSim +
      weights.weightZone * zoneSim) /
      wSum +
    domainBonus
  const confidence = Math.max(0, Math.min(1, Math.round(raw * 100) / 100))

  const rationale = reasons.length ? reasons.join(', ') : 'no meaningful signal'
  return { confidence, rationale }
}

/** Provider interface — heuristic today, swappable for a real LLM later. */
export interface MatchProvider {
  readonly id: string
  /** Return candidate links for one service across all plan items. */
  match(
    svc: { id: string; name: string; note: string; zoneName: string },
    planItems: PlanItem[],
    settings: AdminSettings,
  ): { planItemId: string; confidence: number; rationale: string }[]
}

export const heuristicProvider: MatchProvider = {
  id: 'heuristic',
  match(svc, planItems, settings) {
    return planItems
      .map((p) => {
        const { confidence, rationale } = scorePair(svc, p, settings.matcher)
        return { planItemId: p.id, confidence, rationale }
      })
      .filter((c) => c.confidence >= settings.coverage.reviewThreshold)
      .sort((a, b) => b.confidence - a.confidence)
  },
}

export interface AnalyzeResult {
  links: PlanLink[]
  /** Service ids with no candidate above the review threshold. */
  unmatched: string[]
}

/**
 * Run association across every environment service. Manual links are preserved
 * (and, when governance.lockManualLinks is on, their plan items are never
 * re-proposed by the AI). Returns the merged link set + unmatched item ids.
 */
export function analyzeCoverage(
  d: PmoData,
  settings: AdminSettings,
  nowIso: string,
  provider: MatchProvider = heuristicProvider,
): AnalyzeResult {
  const planItems = derivePlanItems(d)
  const services = listServices(d)
  const existing = d.planLinks || []

  // Keep all manual links + rejected links (so AI doesn't resurrect rejections).
  const manual = existing.filter((l) => l.source === 'manual')
  const rejected = existing.filter((l) => l.status === 'rejected')
  const keep = [...manual, ...rejected.filter((r) => r.source !== 'manual')]

  // Per service, which plan items are "claimed" by a manual/rejected decision.
  const claimed: Record<string, Set<string>> = {}
  keep.forEach((l) => {
    ;(claimed[l.canvasItemId] = claimed[l.canvasItemId] || new Set()).add(l.planItemId)
  })

  const aiLinks: PlanLink[] = []
  const unmatched: string[] = []

  for (const svc of services) {
    const candidates = provider.match(svc, planItems, settings)
    const fresh = candidates.filter((c) => !(claimed[svc.id] && claimed[svc.id].has(c.planItemId)))
    const accepted = fresh.filter((c) => c.confidence >= settings.coverage.reviewThreshold)

    if (accepted.length === 0 && !(claimed[svc.id] && claimed[svc.id].size)) unmatched.push(svc.id)

    // Cap at top 4 to keep the review queue tractable.
    accepted.slice(0, 4).forEach((c) => {
      aiLinks.push({
        id: nid('lnk'),
        canvasItemId: svc.id,
        planItemId: c.planItemId,
        source: 'ai',
        confidence: c.confidence,
        status: c.confidence >= settings.coverage.coverThreshold ? 'linked' : 'partial',
        rationale: c.rationale,
        createdAt: nowIso,
        updatedAt: nowIso,
      })
    })
  }

  return { links: [...keep, ...aiLinks], unmatched }
}
