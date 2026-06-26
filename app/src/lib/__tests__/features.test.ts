import { describe, it, expect } from 'vitest'
import { computeResize, handleDirs } from '../resize'
import type { Rect, ResizeOpts } from '../resize'
import { scorePair, analyzeCoverage } from '../matcher'
import { deriveCoverage, coverageByService, coverageSummary } from '../coverage'
import { buildPayload, serializePayload, deserializePayload, mergePlanLinks } from '../sync'
import { defaultAdminSettings } from '../admin'
import { getDefaults } from '../../data/defaults'
import { normalize } from '../../data/normalize'
import type { AdminSettings, PlanLink, PmoData } from '../../data/types'

const baseOpts = (over: Partial<ResizeOpts> = {}): ResizeOpts => ({ zoom: 1, snap: false, grid: 24, minW: 140, minH: 72, canW: true, canH: true, ...over })
const rect = (): Rect => ({ x: 100, y: 100, w: 200, h: 100 })
const settings = (): AdminSettings => defaultAdminSettings()
const freshData = (): PmoData => normalize(getDefaults())

/* -------------------------------- 1) resize ------------------------------- */
describe('2D resize math', () => {
  it('east handle widens without changing height (firewall case)', () => {
    const r = computeResize(rect(), 'e', 60, 0, baseOpts({ canH: false }))
    expect(r.w).toBe(260)
    expect(r.h).toBe(100) // unchanged
    expect(r.x).toBe(100)
  })

  it('south handle grows height without changing width (container case)', () => {
    const r = computeResize(rect(), 's', 0, 50, baseOpts())
    expect(r.h).toBe(150)
    expect(r.w).toBe(200)
  })

  it('accounts for zoom — same screen delta yields larger world delta at 0.5x', () => {
    const at1 = computeResize(rect(), 'e', 100, 0, baseOpts({ zoom: 1 }))
    const atHalf = computeResize(rect(), 'e', 100, 0, baseOpts({ zoom: 0.5 }))
    expect(at1.w).toBe(300)
    expect(atHalf.w).toBe(400) // 100 / 0.5 = 200 world px
  })

  it('snaps resized edges to the grid when snap is on', () => {
    const r = computeResize(rect(), 'e', 17, 0, baseOpts({ snap: true, grid: 24 }))
    expect(r.w % 24).toBe(0)
  })

  it('west handle moves the origin and keeps the right edge pinned', () => {
    const r = computeResize(rect(), 'w', 40, 0, baseOpts())
    expect(r.w).toBe(160)
    expect(r.x).toBe(140)
    expect(r.x + r.w).toBe(rect().x + rect().w) // right edge unchanged
  })

  it('enforces minimums and never goes negative', () => {
    const r = computeResize(rect(), 'w', 10000, 0, baseOpts({ minW: 140 }))
    expect(r.w).toBe(140)
    expect(r.w).toBeGreaterThan(0)
  })

  it('exposes 8 handles for 2D, 2 for width-only', () => {
    expect(handleDirs(true, true)).toHaveLength(8)
    expect(handleDirs(true, false)).toEqual(['e', 'w'])
  })
})

/* ------------------------------ 2) AI scoring ----------------------------- */
describe('AI matcher scoring', () => {
  it('scores a strong domain match high (QuickBooks → Data Migration)', () => {
    const s = scorePair(
      { name: 'QuickBooks Online', note: 'Legacy finance — being retired', zoneName: 'Internet · external cloud' },
      { id: 'p', kind: 'stream', title: 'Data Migration · QuickBooks', description: 'Extract, reshape, load, reconcile to the penny.' },
      settings().matcher,
    )
    expect(s.confidence).toBeGreaterThan(0.4)
    expect(s.rationale).toMatch(/keyword|term|overlap/i)
  })

  it('scores an unrelated pair low', () => {
    const s = scorePair(
      { name: 'Zoom Phone', note: 'Telephony', zoneName: 'Internet' },
      { id: 'p', kind: 'objective', title: 'Clinical operations on-platform under HIPAA' },
      settings().matcher,
    )
    expect(s.confidence).toBeLessThan(0.4)
  })

  it('confidence is bounded to [0,1]', () => {
    const s = scorePair({ name: 'OCR Paperless document receipt', note: 'document ocr', zoneName: 'Trusted apps' }, { id: 'p', kind: 'stream', title: 'OCR & Document Integration', description: 'document OCR receipt' }, settings().matcher)
    expect(s.confidence).toBeGreaterThanOrEqual(0)
    expect(s.confidence).toBeLessThanOrEqual(1)
  })
})

