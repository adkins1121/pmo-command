import { describe, it, expect } from 'vitest'
import { defaultAdminSettings, mergeAdminSettings, validateAdminSettings } from '../admin'

describe('admin theme settings', () => {
  it('ships default brand colors', () => {
    const d = defaultAdminSettings()
    expect(d.theme.primary).toMatch(/^#[0-9a-f]{6}$/i)
    expect(d.theme.accent).toMatch(/^#[0-9a-f]{6}$/i)
  })

  it('merges a partial saved theme over defaults', () => {
    const m = mergeAdminSettings({ theme: { primary: '#112233' } as any })
    expect(m.theme.primary).toBe('#112233')
    expect(m.theme.accent).toBe(defaultAdminSettings().theme.accent) // filled
  })

  it('rejects non-hex colors', () => {
    const s = defaultAdminSettings()
    s.theme.primary = 'red'
    s.theme.accent = '#zzz'
    const issues = validateAdminSettings(s)
    expect(issues.find((i) => i.path === 'theme.primary')).toBeTruthy()
    expect(issues.find((i) => i.path === 'theme.accent')).toBeTruthy()
  })

  it('accepts 3- and 6-digit hex', () => {
    const s = defaultAdminSettings()
    s.theme.primary = '#abc'
    s.theme.accent = '#0E7C7B'
    expect(validateAdminSettings(s).filter((i) => i.path.startsWith('theme.'))).toHaveLength(0)
  })
})
