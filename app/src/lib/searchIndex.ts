// Full-dataset search index for the AI assistant. Builds a corpus over EVERY
// program entity — work streams, objectives, phases, to-dos, inbox, decisions,
// blockers, environment services, gates, constraints, vendors and insights —
// so "Ask AI" searches all available information, not just a few tables.
//
// Pure + deterministic (no network), so it works with no connectors and is
// fully testable. Source attribution reflects where each item naturally lives.

import type { PmoData } from '../data/types'
import { buildMaps } from './derive'
import { tokenize } from './matcher'

export interface CorpusEntry {
  source: string
  kind: string
  title: string
  snippet: string
  date: string
  text: string
}

export interface SearchHit extends CorpusEntry {
  score: number
}

export function buildSearchCorpus(d: PmoData): CorpusEntry[] {
  const { ownerMap } = buildMaps(d)
  const c: CorpusEntry[] = []
  const ownerName = (id?: string) => (id && ownerMap[id] ? ownerMap[id].name : '')

  d.streams.forEach((s) =>
    c.push({ source: 'Plane', kind: 'Work stream', title: s.code + ' ' + s.name, snippet: s.blurb || s.name + ' — status ' + s.status, date: 'in plan', text: [s.code, s.name, s.blurb, s.group, ownerName(s.ownerId), s.status, (s.deps || []).join(' ')].join(' ') }),
  )
  ;(d.objectives || []).forEach((o) => c.push({ source: 'Plan', kind: 'Objective', title: o.code + ' ' + o.name, snippet: o.outcome, date: 'objective', text: [o.code, o.name, o.outcome].join(' ') }))
  d.phases.forEach((p) => c.push({ source: 'Plan', kind: 'Phase', title: 'P' + p.n + ' ' + p.name, snippet: p.sub, date: 'phase', text: [p.name, p.sub].join(' ') }))
  ;(d.todos || []).forEach((t) => {
    const src = t.source === 'email' ? 'Outlook' : t.source === 'teams' ? 'Teams' : t.source === 'plane' ? 'Plane' : 'To-do'
    c.push({ source: src, kind: 'To-do', title: t.text, snippet: t.desc || (t.priority || 'med') + ' priority' + (t.done ? ' · done' : ''), date: 'task', text: [t.text, t.desc, ownerName(t.ownerId)].join(' ') })
  })
  ;(d.inbox || []).forEach((m) => c.push({ source: /gmail/i.test(m.from) ? 'Gmail' : 'Outlook', kind: 'Email', title: m.subject, snippet: m.snippet, date: m.age || 'recent', text: [m.subject, m.snippet, m.from].join(' ') }))
  ;(d.decisions || []).forEach((x) => c.push({ source: 'Plan', kind: 'Decision', title: x.text, snippet: 'owner ' + (x.owner || '?') + ' · ' + (x.status || 'open'), date: x.since || '', text: [x.text, x.owner, x.status].join(' ') }))
  ;(d.blockers || []).filter((b) => b.active !== false).forEach((b) => c.push({ source: 'Plan', kind: 'Blocker', title: b.text, snippet: 'owner ' + (b.owner || '?') + ' · blocks ' + (b.streamCode || 'program'), date: 'active', text: [b.text, b.owner, b.streamCode].join(' ') }))

  const svc = (zoneName: string, s: { name: string; note: string }) => c.push({ source: 'Environment', kind: 'Service', title: s.name, snippet: s.note + ' · ' + zoneName, date: 'environment', text: [s.name, s.note, zoneName].join(' ') })
  ;(d.environment.extCloud.services || []).forEach((s) => svc(d.environment.extCloud.title, s))
  d.environment.zones.forEach((z) => z.services.forEach((s) => svc(z.name, s)))

  ;(d.gates || []).forEach((g) => c.push({ source: 'Plan', kind: 'Gate', title: g.label, snippet: g.note, date: 'gate', text: [g.label, g.note].join(' ') }))
  ;(d.constraints || []).forEach((x) => c.push({ source: 'Plan', kind: 'Constraint', title: x.text, snippet: '', date: 'constraint', text: x.text }))
  d.owners.forEach((o) => c.push({ source: 'Plan', kind: 'Vendor', title: o.name, snippet: o.role, date: 'vendor', text: [o.name, o.role].join(' ') }))
  ;(d.insights || []).forEach((i) => c.push({ source: 'Claude', kind: 'Insight', title: i.what, snippet: i.move, date: 'insight', text: [i.what, i.evidence, i.why, i.move].join(' ') }))

  return c
}

/** Rank the whole corpus against a query. Title hits weigh more than body hits. */
export function searchAll(d: PmoData, query: string, limit = 8): SearchHit[] {
  const q = tokenize(query)
  if (q.length === 0) return []
  const qset = new Set(q)
  return buildSearchCorpus(d)
    .map((e) => {
      const bodyToks = new Set(tokenize(e.text))
      const titleToks = new Set(tokenize(e.title))
      let score = 0
      qset.forEach((t) => {
        if (titleToks.has(t)) score += 2
        else if (bodyToks.has(t)) score += 1
      })
      return { ...e, score }
    })
    .filter((e) => e.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
}

/** Distinct sources represented in a hit list, for attribution. */
export function hitSources(hits: SearchHit[]): string[] {
  return Array.from(new Set(hits.map((h) => h.source)))
}
