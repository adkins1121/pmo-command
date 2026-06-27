import type { Insight, PmoData } from '../data/types'
import { buildMaps, computeDeps } from './derive'
import { planeUrl } from './activity'
import { searchAll, hitSources } from './searchIndex'

const ALT_RANK: Record<string, number> = { critical: 0, high: 1, medium: 2 }

/**
 * Heuristic reconciliation findings, computed locally from the plan data.
 * This is both the "preview" shown before generation and the grounding the
 * mock engine returns. Every finding is source-linked (per requirement).
 */
export function buildHeuristicInsights(d: PmoData): Insight[] {
  const { ownerMap } = buildMaps(d)
  const { crit, blockedBy } = computeDeps(d.streams)
  const out: Insight[] = []

  d.streams.forEach((s) => {
    if ((s.status === 'plan' || s.status === 'risk') && s.committed && (blockedBy[s.code] || []).length) {
      const ow = (ownerMap[s.ownerId] || ({} as any)).name || '?'
      out.push({
        streamId: s.id,
        what: s.code + ' ' + s.name + ' is committed but shows no movement while downstream work depends on it.',
        evidence: 'Plan: ' + s.code + ' · status ' + s.status + ' · owner ' + ow + '. No traffic found (comms not connected).',
        why: 'Everything waiting on ' + s.code + ' (' + (blockedBy[s.code] || []).join(', ') + ') slips with it.',
        move: 'Confirm a start date and owner for ' + s.code + ' — ' + ow + '.',
        altitude: crit[s.code] ? 'critical' : 'high',
        sourceRef: { label: 'Claude', url: planeUrl(d, s), ref: 'reconciliation · ' + s.code },
      })
    }
  })
  ;(d.blockers || [])
    .filter((b) => b.active !== false)
    .forEach((b) => {
      const bs = b.streamCode ? d.streams.find((s) => s.code === b.streamCode) : undefined
      out.push({
        what: 'Unresolved blocker: ' + b.text,
        evidence: 'Plan blocker on ' + (b.streamCode || 'program') + ' · owner ' + (b.owner || 'unassigned') + '. Raised, still open.',
        why: 'A blocker that keeps recurring is escalating into a crisis.',
        move: 'Escalate to ' + (b.owner || 'the lead') + ' for a decision this week.',
        altitude: 'high',
        streamId: bs?.id,
        sourceRef: { label: 'Claude', url: bs ? planeUrl(d, bs) : undefined, ref: 'blocker · ' + (b.streamCode || 'program') },
      })
    })
  ;(d.decisions || [])
    .filter((x) => x.status !== 'resolved')
    .forEach((x) => {
      out.push({
        what: 'Decision raised and never landed: ' + x.text,
        evidence: 'Plan decision · owner ' + (x.owner || '?') + ' · status ' + (x.status || 'open') + '.',
        why: 'Streams are assuming an answer that does not exist yet.',
        move: 'Force a yes/no from ' + (x.owner || 'the owner') + '.',
        altitude: 'medium',
        sourceRef: { label: 'Claude', ref: 'decision log' },
      })
    })

  return out
}

export function sortInsights(arr: Insight[]): Insight[] {
  return arr
    .slice()
    .sort((a, b) => (ALT_RANK[a.altitude] ?? 3) - (ALT_RANK[b.altitude] ?? 3))
    .slice(0, 6)
}

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms))

/**
 * Mock "engine run". In production this is a Claude call (window.claude.complete
 * in the prototype, or a backend route). Here it returns grounded findings from
 * the plan so the feature is fully demoable with no key/network.
 */
export async function generateInsights(d: PmoData): Promise<Insight[]> {
  await delay(900)
  return sortInsights(buildHeuristicInsights(d))
}

/** Mock AI connector search — grounded synthesis attributed to connected sources. */
export async function aiSearch(
  d: PmoData,
  query: string,
  sources: string[],
): Promise<{ answer: string; results: { source: string; title: string; snippet: string; date: string }[] }> {
  await delay(650)
  // Search EVERY program entity, not just streams/blockers/decisions.
  const hits = searchAll(d, query)
  const results = hits.map((h) => ({ source: h.source, title: h.title, snippet: h.snippet, date: h.date || 'in plan' }))
  const found = hitSources(hits)
  const connected = (sources || []).filter((s) => s !== 'Claude')
  const scopeNote = connected.length ? ` Connected sources searched: ${connected.join(', ')}.` : ''

  let answer: string
  if (hits.length === 0) {
    answer =
      `I searched all available AMDG program information — work streams, objectives, phases, to-dos, inbox, decisions, blockers, the environment map, gates, constraints and vendors — but nothing matched "${query}". Try different or broader terms.` +
      scopeNote
  } else {
    const top = hits[0]
    answer =
      `Searching across all available information (${found.join(', ')}), the most relevant item for "${query}" is ${top.title} — ${top.snippet}.` +
      (hits.length > 1 ? ` ${hits.length - 1} more related item${hits.length - 1 === 1 ? '' : 's'} found across ${found.length} source${found.length === 1 ? '' : 's'}.` : '') +
      scopeNote
  }
  return { answer, results }
}

/** Mock generative draft (Take Action → Send email). */
export async function draftEmail(outcome: string, context: string): Promise<string> {
  await delay(700)
  const subj = outcome.length > 60 ? outcome.slice(0, 57) + '…' : outcome
  return (
    'Subject: ' + subj + '\n\n' +
    'Hi,\n\n' +
    `I'm following up to move this forward: ${outcome}. ` +
    (context ? `This closes a gap we're tracking — ${context}. ` : '') +
    'Could you confirm timing and owner by end of week so dependent work can proceed?\n\n' +
    'Thanks,\nAMDG PMO'
  )
}