/* ---------------------------- 3) coverage logic --------------------------- */
describe('coverage derivation', () => {
  const link = (over: Partial<PlanLink>): PlanLink => ({ id: 'l', canvasItemId: 'x1', planItemId: 'p', source: 'ai', confidence: 0.8, status: 'linked', createdAt: '', updatedAt: '', ...over })

  it('is missing when there are no links', () => {
    expect(deriveCoverage([], settings()).status).toBe('missing')
  })
  it('is covered when a high-confidence link exists', () => {
    expect(deriveCoverage([link({ confidence: 0.8 })], settings()).status).toBe('covered')
  })
  it('needs review for mid confidence', () => {
    expect(deriveCoverage([link({ confidence: 0.4, status: 'partial' })], settings()).status).toBe('review')
  })
  it('a manual linked override is always covered', () => {
    expect(deriveCoverage([link({ source: 'manual', confidence: 0, status: 'linked' })], settings()).status).toBe('covered')
  })
  it('ignores rejected links', () => {
    expect(deriveCoverage([link({ status: 'rejected' })], settings()).status).toBe('missing')
  })
  it('summary counts every service', () => {
    const d = freshData()
    const map = coverageByService(d, settings())
    const sum = coverageSummary(map)
    expect(sum.total).toBe(Object.keys(map).length)
    expect(sum.total).toBeGreaterThan(0)
    // fresh data has no links → everything missing
    expect(sum.missing).toBe(sum.total)
  })
})

/* ------------------- 4) manual override precedence ------------------------ */
describe('manual override precedence', () => {
  it('analysis preserves manual links and does not re-suggest rejected pairs', () => {
    const d = freshData()
    const iso = '2026-01-01T00:00:00.000Z'
    d.planLinks = [
      { id: 'm1', canvasItemId: 'x5', planItemId: 'plan_stream_s_115', source: 'manual', confidence: 1, status: 'linked', createdAt: iso, updatedAt: iso },
      { id: 'r1', canvasItemId: 'x1', planItemId: 'plan_stream_s_1110', source: 'manual', confidence: 0, status: 'rejected', createdAt: iso, updatedAt: iso },
    ]
    const res = analyzeCoverage(d, settings(), iso)
    // manual link survives verbatim
    expect(res.links.find((l) => l.id === 'm1')).toBeTruthy()
    // rejected pair is not re-proposed as a fresh AI link
    const resurrected = res.links.find((l) => l.canvasItemId === 'x1' && l.planItemId === 'plan_stream_s_1110' && l.source === 'ai')
    expect(resurrected).toBeFalsy()
  })

  it('produces AI links for services with strong matches', () => {
    const d = freshData()
    const res = analyzeCoverage(d, settings(), '2026-01-01T00:00:00.000Z')
    expect(res.links.length).toBeGreaterThan(0)
    expect(res.links.some((l) => l.source === 'ai')).toBe(true)
  })
})

/* --------------------- 5) sync serialize / deserialize -------------------- */
describe('sync serialization', () => {
  it('round-trips a payload', () => {
    const d = freshData()
    const payload = buildPayload(d, 'test')
    const back = deserializePayload(serializePayload(payload))
    expect(back.metadata.version).toBe(payload.metadata.version)
    expect(back.planItems.length).toBe(payload.planItems.length)
    expect(back.canvasItems.length).toBe(payload.canvasItems.length)
    expect(back.adminSettings.coverage.coverThreshold).toBe(payload.adminSettings.coverage.coverThreshold)
  })

  it('tolerates a partial payload', () => {
    const back = deserializePayload('{"planLinks":[]}')
    expect(back.canvasItems).toEqual([])
    expect(back.adminSettings).toBeTruthy()
  })
})

/* ------------------ 6) conflict handling for manual maps ------------------ */
describe('plan-link conflict handling', () => {
  const mk = (over: Partial<PlanLink>): PlanLink => ({ id: 'l', canvasItemId: 'x1', planItemId: 'p', source: 'ai', confidence: 0.8, status: 'linked', createdAt: '', updatedAt: '2026-01-01T00:00:00.000Z', ...over })

  it('never discards a local manual override', () => {
    const local = [mk({ source: 'manual', status: 'linked' })]
    const remote = [mk({ source: 'ai', status: 'partial', updatedAt: '2027-01-01T00:00:00.000Z' })]
    const { merged, conflicts } = mergePlanLinks(local, remote)
    expect(merged).toHaveLength(1)
    expect(merged[0].source).toBe('manual')
    expect(conflicts).toHaveLength(0)
  })

  it('surfaces a reviewable conflict when both sides edited manually with different status', () => {
    const local = [mk({ source: 'manual', status: 'linked' })]
    const remote = [mk({ source: 'manual', status: 'rejected' })]
    const { merged, conflicts } = mergePlanLinks(local, remote)
    expect(conflicts).toHaveLength(1)
    expect(conflicts[0].kind).toBe('manual-divergence')
    expect(merged[0].status).toBe('linked') // local kept pending resolution
  })

  it('uses last-write-wins for two AI links', () => {
    const local = [mk({ source: 'ai', status: 'linked', updatedAt: '2026-01-01T00:00:00.000Z' })]
    const remote = [mk({ source: 'ai', status: 'partial', updatedAt: '2026-06-01T00:00:00.000Z' })]
    const { merged } = mergePlanLinks(local, remote)
    expect(merged[0].status).toBe('partial') // newer remote wins
  })

  it('keeps disjoint links from both sides', () => {
    const local = [mk({ id: 'a', planItemId: 'p1' })]
    const remote = [mk({ id: 'b', planItemId: 'p2' })]
    const { merged } = mergePlanLinks(local, remote)
    expect(merged).toHaveLength(2)
  })
})
