import { getDefaults, getObjectiveDefaults, planeDefaults, insightsPromptDefault } from './defaults'
import type { PmoData } from './types'
import { mergeAdminSettings } from '../lib/admin'

const HOUR = 3600 * 1000
const DAY = 86400000

/**
 * Faithful port of the prototype's normalize(): fills in any missing fields so
 * that older/partial saved data and freshly-built defaults both end up complete.
 * Mutates and returns `d`.
 */
export function normalize(d: any): PmoData {
  if (!d.objectives || !d.objectives.length) d.objectives = getObjectiveDefaults()
  const pd = planeDefaults()
  d.plane = d.plane
    ? Object.assign({}, pd, d.plane, { stateMap: Object.assign({}, pd.stateMap, d.plane.stateMap || {}) })
    : pd
  const m: Record<string, string> = {
    '11.3': 'obj1', '11.4': 'obj1', '11.5': 'obj1',
    '11.6': 'obj2', '11.7': 'obj2', '11.9': 'obj2',
    '11.1': 'obj3', '11.2': 'obj3', '5': 'obj3',
    '11.8': 'obj4', '3a': 'obj5', '2': 'obj6', '11.10': 'obj6',
  }
  const ids = d.objectives.map((o: any) => o.id)
  const mineDef: Record<string, number> = { '11.3': 1, '11.4': 1, '11.8': 1, '11.9': 1 }
  d.streams.forEach((s: any) => {
    if (!s.objectiveId || ids.indexOf(s.objectiveId) < 0) s.objectiveId = m[s.code] || d.objectives[0].id
    if (s.planeProjectId === undefined) s.planeProjectId = ''
    if (s.mine === undefined) s.mine = !!mineDef[s.code]
  })
  if (!d.connections)
    d.connections = { outlook: { connected: false, account: '' }, teams: { connected: false, account: '' } }
  if (d.meName === undefined) d.meName = 'You — AMDG lead'
  if (!d.labels)
    d.labels = [
      { id: 'lab_meeting', name: 'meeting', color: '#1E8A8A' },
      { id: 'lab_urgent', name: 'urgent', color: '#E03B2E' },
      { id: 'lab_review', name: 'review', color: '#2D6FE0' },
    ]
  if (d.insightsPrompt === undefined) d.insightsPrompt = insightsPromptDefault()
  if (!d.insights) d.insights = []
  if (!d.todos) d.todos = getDefaults().todos
  if (!d.inbox) d.inbox = getDefaults().inbox
  if (!d.decisions) d.decisions = getDefaults().decisions
  if (!d.blockers) d.blockers = getDefaults().blockers
  if (d.lastReportAt === undefined) d.lastReportAt = Date.now() - 26 * HOUR
  ;(d.todos || []).forEach((t: any) => {
    if (t.committed === undefined) t.committed = true
    if (t.done && t.completedAt === undefined) t.completedAt = Date.now() - 3 * DAY
    if (t.createdAt === undefined) t.createdAt = t.completedAt || Date.now() - 2 * DAY
    if (t.desc === undefined) t.desc = ''
    if (t.phaseId === undefined) t.phaseId = (d.phases[0] || {}).id
    if (t.objectiveId === undefined) t.objectiveId = ((d.objectives || [])[1] || (d.objectives || [])[0] || {}).id
    if (t.ownerId === undefined) t.ownerId = 'o_amdg'
    if (t.workType === undefined) t.workType = 'Task'
  })
  if (d.todos) {
    const have: Record<string, number> = {}
    d.todos.forEach((t: any) => (have[t.id] = 1))
    ;[
      { id: 'td7', text: 'Stood up practice + live ERPNext instances', source: 'plane', priority: 'high', done: true, committed: true, completedAt: Date.now() - 12 * HOUR },
      { id: 'td8', text: 'Completed chart-of-accounts mapping & transaction extract', source: 'plane', priority: 'high', done: true, committed: true, completedAt: Date.now() - 2 * HOUR },
    ].forEach((t) => {
      if (!have[t.id]) d.todos.push(t)
    })
  }
  d.streams.forEach((s: any) => {
    if (s.committed === undefined)
      s.committed = s.status === 'wip' || s.status === 'mixed' || s.status === 'done' || s.phaseId === 'p1'
    if (s.completedAt === undefined) s.completedAt = s.status === 'done' ? Date.now() - 2 * DAY : null
    if (s.workType === undefined) s.workType = 'Epic'
  })
  // Next-iteration fields: plan links, admin settings, sync bookkeeping.
  if (!Array.isArray(d.planLinks)) d.planLinks = []
  d.adminSettings = mergeAdminSettings(d.adminSettings)
  if (!d.syncState) d.syncState = { pendingChanges: 0, rev: 0 }
  if (typeof d.syncState.rev !== 'number') d.syncState.rev = 0
  if (typeof d.syncState.pendingChanges !== 'number') d.syncState.pendingChanges = 0
  return d as PmoData
}

/** migrate(): merge saved data over defaults (deep for environment), then normalize. */
export function migrate(d: any): PmoData {
  const def = getDefaults()
  const m = Object.assign({}, def, d, {
    environment: Object.assign({}, def.environment, d.environment || {}),
  })
  return normalize(m)
}
