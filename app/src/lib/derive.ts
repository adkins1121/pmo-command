import type { Objective, Owner, Phase, PmoData, Status, Stream } from '../data/types'
import { mix, pill } from '../data/helpers'

export const ACCENT_MAP: Record<string, string> = {
  Indigo: '#4A6491',
  Teal: '#3E7C6A',
  Plum: '#5B5391',
  Rust: '#A8553F',
}

export interface EnrichedStream {
  id: string
  code: string
  name: string
  blurb: string
  group: string
  phaseId: string
  ownerId: string
  status: Status
  start: number
  span: number
  deps: string[]
  depsText: string
  ownerName: string
  color: string
  pillText: string
  pillBg: string
  pillColor: string
  cardBg: string
  cardBorder: string
  workType: string
}

export interface DeriveMaps {
  ownerMap: Record<string, Owner>
  phaseMap: Record<string, Phase>
  objMap: Record<string, Objective>
  enrich: (s: Stream) => EnrichedStream
}

export function buildMaps(d: PmoData): DeriveMaps {
  const ownerMap: Record<string, Owner> = {}
  d.owners.forEach((o) => (ownerMap[o.id] = o))
  const phaseMap: Record<string, Phase> = {}
  d.phases.forEach((p) => (phaseMap[p.id] = p))
  const objMap: Record<string, Objective> = {}
  ;(d.objectives || []).forEach((o) => (objMap[o.id] = o))

  const enrich = (s: Stream): EnrichedStream => {
    const o = ownerMap[s.ownerId] || ({ name: '—', color: '#888' } as Owner)
    const color = o.color
    const planlike = s.status === 'plan' || s.status === 'risk'
    const p = pill(s.status, color)
    return {
      id: s.id,
      code: s.code,
      name: s.name,
      blurb: s.blurb,
      group: s.group,
      phaseId: s.phaseId,
      ownerId: s.ownerId,
      status: s.status,
      start: s.start,
      span: s.span,
      deps: s.deps || [],
      depsText: (s.deps || []).join(', '),
      ownerName: o.name,
      color,
      pillText: p.text,
      pillBg: p.bg,
      pillColor: p.color,
      cardBg: planlike ? '#FFFFFF' : mix(color, 0.95),
      cardBorder: planlike ? '1px dashed ' + color : '1px solid #E7E9EE',
      workType: s.workType || 'Epic',
    }
  }

  return { ownerMap, phaseMap, objMap, enrich }
}

/** Filter predicate matching the prototype's pass(). */
export function makePass(ui: {
  fPhase: string
  fOwner: string
  fStatus: string
  fObjective: string
  fWorkType: string
  fGroup: string
}) {
  return (s: Stream) =>
    (ui.fPhase === 'all' || s.phaseId === ui.fPhase) &&
    (ui.fOwner === 'all' || s.ownerId === ui.fOwner) &&
    (ui.fStatus === 'all' || s.status === ui.fStatus) &&
    (!ui.fObjective || ui.fObjective === 'all' || s.objectiveId === ui.fObjective) &&
    (!ui.fWorkType || ui.fWorkType === 'all' || (s.workType || 'Epic') === ui.fWorkType) &&
    (!ui.fGroup || ui.fGroup === 'all' || s.group === ui.fGroup)
}

export interface DepInfo {
  depthOf: Record<string, number>
  crit: Record<string, number>
  blockedBy: Record<string, string[]>
  codeMap: Record<string, Stream>
  maxD: number
}

/** Dependency depth + critical-path marking over a set of streams (by code). */
export function computeDeps(streams: Stream[]): DepInfo {
  const codeMap: Record<string, Stream> = {}
  streams.forEach((s) => (codeMap[s.code] = s))
  const memo: Record<string, number> = {}
  const depth = (code: string, seen?: Record<string, number>): number => {
    if (memo[code] != null) return memo[code]
    const s = codeMap[code]
    if (!s) return 0
    seen = seen || {}
    if (seen[code]) return 0
    const ns = Object.assign({}, seen)
    ns[code] = 1
    let m = 0
    ;(s.deps || []).forEach((c) => {
      if (codeMap[c]) m = Math.max(m, 1 + depth(c, ns))
    })
    memo[code] = m
    return m
  }
  const depthOf: Record<string, number> = {}
  streams.forEach((s) => (depthOf[s.code] = depth(s.code)))
  let maxD = 0
  Object.values(depthOf).forEach((v) => {
    if (v > maxD) maxD = v
  })
  const crit: Record<string, number> = {}
  const markCrit = (code: string) => {
    if (crit[code]) return
    crit[code] = 1
    const s = codeMap[code]
    if (!s) return
    const dd = depthOf[code]
    ;(s.deps || []).forEach((c) => {
      if (codeMap[c] && depthOf[c] === dd - 1) markCrit(c)
    })
  }
  streams.filter((s) => depthOf[s.code] === maxD && maxD > 0).forEach((s) => markCrit(s.code))
  const blockedBy: Record<string, string[]> = {}
  streams.forEach((s) => {
    ;(s.deps || []).forEach((c) => {
      ;(blockedBy[c] = blockedBy[c] || []).push(s.code)
    })
  })
  return { depthOf, crit, blockedBy, codeMap, maxD }
}
