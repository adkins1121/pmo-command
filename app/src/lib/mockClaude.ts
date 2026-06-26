import type { Insight, PmoData } from '../data/types'
import { buildMaps, computeDeps } from './derive'
import { planeUrl } from './activity'

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
  await delay(850)
  const { ownerMap } = buildMaps(d)
  const { blockedBy } = computeDeps(d.streams)
  const risky = d.streams.filter((s) => s.status === 'risk' || s.status === 'plan')
  const top = risky[0] || d.streams[0]
  const owner = (ownerMap[top.ownerId] || ({} as any)).name || 'the owner'
  const blockers = (d.blockers || []).filter((b) => b.active !== false)

  const answer =
    `Across ${sources.join(', ')}, the thread most relevant to "${query}" is ${top.code} ${top.name} (owner ${owner}). ` +
    (blockers.length
      ? `It's gated by an open blocker — "${blockers[0].text}" (owner ${blockers[0].owner}). `
      : '') +
    (blockedBy[top.code]?.length ? `Downstream ${blockedBy[top.code].join(', ')} are waiting on it.` : 'No downstream work is waiting on it yet.')

  const pick = (i: number) => sources[i % sources.length]
  const results = [
    { source: pick(0), title: 'Re: ' + top.code + ' ' + top.name, snippet: `Latest on ${top.code}: ${top.blurb}`, date: '2 days ago' },
    blockers[0]
      ? { source: pick(1), title: blockers[0].text.slice(0, 48), snippet: `Owner ${blockers[0].owner} flagged this as blocking ${blockers[0].streamCode}.`, date: '3 days ago' }
      : null,
    (d.decisions || [])[0]
      ? { source: pick(2), title: 'Decision: ' + (d.decisions[0].text.slice(0, 44)), snippet: `Raised by ${d.decisions[0].owner}, still ${d.decisions[0].status}.`, date: '5 days ago' }
      : null,
  ].filter(Boolean) as { source: string; title: string; snippet: string; date: string }[]

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
