import { useMemo, useRef, useState } from 'react'
import { useStore } from '../store/store'
import { useUI } from '../store/ui'
import { exportJson, freshDefaults, readImportFile } from '../lib/io'
import { defaultAdminSettings, validateAdminSettings } from '../lib/admin'
import type { ValidationIssue } from '../lib/admin'
import { LocalSyncAdapter, applyPayload, buildPayload, deserializePayload, serializePayload } from '../lib/sync'
import type { LinkConflict } from '../lib/sync'
import type { AdminSettings, PmoData } from '../data/types'

type FieldType = 'text' | 'number' | 'toggle' | 'select'
interface Field {
  section: string
  path: string
  label: string
  help?: string
  type: FieldType
  min?: number
  max?: number
  step?: number
  options?: { v: string; l: string }[]
}

const SECTIONS = ['General', 'Canvas schema', 'Plan mapping', 'Coverage rules', 'Sync', 'Governance', 'Data management'] as const

const FIELDS: Field[] = [
  { section: 'General', path: 'general.programName', label: 'Program name', help: 'Shown across the app header and exports.', type: 'text' },
  { section: 'General', path: 'general.autoAnalyze', label: 'Auto-run AI association on dataset edits', help: 'Re-score coverage whenever environment data changes.', type: 'toggle' },

  { section: 'Canvas schema', path: 'canvas.minWidth', label: 'Minimum width (px)', help: 'Boxes and firewalls cannot be resized narrower than this.', type: 'number', min: 40, max: 1000, step: 2 },
  { section: 'Canvas schema', path: 'canvas.minHeight', label: 'Minimum height (px)', help: 'Containers and notes cannot be resized shorter than this.', type: 'number', min: 24, max: 1000, step: 2 },
  { section: 'Canvas schema', path: 'canvas.gridSize', label: 'Grid size (px)', help: 'Snap increment for moves and resize edges.', type: 'number', min: 4, max: 200, step: 1 },
  { section: 'Canvas schema', path: 'canvas.snapDefault', label: 'Snap to grid by default', type: 'toggle' },

  { section: 'Plan mapping', path: 'matcher.weightTitle', label: 'Title similarity weight', help: 'How much title overlap drives the match score (0–1).', type: 'number', min: 0, max: 1, step: 0.05 },
  { section: 'Plan mapping', path: 'matcher.weightKeyword', label: 'Keyword weight', help: 'Weight for shared domain keywords.', type: 'number', min: 0, max: 1, step: 0.05 },
  { section: 'Plan mapping', path: 'matcher.weightVendor', label: 'Vendor weight', help: 'Weight for matching vendor / owner names.', type: 'number', min: 0, max: 1, step: 0.05 },
  { section: 'Plan mapping', path: 'matcher.weightZone', label: 'Zone context weight', help: 'Weight for the zone the service sits in.', type: 'number', min: 0, max: 1, step: 0.05 },

  { section: 'Coverage rules', path: 'coverage.coverThreshold', label: 'Covered threshold', help: 'Confidence at/above which an item counts as Covered (0–1).', type: 'number', min: 0, max: 1, step: 0.05 },
  { section: 'Coverage rules', path: 'coverage.reviewThreshold', label: 'Review threshold', help: 'Confidence at/above which a match is surfaced for review (0–1).', type: 'number', min: 0, max: 1, step: 0.05 },

  { section: 'Sync', path: 'sync.adapter', label: 'Sync adapter', help: 'Local uses this browser as the store; remote targets an endpoint.', type: 'select', options: [{ v: 'local', l: 'Local (browser)' }, { v: 'remote', l: 'Remote endpoint' }] },
  { section: 'Sync', path: 'sync.endpoint', label: 'Remote endpoint', help: 'Base URL for the remote sync adapter.', type: 'text' },
  { section: 'Sync', path: 'sync.autoPush', label: 'Auto-push on save', type: 'toggle' },

  { section: 'Governance', path: 'governance.lockManualLinks', label: 'Protect manual plan links', help: 'AI re-analysis never overwrites links you set by hand.', type: 'toggle' },
  { section: 'Governance', path: 'governance.conflictStrategy', label: 'Conflict strategy', help: 'How sync resolves competing edits to mappings.', type: 'select', options: [{ v: 'review', l: 'Reviewable conflicts' }, { v: 'lww', l: 'Last write wins' }] },
]

