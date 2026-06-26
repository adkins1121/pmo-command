import type { AdminSettings } from '../data/types'

/** Factory for a complete AdminSettings object with sensible defaults. */
export function defaultAdminSettings(): AdminSettings {
  return {
    general: {
      programName: 'AMDG PMO · ERPNext ABES Program',
      autoAnalyze: false,
    },
    canvas: {
      minWidth: 140,
      minHeight: 72,
      gridSize: 24,
      snapDefault: true,
    },
    matcher: {
      weightTitle: 0.4,
      weightKeyword: 0.35,
      weightVendor: 0.15,
      weightZone: 0.1,
    },
    coverage: {
      coverThreshold: 0.55,
      reviewThreshold: 0.3,
    },
    sync: {
      adapter: 'local',
      endpoint: '',
      autoPush: false,
    },
    governance: {
      lockManualLinks: true,
      conflictStrategy: 'review',
    },
  }
}

/** Deep-merge persisted (possibly partial) settings over the defaults. */
export function mergeAdminSettings(saved?: Partial<AdminSettings>): AdminSettings {
  const d = defaultAdminSettings()
  if (!saved) return d
  return {
    general: { ...d.general, ...saved.general },
    canvas: { ...d.canvas, ...saved.canvas },
    matcher: { ...d.matcher, ...saved.matcher },
    coverage: { ...d.coverage, ...saved.coverage },
    sync: { ...d.sync, ...saved.sync },
    governance: { ...d.governance, ...saved.governance },
  }
}

export interface ValidationIssue {
  path: string
  message: string
}

const inRange = (v: number, lo: number, hi: number) => typeof v === 'number' && !Number.isNaN(v) && v >= lo && v <= hi

/** Validate thresholds, weights and required fields. Returns [] when clean. */
export function validateAdminSettings(s: AdminSettings): ValidationIssue[] {
  const issues: ValidationIssue[] = []

  if (!s.general.programName.trim()) issues.push({ path: 'general.programName', message: 'Program name is required.' })

  if (!inRange(s.canvas.minWidth, 40, 1000)) issues.push({ path: 'canvas.minWidth', message: 'Min width must be 40–1000.' })
  if (!inRange(s.canvas.minHeight, 24, 1000)) issues.push({ path: 'canvas.minHeight', message: 'Min height must be 24–1000.' })
  if (!inRange(s.canvas.gridSize, 4, 200)) issues.push({ path: 'canvas.gridSize', message: 'Grid size must be 4–200.' })

  ;(['weightTitle', 'weightKeyword', 'weightVendor', 'weightZone'] as const).forEach((k) => {
    if (!inRange(s.matcher[k], 0, 1)) issues.push({ path: 'matcher.' + k, message: 'Weight must be 0–1.' })
  })

  if (!inRange(s.coverage.coverThreshold, 0, 1)) issues.push({ path: 'coverage.coverThreshold', message: 'Cover threshold must be 0–1.' })
  if (!inRange(s.coverage.reviewThreshold, 0, 1)) issues.push({ path: 'coverage.reviewThreshold', message: 'Review threshold must be 0–1.' })
  if (inRange(s.coverage.coverThreshold, 0, 1) && inRange(s.coverage.reviewThreshold, 0, 1) && s.coverage.reviewThreshold > s.coverage.coverThreshold)
    issues.push({ path: 'coverage.reviewThreshold', message: 'Review threshold must be ≤ cover threshold.' })

  if (s.sync.adapter === 'remote' && !s.sync.endpoint.trim()) issues.push({ path: 'sync.endpoint', message: 'Endpoint is required for the remote adapter.' })

  return issues
}
