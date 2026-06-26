import type { PmoData, SourceRef, Stream } from '../data/types'
import type { ItemKind } from '../store/ui'
import { buildMaps } from './derive'

export type ActivityType = 'Plan update' | 'Decision' | 'Insight' | 'Blocker' | 'Task' | 'Comment'

export const ACTIVITY_TYPES: ActivityType[] = ['Plan update', 'Decision', 'Insight', 'Blocker', 'Task', 'Comment']

export const TYPE_COLOR: Record<ActivityType, string> = {
  'Plan update': '#3E7C6A',
  Decision: '#5B5391',
  Insight: '#2D6FE0',
  Blocker: '#A8553F',
  Task: '#B07D3C',
  Comment: '#5A6473',
}

export interface ActivityEntry {
  id: string
  type: ActivityType
  typeColor: string
  at: number
  title: string
  meta: string
  source: SourceRef
  openId?: string
  openKind?: ItemKind
}

const HOUR = 3600 * 1000

export function agoOf(ts: number, now: number): string {
  if (!ts) return ''
  const h = Math.round((now - ts) / HOUR)
  if (h < 1) return 'just now'
  if (h < 24) return h + 'h ago'
  return Math.round(h / 24) + 'd ago'
}

/** Plane deep link for a stream, when the workspace + project id are set. */
export function planeUrl(d: PmoData, s: Stream): string | undefined {
  const ws = (d.plane && d.plane.workspaceSlug) || ''
  if (!s.planeProjectId || !ws) return undefined
  const base = ((d.plane && d.plane.baseUrl) || 'https://app.plane.so').replace(/\/$/, '')
  return base + '/' + ws + '/projects/' + s.planeProjectId + '/issues/'
}

/** Resolve a todo's provenance into a SourceRef (always returns something). */
export function todoSource(t: { source: string; sourceRef?: SourceRef; text: string }): SourceRef {
  if (t.sourceRef) return t.sourceRef
  const map: Record<string, { label: string; url: string }> = {
    email: { label: 'Outlook', url: 'https://outlook.office.com/mail/' },
    teams: { label: 'Teams', url: 'https://teams.microsoft.com/' },
    plane: { label: 'Plane', url: 'https://app.plane.so/' },
    manual: { label: 'Manual', url: '' },
  }
  const m = map[t.source] || map.manual
  return { label: m.label, url: m.url || undefined, ref: m.label === 'Manual' ? 'entered by you' : t.text.slice(0, 38) }
}

export function buildActivity(d: PmoData, now: number): ActivityEntry[] {
  const { ownerMap } = buildMaps(d)
  const out: ActivityEntry[] = []

  // Plan updates — completed streams
  d.streams.forEach((s) => {
    if (s.status === 'done' && s.completedAt) {
      out.push({
        id: 'au_s_' + s.id,
        type: 'Plan update',
        typeColor: TYPE_COLOR['Plan update'],
        at: s.completedAt,
        title: s.code + ' · ' + s.name + ' marked Done',
        meta: (ownerMap[s.ownerId]?.name || '') + ' · work stream',
        source: { label: 'Plane', url: planeUrl(d, s), ref: s.code },
        openId: s.id,
        openKind: 'stream',
      })
    }
  })

  // Plan updates / completions — done todos
  ;(d.todos || []).forEach((t) => {
    if (t.done && t.completedAt) {
      out.push({
        id: 'au_t_' + t.id,
        type: 'Plan update',
        typeColor: TYPE_COLOR['Plan update'],
        at: t.completedAt,
        title: t.text + ' — completed',
        meta: 'ad-hoc to-do',
        source: todoSource(t),
        openId: t.id,
        openKind: 'todo',
      })
    }
  })

  // Tasks — created ad-hoc to-dos (open ones surface as "added")
  ;(d.todos || []).forEach((t) => {
    if (!t.done) {
      out.push({
        id: 'aa_t_' + t.id,
        type: 'Task',
        typeColor: TYPE_COLOR.Task,
        at: t.createdAt || now,
        title: t.text,
        meta: (t.priority || 'med') + ' priority · ' + (t.workType || 'Task'),
        source: todoSource(t),
        openId: t.id,
        openKind: 'todo',
      })
    }
  })

  // Decisions
  ;(d.decisions || []).forEach((x, i) => {
    out.push({
      id: 'ad_' + x.id,
      type: 'Decision',
      typeColor: TYPE_COLOR.Decision,
      at: (d.lastReportAt || now) - i * HOUR,
      title: (x.status === 'resolved' ? 'Resolved: ' : 'Open: ') + x.text,
      meta: (x.owner || 'unassigned') + (x.since ? ' · raised ' + x.since : ''),
      source: { label: x.owner || 'Program', ref: 'decision log' },
    })
  })

  // Blockers (active)
  ;(d.blockers || [])
    .filter((b) => b.active !== false)
    .forEach((b, i) => {
      const bs = b.streamCode ? d.streams.find((s) => s.code === b.streamCode) : undefined
      out.push({
        id: 'ab_' + b.id,
        type: 'Blocker',
        typeColor: TYPE_COLOR.Blocker,
        at: now - (i + 1) * HOUR,
        title: b.text,
        meta: (b.owner || 'unassigned') + (b.streamCode ? ' · ' + b.streamCode : ''),
        source: bs ? { label: 'Plane', url: planeUrl(d, bs), ref: bs.code } : { label: 'Plan', ref: 'blocker' },
        openId: bs?.id,
        openKind: bs ? 'stream' : undefined,
      })
    })

  // Insights — generated findings (must be source-linked)
  ;(d.insights || []).forEach((f, i) => {
    const linked = f.streamId ? d.streams.find((s) => s.id === f.streamId) : undefined
    const src: SourceRef =
      f.sourceRef ||
      (linked
        ? { label: 'Claude', url: planeUrl(d, linked), ref: 'reconciliation · ' + linked.code }
        : { label: 'Claude', ref: 'reconciliation engine' })
    out.push({
      id: 'ai_' + i,
      type: 'Insight',
      typeColor: TYPE_COLOR.Insight,
      at: (d.insightsAt || now) - i * 60000,
      title: f.what,
      meta: (f.altitude || 'medium').toUpperCase() + ' · ' + (f.move || ''),
      source: src,
      openId: linked?.id,
      openKind: linked ? 'stream' : undefined,
    })
  })

  // Comments on streams
  d.streams.forEach((s) => {
    ;(s.comments || []).forEach((c) => {
      out.push({
        id: 'ac_' + c.id,
        type: 'Comment',
        typeColor: TYPE_COLOR.Comment,
        at: c.at,
        title: c.text,
        meta: 'on ' + s.code + ' · ' + s.name,
        source: { label: 'You', ref: s.code },
        openId: s.id,
        openKind: 'stream',
      })
    })
  })

  return out.sort((a, b) => b.at - a.at)
}