function getPath(obj: any, path: string): any {
  return path.split('.').reduce((o, k) => (o == null ? o : o[k]), obj)
}
function setPath(obj: any, path: string, value: any): void {
  const ks = path.split('.')
  let o = obj
  for (let i = 0; i < ks.length - 1; i++) o = o[ks[i]]
  o[ks[ks.length - 1]] = value
}

const card: React.CSSProperties = { background: '#fff', border: '1px solid #E4E8EE', borderRadius: 10, padding: '18px 20px', boxShadow: '0 1px 2px rgba(20,30,50,.05)' }
const fieldLabel: React.CSSProperties = { font: "600 12.5px 'Libre Franklin'", color: '#1B2330' }
const fieldHelp: React.CSSProperties = { font: "400 11px/1.45 'Libre Franklin'", color: '#8A93A2', marginTop: 2 }
const inputStyle: React.CSSProperties = { border: '1px solid #E4E8EE', background: '#F8FAFC', borderRadius: 8, padding: '8px 10px', font: "600 12.5px 'Libre Franklin'", color: '#1B2330', outline: 'none' }

export function Admin() {
  const { data, setData, replaceData } = useStore()
  const ui = useUI()
  const fileRef = useRef<HTMLInputElement>(null)
  const payloadRef = useRef<HTMLInputElement>(null)

  const saved = data.adminSettings || defaultAdminSettings()
  const [draft, setDraft] = useState<AdminSettings>(() => JSON.parse(JSON.stringify(saved)))
  const [query, setQuery] = useState('')
  const [conflicts, setConflicts] = useState<LinkConflict[]>([])
  const [syncMsg, setSyncMsg] = useState<string>('')

  const dirty = useMemo(() => JSON.stringify(draft) !== JSON.stringify(saved), [draft, saved])
  const issues = useMemo(() => validateAdminSettings(draft), [draft])
  const issueByPath = useMemo(() => {
    const m: Record<string, ValidationIssue> = {}
    issues.forEach((i) => (m[i.path] = i))
    return m
  }, [issues])

  const adapter = useMemo(() => new LocalSyncAdapter(), [])
  const syncState = data.syncState || { pendingChanges: 0, rev: 0 }
  const pending = Math.max(0, (syncState.rev || 0) - (syncState.syncedRev || 0))

  const q = query.trim().toLowerCase()
  const visibleSections = SECTIONS.filter((sec) => {
    if (!q) return true
    if (sec.toLowerCase().includes(q)) return true
    return FIELDS.some((f) => f.section === sec && (f.label.toLowerCase().includes(q) || (f.help || '').toLowerCase().includes(q)))
  })
  const fieldsFor = (sec: string) =>
    FIELDS.filter((f) => f.section === sec && (!q || sec.toLowerCase().includes(q) || f.label.toLowerCase().includes(q) || (f.help || '').toLowerCase().includes(q)))

  const update = (path: string, value: any) => setDraft((d) => { const n = JSON.parse(JSON.stringify(d)); setPath(n, path, value); return n })

  const onSave = () => {
    if (issues.length) return
    setData((d) => { d.adminSettings = JSON.parse(JSON.stringify(draft)) })
    if (draft.sync.autoPush) setTimeout(onPush, 0)
  }
  const onResetDraft = () => setDraft(JSON.parse(JSON.stringify(saved)))
  const onResetDefaults = () => {
    if (!confirm('Reset all settings to factory defaults?')) return
    setDraft(defaultAdminSettings())
  }

  // ---- sync actions ----
  const onPush = async () => {
    try {
      const payload = buildPayload(data, 'admin-push')
      const res = await adapter.push(payload)
      setConflicts((res.conflicts as LinkConflict[]) || [])
      setData((d) => {
        d.syncState = d.syncState || { pendingChanges: 0, rev: 0 }
        d.syncState.lastSyncAt = new Date().toISOString()
        d.syncState.syncedRev = d.syncState.rev
        d.syncState.pendingChanges = 0
        d.syncState.lastError = undefined
      })
      setSyncMsg(res.conflicts && res.conflicts.length ? `Pushed with ${res.conflicts.length} conflict(s) to resolve.` : 'Pushed snapshot to local store.')
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Push failed'
      setData((d) => { if (d.syncState) d.syncState.lastError = msg })
      setSyncMsg(msg)
    }
  }
  const onPull = async () => {
    try {
      const payload = await adapter.pull()
      setData((d) => {
        const { conflicts: c } = applyPayload(d, payload)
        setConflicts(c)
        d.syncState = d.syncState || { pendingChanges: 0, rev: 0 }
        d.syncState.lastSyncAt = new Date().toISOString()
        d.syncState.lastError = undefined
      })
      setDraft(JSON.parse(JSON.stringify(payload.adminSettings)))
      setSyncMsg('Pulled snapshot from local store.')
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Pull failed'
      setData((d) => { if (d.syncState) d.syncState.lastError = msg })
      setSyncMsg(msg)
    }
  }
  const resolveConflict = (c: LinkConflict, keep: 'local' | 'remote') => {
    const chosen = keep === 'local' ? c.local : c.remote
    if (chosen) setData((d) => {
      d.planLinks = d.planLinks || []
      const i = d.planLinks.findIndex((l) => l.canvasItemId === c.canvasItemId && l.planItemId === c.planItemId)
      if (i >= 0) d.planLinks[i] = { ...chosen, updatedAt: new Date().toISOString() }
      else d.planLinks.push({ ...chosen })
    })
    setConflicts((cs) => cs.filter((x) => !(x.canvasItemId === c.canvasItemId && x.planItemId === c.planItemId)))
  }

  const exportPayload = () => {
    const blob = new Blob([serializePayload(buildPayload(data, 'export'))], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'amdg-pmo-sync.json'
    a.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }
  const importPayload = async (file: File) => {
    try {
      const payload = deserializePayload(await file.text())
      setData((d) => {
        const { conflicts: c } = applyPayload(d, payload)
        setConflicts(c)
      })
      setDraft(JSON.parse(JSON.stringify(payload.adminSettings)))
      setSyncMsg('Imported sync payload.')
    } catch {
      setSyncMsg('Could not parse that sync payload.')
    }
  }

  const renderField = (f: Field) => {
    const val = getPath(draft, f.path)
    const issue = issueByPath[f.path]
    return (
      <div key={f.path} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, padding: '11px 0', borderBottom: '1px solid #F1F3F6' }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={fieldLabel}>{f.label}</div>
          {f.help && <div style={fieldHelp}>{f.help}</div>}
          {issue && <div style={{ font: "600 11px 'Libre Franklin'", color: '#C2410C', marginTop: 3 }}>⚠ {issue.message}</div>}
        </div>
        <div style={{ flex: 'none', width: 200, display: 'flex', justifyContent: 'flex-end' }}>
          {f.type === 'toggle' ? (
            <button
              onClick={() => update(f.path, !val)}
              style={{ border: '1px solid ' + (val ? '#BFE0CF' : '#D5DBE3'), background: val ? '#E4EEE9' : '#fff', color: val ? '#2F6B53' : '#5A6473', borderRadius: 7, padding: '7px 14px', font: "700 11px 'IBM Plex Mono',monospace", cursor: 'pointer' }}
            >
              {val ? 'ON' : 'OFF'}
            </button>
          ) : f.type === 'select' ? (
            <select value={val} onChange={(e) => update(f.path, e.target.value)} style={{ ...inputStyle, width: '100%', cursor: 'pointer', borderColor: issue ? '#E6A08F' : '#E4E8EE' }}>
              {f.options!.map((o) => (<option key={o.v} value={o.v}>{o.l}</option>))}
            </select>
          ) : f.type === 'number' ? (
            <input type="number" value={val} min={f.min} max={f.max} step={f.step} onChange={(e) => update(f.path, e.target.value === '' ? '' : Number(e.target.value))} style={{ ...inputStyle, width: 110, textAlign: 'right', borderColor: issue ? '#E6A08F' : '#E4E8EE' }} />
          ) : (
            <input value={val ?? ''} onChange={(e) => update(f.path, e.target.value)} style={{ ...inputStyle, width: '100%', borderColor: issue ? '#E6A08F' : '#E4E8EE' }} />
          )}
        </div>
      </div>
    )
  }

  return (
    <div style={{ maxWidth: 980, margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 6, gap: 16 }}>
        <div>
          <div style={{ font: "700 19px 'Libre Franklin'", color: '#1B2330' }}>Admin</div>
          <div style={{ font: "400 12.5px/1.5 'Libre Franklin'", color: '#7A8494', marginTop: 2 }}>
            Manage features, matching rules, coverage thresholds, governance and sync. Changes stay as a draft until you Save.
          </div>
        </div>
        <button onClick={() => ui.set({ view: 'env' })} style={{ flex: 'none', border: '1px solid #D5DBE3', background: '#fff', color: '#5A6473', borderRadius: 7, padding: '8px 14px', font: "600 12px 'Libre Franklin'", cursor: 'pointer' }}>← Back to Environment</button>
      </div>

      {/* sticky action bar */}
      <div style={{ position: 'sticky', top: 0, zIndex: 5, display: 'flex', alignItems: 'center', gap: 10, padding: '12px 0', background: '#EEF1F5' }}>
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search settings…" style={{ ...inputStyle, flex: 1 }} />
        {dirty && <span style={{ font: "700 11px 'Libre Franklin'", color: '#B45309', background: '#FEF3E2', borderRadius: 7, padding: '7px 11px' }}>● Unsaved changes</span>}
        {issues.length > 0 && <span style={{ font: "700 11px 'Libre Franklin'", color: '#C2410C', background: '#FBEAE5', borderRadius: 7, padding: '7px 11px' }}>{issues.length} issue{issues.length > 1 ? 's' : ''}</span>}
        <button onClick={onResetDraft} disabled={!dirty} style={{ border: '1px solid #D5DBE3', background: '#fff', color: dirty ? '#5A6473' : '#B7BEC9', borderRadius: 7, padding: '8px 14px', font: "600 12px 'Libre Franklin'", cursor: dirty ? 'pointer' : 'not-allowed' }}>Reset</button>
        <button onClick={onSave} disabled={!dirty || issues.length > 0} style={{ border: 'none', background: !dirty || issues.length ? '#C5CCD6' : '#3E7C6A', color: '#fff', borderRadius: 7, padding: '8px 18px', font: "700 12px 'Libre Franklin'", cursor: !dirty || issues.length ? 'not-allowed' : 'pointer' }}>Save changes</button>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 16, paddingBottom: 40 }}>
        {visibleSections.map((sec) => (
          <div key={sec} style={card}>
            <div style={{ font: "700 13px 'Libre Franklin'", color: '#1B2330', marginBottom: 4 }}>{sec}</div>
            {sec !== 'Sync' && sec !== 'Data management' && fieldsFor(sec).map(renderField)}

            {sec === 'Sync' && (
              <>
                {fieldsFor('Sync').map(renderField)}
                <div style={{ display: 'flex', gap: 10, marginTop: 14, flexWrap: 'wrap' }}>
                  <button onClick={onPull} style={{ border: '1px solid #D5DBE3', background: '#fff', color: '#1B2330', borderRadius: 7, padding: '9px 16px', font: "600 12px 'Libre Franklin'", cursor: 'pointer' }}>↓ Pull</button>
                  <button onClick={onPush} style={{ border: 'none', background: '#1B2330', color: '#fff', borderRadius: 7, padding: '9px 16px', font: "600 12px 'Libre Franklin'", cursor: 'pointer' }}>↑ Push</button>
                  <button onClick={exportPayload} style={{ border: '1px solid #D5DBE3', background: '#fff', color: '#1B2330', borderRadius: 7, padding: '9px 16px', font: "600 12px 'Libre Franklin'", cursor: 'pointer' }}>Export payload</button>
                  <button onClick={() => payloadRef.current?.click()} style={{ border: '1px solid #D5DBE3', background: '#fff', color: '#1B2330', borderRadius: 7, padding: '9px 16px', font: "600 12px 'Libre Franklin'", cursor: 'pointer' }}>Import payload</button>
                </div>
                <div style={{ display: 'flex', gap: 18, marginTop: 14, flexWrap: 'wrap', font: "500 11.5px 'Libre Franklin'", color: '#5A6473' }}>
                  <span>Last synced: <b style={{ color: '#1B2330' }}>{syncState.lastSyncAt ? new Date(syncState.lastSyncAt).toLocaleString() : 'never'}</b></span>
                  <span>Pending changes: <b style={{ color: pending > 0 ? '#B45309' : '#2F6B53' }}>{pending}</b></span>
                  {syncState.lastError && <span style={{ color: '#C2410C' }}>Last error: {syncState.lastError}</span>}
                </div>
                {syncMsg && <div style={{ marginTop: 8, font: "500 11.5px 'Libre Franklin'", color: '#2D6FE0' }}>{syncMsg}</div>}

                {conflicts.length > 0 && (
                  <div style={{ marginTop: 14, border: '1px solid #F0D9A8', background: '#FEFAF0', borderRadius: 9, padding: '12px 14px' }}>
                    <div style={{ font: "700 12px 'Libre Franklin'", color: '#92400E', marginBottom: 8 }}>Resolve mapping conflicts ({conflicts.length})</div>
                    {conflicts.map((c, i) => (
                      <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, padding: '8px 0', borderTop: i ? '1px solid #F3E6C8' : 'none' }}>
                        <span style={{ font: "500 11.5px 'Libre Franklin'", color: '#5A4A2A' }}>
                          {c.canvasItemId} ↔ {c.planItemId}: local <b>{c.local?.status}</b> vs remote <b>{c.remote?.status}</b>
                        </span>
                        <span style={{ display: 'flex', gap: 6, flex: 'none' }}>
                          <button onClick={() => resolveConflict(c, 'local')} style={{ border: '1px solid #BFE0CF', background: '#E4EEE9', color: '#2F6B53', borderRadius: 6, padding: '5px 10px', font: "600 11px 'Libre Franklin'", cursor: 'pointer' }}>Keep local</button>
                          <button onClick={() => resolveConflict(c, 'remote')} style={{ border: '1px solid #D5DBE3', background: '#fff', color: '#5A6473', borderRadius: 6, padding: '5px 10px', font: "600 11px 'Libre Franklin'", cursor: 'pointer' }}>Keep remote</button>
                        </span>
                      </div>
                    ))}
                  </div>
                )}
                <input type="file" accept="application/json" ref={payloadRef} onChange={async (e) => { const f = e.target.files?.[0]; if (f) await importPayload(f); e.target.value = '' }} style={{ display: 'none' }} />
              </>
            )}

            {sec === 'Data management' && (
              <>
                <div style={{ font: "400 11.5px/1.5 'Libre Franklin'", color: '#7A8494', marginBottom: 12 }}>
                  Export or import the full program dataset, or reset everything to factory defaults. Manual plan links are preserved on import.
                </div>
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                  <button onClick={() => exportJson(data)} style={{ border: '1px solid #D5DBE3', background: '#fff', color: '#1B2330', borderRadius: 7, padding: '9px 16px', font: "600 12px 'Libre Franklin'", cursor: 'pointer' }}>Export full dataset</button>
                  <button onClick={() => fileRef.current?.click()} style={{ border: '1px solid #D5DBE3', background: '#fff', color: '#1B2330', borderRadius: 7, padding: '9px 16px', font: "600 12px 'Libre Franklin'", cursor: 'pointer' }}>Import full dataset</button>
                  <button onClick={onResetDefaults} style={{ border: '1px solid #E6A08F', background: '#fff', color: '#C2410C', borderRadius: 7, padding: '9px 16px', font: "600 12px 'Libre Franklin'", cursor: 'pointer' }}>Reset settings to defaults</button>
                  <button
                    onClick={() => { if (confirm('Reset ALL program data to defaults? This clears saved edits, mappings and settings.')) { replaceData(freshDefaults() as PmoData); setDraft(defaultAdminSettings()) } }}
                    style={{ border: '1px solid #E6A08F', background: '#FBEAE5', color: '#C2410C', borderRadius: 7, padding: '9px 16px', font: "600 12px 'Libre Franklin'", cursor: 'pointer' }}
                  >
                    Reset all data
                  </button>
                </div>
                <input type="file" accept="application/json" ref={fileRef} onChange={async (e) => { const f = e.target.files?.[0]; if (!f) return; try { replaceData(await readImportFile(f)) } catch { alert('Could not parse that JSON file.') } e.target.value = '' }} style={{ display: 'none' }} />
              </>
            )}
          </div>
        ))}
        {visibleSections.length === 0 && <div style={{ ...card, textAlign: 'center', color: '#8A93A2', font: "500 13px 'Libre Franklin'" }}>No settings match “{query}”.</div>}
      </div>
    </div>
  )
}
