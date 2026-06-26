import { describe, it, expect } from 'vitest'
import { buildSearchCorpus, searchAll, hitSources } from '../searchIndex'
import { aiSearch } from '../mockClaude'
import { normalize } from '../../data/normalize'
import { getDefaults } from '../../data/defaults'
import type { PmoData } from '../../data/types'

const fresh = (): PmoData => normalize(getDefaults())

describe('full-dataset search index', () => {
  it('indexes every entity type, not just streams', () => {
    const kinds = new Set(buildSearchCorpus(fresh()).map((e) => e.kind))
    // streams + objectives + phases + todos + inbox + decisions + blockers + env + vendors…
    expect(kinds.has('Work stream')).toBe(true)
    expect(kinds.has('Objective')).toBe(true)
    expect(kinds.has('Phase')).toBe(true)
    expect(kinds.has('To-do')).toBe(true)
    expect(kinds.has('Service')).toBe(true)
    expect(kinds.has('Vendor')).toBe(true)
    expect(kinds.size).toBeGreaterThanOrEqual(6)
  })

  it('finds environment services (not reachable by the old stream-only search)', () => {
    const hits = searchAll(fresh(), 'Paperless document')
    expect(hits.some((h) => h.kind === 'Service' && /paperless/i.test(h.title))).toBe(true)
  })

  it('finds work streams by keyword and ranks title hits high', () => {
    const hits = searchAll(fresh(), 'QuickBooks migration')
    expect(hits[0].kind).toBe('Work stream')
    expect(hits[0].title).toMatch(/quickbooks/i)
  })

  it('returns nothing for a gibberish query', () => {
    expect(searchAll(fresh(), 'zxqw nonsense')).toHaveLength(0)
  })

  it('attributes hits to multiple sources', () => {
    const hits = searchAll(fresh(), 'ERPNext reconcile finance HIPAA')
    expect(hitSources(hits).length).toBeGreaterThanOrEqual(1)
  })

  it('aiSearch works with no connected sources and reports it searched everything', async () => {
    const { answer, results } = await aiSearch(fresh(), 'OCR Paperless', [])
    expect(results.length).toBeGreaterThan(0)
    expect(answer).toMatch(/all available information/i)
  })

  it('aiSearch explains a no-match gracefully', async () => {
    const { answer, results } = await aiSearch(fresh(), 'zxqw', [])
    expect(results).toHaveLength(0)
    expect(answer).toMatch(/nothing matched/i)
  })
})
