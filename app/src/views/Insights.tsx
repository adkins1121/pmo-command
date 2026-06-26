import { useState } from 'react'
import { useStore } from '../store/store'
import { useUI } from '../store/ui'
import { nid } from '../data/helpers'
import { insightsPromptDefault } from '../data/defaults'
import { buildHeuristicInsights, draftEmail, generateInsights, sortInsights } from '../lib/mockClaude'
import type { SourceRef } from '../data/types'

const altMeta: Record<string, { bg: string; color: string; label: string }> = {
  critical: { bg: '#F6E5E1', color: '#A8553F', label: 'CRITICAL' },
  high: { bg: '#F7EFE2', color: '#B07D3C', label: 'HIGH' },
  medium: { bg: '#EEF1F4', color: '#5A6473', label: 'MEDIUM' },
}

interface ActionModal {
  open: boolean
  what: string
  move: string
  instruction: string
  draft: string
  loading: boolean
}

export function Insights() {
  const { data, setData } = useStore()
  const ui = useUI()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [editOpen, setEditOpen] = useState(false)
  const [menuIdx, setMenuIdx] = useState<number | null>(null)
  const [note, setNote] = useState('')
  const [am, setAm] = useState<ActionModal>({ open: false, what: '', move: '', instruction: '', draft: '', loading: false })

  const insIsAI = !!(data.insights && data.insights.length)
  const rawIns = insIsAI ? sortInsights(data.insights) : sortInsights(buildHeuristicInsights(data))
  const insightsView = rawIns.map((f, i) => {
    const a = altMeta[f.altitude] || altMeta.medium
    return { ...f, n: i + 1, altBg: a.bg, altColor: a.color, altLabel: a.label, idx: i }
  })
  const whenLabel = insIsAI && data.insightsAt ? 'Generated ' + new Date(data.insightsAt).toLocaleString() : 'Heuristic preview · Generate to run the engine'
  const genBtn = loading ? 'Running…' : insIsAI ? 'Re-run engine' : 'Generate findings'

  const onGenerate = async () => {
    if (loading) return
    setLoading(true)
    setError('')
    try {
      const arr = await generateInsights(data)
      setData((d) => {
        d.insights = arr
        d.insightsAt = Date.now()
      })
    } catch (e: any) {
      setError((e && e.message) || String(e))
    } finally {
      setLoading(false)
    }
  }

  const flash = (m: string) => {
    setNote(m)
    setTimeout(() => setNote(''), 1800)
  }
  const srcOf = (move: string): SourceRef => ({ label: 'Claude', ref: 'Insights · ' + move.slice(0, 30) })

  const onActionTodo = (move: string) => {
    setData((d) => (d.todos = d.todos || []).unshift({ id: nid('td'), text: move, source: 'manual', priority: 'high', done: false, committed: true, workType: 'Task', createdAt: Date.now(), sourceRef: srcOf(move) }))
    setMenuIdx(null)
    flash('Added to your to-dos')
  }
  const onActionMeeting = (move: string) => {
    setData((d) => (d.todos = d.todos || []).unshift({ id: nid('td'), text: 'Schedule meeting — ' + move, source: 'teams', priority: 'high', done: false, committed: true, workType: 'Task', createdAt: Date.now(), sourceRef: srcOf(move) }))
    setMenuIdx(null)
    flash('Meeting added to to-dos')
  }
  const onActionPlan = (streamId?: string) => {
    setMenuIdx(null)
    if (streamId) ui.set({ view: 'board', itemId: streamId, itemKind: 'stream' })
    else ui.set({ view: 'board' })
  }
  const genDraft = async (what: string, move: string, instruction: string) => {
    setAm((s) => ({ ...s, loading: true, draft: '' }))
    try {
      const txt = await draftEmail(instruction || move, what)
      setAm((s) => ({ ...s, draft: txt, loading: false }))
    } catch (e: any) {
      setAm((s) => ({ ...s, draft: 'Could not draft — ' + ((e && e.message) || e), loading: false }))
    }
  }
  const onActionEmail = (what: string, move: string) => {
    setMenuIdx(null)
    setAm({ open: true, what, move, instruction: move, draft: '', loading: true })
    genDraft(what, move, move)
  }

  return (
    <div style={{ maxWidth: 1000, margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 6 }}>
        <div>
          <div style={{ font: "700 19px 'Libre Franklin'", color: '#1B2330' }}>Insights</div>
          <div style={{ font: "400 12.5px 'Libre Franklin'", color: '#7A8494', marginTop: 2 }}>
            Reconciliation engine — where the plan and the comms have come apart, worst first. Not a recap.
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flex: 'none' }}>
          <button onClick={() => setEditOpen((v) => !v)} className="mini-btn">Edit prompt</button>
          <button onClick={onGenerate} style={{ background: '#1B2330', color: '#fff', border: 'none', borderRadius: 7, padding: '9px 16px', font: "600 12.5px 'Libre Franklin'", cursor: 'pointer' }}>
            {genBtn}
          </button>
        </div>
      </div>
      <div style={{ font: "500 10px 'IBM Plex Mono',monospace", color: '#9AA3B2', marginBottom: 16 }}>{whenLabel}</div>

      {editOpen && (
        <div style={{ background: '#fff', border: '1px solid #E4E8EE', borderRadius: 8, padding: '14px 16px', marginBottom: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 9 }}>
            <span style={{ font: "700 12px 'Libre Franklin'", color: '#1B2330' }}>Engine prompt</span>
            <button
              onClick={() => {
                if (confirm('Reset the prompt to the default reconciliation engine?')) setData((d) => void (d.insightsPrompt = insightsPromptDefault()))
              }}
              className="mini-btn"
            >
              Reset to default
            </button>
          </div>
          <textarea
            value={data.insightsPrompt || ''}
            onChange={(e) => setData((d) => void (d.insightsPrompt = e.target.value))}
            style={{ width: '100%', minHeight: 260, border: '1px solid #E4E8EE', borderRadius: 6, padding: 12, font: "400 12px/1.6 'IBM Plex Mono',monospace", color: '#2A3242', resize: 'vertical', outline: 'none', background: '#FCFDFE' }}
          />
        </div>
      )}
      {error && (
        <div style={{ background: '#FBF1ED', border: '1px solid #E2C2B8', borderRadius: 8, padding: '11px 14px', marginBottom: 14, font: "500 12px 'Libre Franklin'", color: '#A8553F' }}>
          Couldn't reach the engine ({error}) — showing the heuristic preview below.
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {insightsView.map((f) => (
          <div key={f.idx} style={{ background: '#fff', border: '1px solid #E4E8EE', borderLeft: '4px solid ' + f.altColor, borderRadius: 8, padding: '16px 18px', boxShadow: '0 1px 2px rgba(20,30,50,.05)' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 13 }}>
              <span style={{ font: "800 18px 'Libre Franklin'", color: '#CBD2DC', flex: 'none', lineHeight: 1.25 }}>{f.n}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 9, marginBottom: 9 }}>
                  <span style={{ font: "700 13.5px/1.4 'Libre Franklin'", color: '#15202E', flex: 1 }}>{f.what}</span>
                  <span style={{ font: "700 8px 'IBM Plex Mono',monospace", padding: '3px 8px', borderRadius: 9, background: f.altBg, color: f.altColor, flex: 'none', marginTop: 2 }}>{f.altLabel}</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <Field label="EVIDENCE" value={f.evidence} />
                  <Field label="WHY IT MATTERS" value={f.why} />
                  <div>
                    <div style={{ font: "700 8.5px 'IBM Plex Mono',monospace", color: '#9AA3B2', letterSpacing: '.06em' }}>MOVE</div>
                    <div style={{ font: "600 12px/1.55 'Libre Franklin'", color: '#1B2330', marginTop: 2 }}>{f.move}</div>
                  </div>
                </div>
                {/* source link + actions */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 13, position: 'relative' }}>
                  <button onClick={() => setMenuIdx(menuIdx === f.idx ? null : f.idx)} style={{ background: '#15202E', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 15px', font: "600 12px 'Libre Franklin'", cursor: 'pointer' }}>
                    Take action ▾
                  </button>
                  <SourceChip s={f.sourceRef} />
                  {menuIdx === f.idx && (
                    <div style={{ position: 'absolute', left: 0, top: 40, zIndex: 5, background: '#fff', border: '1px solid #E4E8EE', borderRadius: 10, boxShadow: '0 16px 40px rgba(15,22,36,.24)', padding: 6, minWidth: 214, display: 'flex', flexDirection: 'column' }}>
                      <ActBtn label="＋  Create to-do" onClick={() => onActionTodo(f.move)} />
                      <ActBtn label="◷  Schedule meeting" onClick={() => onActionMeeting(f.move)} />
                      <ActBtn label="✎  Send email" onClick={() => onActionEmail(f.what, f.move)} />
                      <ActBtn label="▤  Update the plan" onClick={() => onActionPlan(f.streamId)} />
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* toast */}
      {note && (
        <div style={{ position: 'fixed', bottom: 22, left: '50%', transform: 'translateX(-50%)', background: '#15202E', color: '#fff', borderRadius: 9, padding: '10px 18px', font: "600 12px 'Libre Franklin'", zIndex: 80, boxShadow: '0 10px 30px rgba(0,0,0,.3)' }}>
          {note}
        </div>
      )}

      {/* action draft modal */}
      {am.open && (
        <div onClick={() => setAm((s) => ({ ...s, open: false }))} style={{ position: 'fixed', inset: 0, background: 'rgba(18,26,40,.46)', zIndex: 75, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 28 }}>
          <div onClick={(e) => e.stopPropagation()} style={{ width: 'min(680px,95vw)', background: '#fff', borderRadius: 14, boxShadow: '0 30px 80px rgba(15,22,36,.42)', overflow: 'hidden' }}>
            <div style={{ padding: '18px 22px 10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ font: "800 18px 'Libre Franklin'", color: '#15202E' }}>Send email · generative draft</div>
              <button onClick={() => setAm((s) => ({ ...s, open: false }))} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 18, color: '#9AA3B2' }}>✕</button>
            </div>
            <div style={{ padding: '0 22px 6px' }}>
              <div style={{ font: "700 9px 'IBM Plex Mono',monospace", color: '#9AA3B2', letterSpacing: '.06em', marginBottom: 6 }}>DESIRED OUTCOME</div>
              <div style={{ display: 'flex', gap: 8 }}>
                <input value={am.instruction} onChange={(e) => setAm((s) => ({ ...s, instruction: e.target.value }))} style={{ flex: 1, border: '1px solid #E4E8EE', borderRadius: 8, padding: '9px 11px', font: "500 13px 'Libre Franklin'", color: '#2A3242', outline: 'none' }} />
                <button onClick={() => genDraft(am.what, am.move, am.instruction)} className="mini-btn" style={{ padding: '0 12px' }}>↻ Regenerate</button>
              </div>
            </div>
            <div style={{ padding: '14px 22px' }}>
              <div style={{ background: '#F8FAFC', border: '1px solid #ECEEF2', borderRadius: 10, padding: 14, minHeight: 180, whiteSpace: 'pre-wrap', font: "400 13px/1.6 'Libre Franklin'", color: am.loading ? '#9AA3B2' : '#2A3242' }}>
                {am.loading ? 'Drafting…' : am.draft}
              </div>
            </div>
            <div style={{ borderTop: '1px solid #ECEEF2', padding: '12px 22px', display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <button
                onClick={() => {
                  try {
                    navigator.clipboard.writeText(am.draft)
                  } catch {
                    /* ignore */
                  }
                  flash('Draft copied')
                }}
                className="mini-btn"
                style={{ padding: '9px 16px' }}
              >
                ⧉ Copy draft
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div style={{ font: "700 8.5px 'IBM Plex Mono',monospace", color: '#9AA3B2', letterSpacing: '.06em' }}>{label}</div>
      <div style={{ font: "400 12px/1.55 'Libre Franklin'", color: '#5A6473', marginTop: 2 }}>{value}</div>
    </div>
  )
}

function ActBtn({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button className="hov-soft" onClick={onClick} style={{ textAlign: 'left', background: 'none', border: 'none', borderRadius: 7, padding: '9px 11px', font: "600 12.5px 'Libre Franklin'", color: '#1B2330', cursor: 'pointer' }}>
      {label}
    </button>
  )
}

function SourceChip({ s }: { s?: SourceRef }) {
  if (!s) return null
  const inner = (
    <>
      {s.url ? '↗ ' : ''}
      {s.label}
      {s.ref ? <span style={{ color: '#B7BEC9', marginLeft: 6 }}>· {s.ref}</span> : null}
    </>
  )
  const style: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    font: "600 10px 'IBM Plex Mono',monospace",
    color: s.url ? '#2D6FE0' : '#8A93A2',
    background: s.url ? '#EEF4FE' : '#F4F6F9',
    border: '1px solid ' + (s.url ? '#D6E4FB' : '#E4E8EE'),
    borderRadius: 6,
    padding: '4px 9px',
    textDecoration: 'none',
  }
  return s.url ? (
    <a href={s.url} target="_blank" rel="noopener" style={style} title="Open source">
      {inner}
    </a>
  ) : (
    <span style={style} title="Source">
      {inner}
    </span>
  )
}
