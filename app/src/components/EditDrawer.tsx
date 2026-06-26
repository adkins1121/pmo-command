import { useEffect, useRef, useState } from 'react'
import { useStore } from '../store/store'
import { useUI } from '../store/ui'
import { nid } from '../data/helpers'
import { buildBrief, pushToPlane } from '../lib/plane'
import { fetchPlaneStatus, pullPlane } from '../lib/planeClient'
import type { PlaneStatus } from '../lib/planeClient'
import { mergePlanePull } from '../lib/planeMerge'
import { exportJson, freshDefaults, readImportFile } from '../lib/io'
import type { PmoData, Status } from '../data/types'

const TABS = [
  { id: 'objectives', label: 'Objectives' },
  { id: 'streams', label: 'Streams' },
  { id: 'structure', label: 'Phases · Vendors' },
  { id: 'env', label: 'Environment' },
  { id: 'data', label: 'Data' },
  { id: 'plane', label: 'Plane sync' },
]
const STATUS_OPTS = [
  { v: 'done', l: 'Done' },
  { v: 'wip', l: 'In progress' },
  { v: 'mixed', l: 'Partly done' },
  { v: 'plan', l: 'Planned' },
  { v: 'risk', l: 'At risk' },
]

export function EditDrawer() {
  const { data, setData, replaceData } = useStore()
  const ui = useUI()
  const fileRef = useRef<HTMLInputElement>(null)

  const open = ui.edit && !ui.editCollapsed
  const tab = ui.drawerTab

  const tabStyle = (active: boolean): React.CSSProperties => ({
    borderRadius: '6px 6px 0 0', padding: '8px 11px', font: "600 11px 'Libre Franklin'", cursor: 'pointer',
    ...(active ? { background: '#fff', color: '#1B2330', border: '1px solid #E4E8EE', borderBottom: '1px solid #fff', marginBottom: -1 } : { background: 'transparent', color: '#8A93A2', border: 'none' }),
  })

  return (
    <>
      {/* collapsed re-open handle */}
      {ui.edit && ui.editCollapsed && (
        <button
          onClick={() => ui.set({ editCollapsed: false })}
          style={{ position: 'fixed', right: 0, top: '50%', transform: 'translateY(-50%)', zIndex: 64, background: '#1B2330', color: '#fff', border: 'none', borderRadius: '8px 0 0 8px', padding: '14px 8px', writingMode: 'vertical-rl', font: "700 11px 'IBM Plex Mono',monospace", letterSpacing: '.1em', cursor: 'pointer' }}
        >
          ⟨ EDIT
        </button>
      )}

      <aside
        style={{
          position: 'absolute', right: 0, top: 0, bottom: 0, width: 'min(560px,94vw)', zIndex: 65,
          background: '#F3F5F8', borderLeft: '1px solid #E0E4EA', boxShadow: '-14px 0 40px rgba(0,0,0,.16)',
          display: 'flex', flexDirection: 'column', transition: 'transform .34s cubic-bezier(.4,0,.2,1)',
          transform: open ? 'translateX(0)' : 'translateX(108%)', pointerEvents: open ? 'auto' : 'none',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px 0' }}>
          <span style={{ font: "700 14px 'Libre Franklin'", color: '#1B2330' }}>Edit dataset</span>
          <div style={{ display: 'flex', gap: 6 }}>
            <button onClick={() => ui.set({ editCollapsed: true })} title="Fly out" className="mini-btn" style={{ padding: '4px 9px' }}>⟩</button>
            <button onClick={() => ui.set({ edit: false })} title="Done" style={{ background: '#3E7C6A', color: '#fff', border: 'none', borderRadius: 4, padding: '5px 12px', font: "600 11px 'Libre Franklin'", cursor: 'pointer' }}>Done</button>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 3, padding: '10px 16px 0', borderBottom: '1px solid #E4E8EE', flexWrap: 'wrap' }}>
          {TABS.map((t) => (
            <button key={t.id} onClick={() => ui.set({ drawerTab: t.id })} style={tabStyle(tab === t.id)}>{t.label}</button>
          ))}
        </div>
        <div style={{ flex: 1, overflow: 'auto', padding: 16, background: '#fff' }}>
          {tab === 'objectives' && <ObjectivesTab data={data} setData={setData} />}
          {tab === 'streams' && <StreamsTab data={data} setData={setData} ui={ui} />}
          {tab === 'structure' && <StructureTab data={data} setData={setData} />}
          {tab === 'env' && <EnvTab data={data} setData={setData} />}
          {tab === 'data' && <DataTab data={data} setData={setData} replaceData={replaceData} fileRef={fileRef} />}
          {tab === 'plane' && <PlaneTab data={data} setData={setData} ui={ui} />}
        </div>
        <input
          type="file" accept="application/json" ref={fileRef} style={{ display: 'none' }}
          onChange={async (e) => { const f = e.target.files && e.target.files[0]; if (!f) return; try { replaceData(await readImportFile(f)) } catch { alert('Could not parse that JSON file.') } e.target.value = '' }}
        />
      </aside>
    </>
  )
}

type SetData = (m: (d: PmoData) => void) => void
const lbl: React.CSSProperties = { font: "600 9px 'IBM Plex Mono',monospace", letterSpacing: '.05em', color: '#8A93A2', textTransform: 'uppercase', marginBottom: 3, display: 'block' }
const inp: React.CSSProperties = { width: '100%', border: '1px solid #D5DBE3', borderRadius: 4, padding: '6px 8px', fontSize: 12, color: '#1B2330', background: '#fff' }
const card: React.CSSProperties = { border: '1px solid #E7E9EE', borderRadius: 6, padding: 11, marginBottom: 9, background: '#FCFDFE' }
const addBtn: React.CSSProperties = { width: '100%', border: '1px dashed #C5CCD6', background: 'none', borderRadius: 6, padding: 9, font: "600 12px 'Libre Franklin'", color: '#5A6473', cursor: 'pointer' }

function Row({ children }: { children: React.ReactNode }) {
  return <div style={{ display: 'flex', gap: 8, marginBottom: 7 }}>{children}</div>
}
function MiniIconBtn({ label, onClick }: { label: string; onClick: () => void }) {
  return <button onClick={onClick} className="mini-btn" style={{ padding: '3px 7px' }}>{label}</button>
}

function ObjectivesTab({ data, setData }: { data: PmoData; setData: SetData }) {
  return (
    <div>
      {(data.objectives || []).map((o, i) => (
        <div key={o.id} style={card}>
          <Row>
            <input style={{ ...inp, flex: '0 0 60px' }} value={o.code} onChange={(e) => setData((d) => void (d.objectives.find((x) => x.id === o.id)!.code = e.target.value))} />
            <input style={inp} value={o.name} onChange={(e) => setData((d) => void (d.objectives.find((x) => x.id === o.id)!.name = e.target.value))} />
          </Row>
          <textarea style={{ ...inp, minHeight: 44, resize: 'vertical', marginBottom: 7 }} value={o.outcome} onChange={(e) => setData((d) => void (d.objectives.find((x) => x.id === o.id)!.outcome = e.target.value))} />
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
            <input type="color" value={o.color} onChange={(e) => setData((d) => void (d.objectives.find((x) => x.id === o.id)!.color = e.target.value))} style={{ width: 34, height: 26, border: 'none', background: 'none' }} />
            <div style={{ display: 'flex', gap: 5 }}>
              <MiniIconBtn label="↑" onClick={() => setData((d) => { if (i > 0) { const a = d.objectives;[a[i - 1], a[i]] = [a[i], a[i - 1]] } })} />
              <MiniIconBtn label="↓" onClick={() => setData((d) => { const a = d.objectives; if (i < a.length - 1) [a[i + 1], a[i]] = [a[i], a[i + 1]] })} />
              <MiniIconBtn label="Delete" onClick={() => setData((d) => { const fb = (d.objectives[0] || {}).id; const rem = o.id; d.objectives = d.objectives.filter((x) => x.id !== o.id); d.streams.forEach((s) => { if (s.objectiveId === rem) s.objectiveId = fb }) })} />
            </div>
          </div>
        </div>
      ))}
      <button style={addBtn} onClick={() => setData((d) => d.objectives.push({ id: nid('obj'), code: 'O' + (d.objectives.length + 1), name: 'New objective', outcome: '', color: '#5A6473', planeInitiativeId: '' }))}>+ Add objective</button>
    </div>
  )
}

function StreamsTab({ data, setData, ui }: { data: PmoData; setData: SetData; ui: ReturnType<typeof useUI> }) {
  const mut = (id: string, fn: (s: any) => void) => setData((d) => { const s = d.streams.find((x) => x.id === id); if (s) fn(s) })
  return (
    <div>
      {data.streams.map((s, i) => {
        const expanded = ui.expandedId === s.id
        return (
          <div key={s.id} style={card}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <button onClick={() => ui.set({ expandedId: expanded ? null : s.id })} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#8A93A2', fontSize: 12 }}>{expanded ? '▾' : '▸'}</button>
              <span style={{ font: "600 9px 'IBM Plex Mono',monospace", color: '#A6AEBA' }}>{s.code}</span>
              <span style={{ flex: 1, font: "600 12px 'Libre Franklin'", color: '#1B2330', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.name}</span>
              <MiniIconBtn label="↑" onClick={() => setData((d) => { if (i > 0) { const a = d.streams;[a[i - 1], a[i]] = [a[i], a[i - 1]] } })} />
              <MiniIconBtn label="↓" onClick={() => setData((d) => { const a = d.streams; if (i < a.length - 1) [a[i + 1], a[i]] = [a[i], a[i + 1]] })} />
              <MiniIconBtn label="✕" onClick={() => setData((d) => { d.streams = d.streams.filter((x) => x.id !== s.id) })} />
            </div>
            {expanded && (
              <div style={{ marginTop: 9 }}>
                <Row>
                  <div style={{ flex: '0 0 70px' }}><label style={lbl}>Code</label><input style={inp} value={s.code} onChange={(e) => mut(s.id, (x) => (x.code = e.target.value))} /></div>
                  <div style={{ flex: 1 }}><label style={lbl}>Name</label><input style={inp} value={s.name} onChange={(e) => mut(s.id, (x) => (x.name = e.target.value))} /></div>
                </Row>
                <label style={lbl}>Description</label>
                <textarea style={{ ...inp, minHeight: 42, resize: 'vertical', marginBottom: 7 }} value={s.blurb} onChange={(e) => mut(s.id, (x) => (x.blurb = e.target.value))} />
                <Row>
                  <div style={{ flex: 1 }}><label style={lbl}>Vendor</label><select style={inp} value={s.ownerId} onChange={(e) => mut(s.id, (x) => (x.ownerId = e.target.value))}>{data.owners.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}</select></div>
                  <div style={{ flex: 1 }}><label style={lbl}>Status</label><select style={inp} value={s.status} onChange={(e) => mut(s.id, (x) => { x.status = e.target.value as Status; x.completedAt = e.target.value === 'done' ? Date.now() : null })}>{STATUS_OPTS.map((o) => <option key={o.v} value={o.v}>{o.l}</option>)}</select></div>
                </Row>
                <Row>
                  <div style={{ flex: 1 }}><label style={lbl}>Phase</label><select style={inp} value={s.phaseId} onChange={(e) => mut(s.id, (x) => (x.phaseId = e.target.value))}>{data.phases.map((p) => <option key={p.id} value={p.id}>P{p.n} · {p.name}</option>)}</select></div>
                  <div style={{ flex: 1 }}><label style={lbl}>Objective</label><select style={inp} value={s.objectiveId} onChange={(e) => mut(s.id, (x) => (x.objectiveId = e.target.value))}>{data.objectives.map((o) => <option key={o.id} value={o.id}>{o.code} · {o.name}</option>)}</select></div>
                </Row>
                <Row>
                  <div style={{ flex: 1 }}><label style={lbl}>Work type</label><select style={inp} value={s.workType || 'Epic'} onChange={(e) => mut(s.id, (x) => (x.workType = e.target.value))}><option>Epic</option><option>Task</option><option>Milestone</option></select></div>
                  <div style={{ flex: '0 0 64px' }}><label style={lbl}>Start</label><input type="number" style={inp} value={s.start} onChange={(e) => mut(s.id, (x) => (x.start = Math.max(1, parseInt(e.target.value) || 1)))} /></div>
                  <div style={{ flex: '0 0 64px' }}><label style={lbl}>Span</label><input type="number" style={inp} value={s.span} onChange={(e) => mut(s.id, (x) => (x.span = Math.max(1, parseInt(e.target.value) || 1)))} /></div>
                </Row>
                <Row>
                  <div style={{ flex: 1 }}><label style={lbl}>Group</label><input style={inp} value={s.group} onChange={(e) => mut(s.id, (x) => (x.group = e.target.value))} /></div>
                  <div style={{ flex: 1 }}><label style={lbl}>Depends on (codes)</label><input style={inp} value={(s.deps || []).join(', ')} onChange={(e) => mut(s.id, (x) => (x.deps = e.target.value.split(',').map((t) => t.trim()).filter(Boolean)))} /></div>
                </Row>
                <div style={{ display: 'flex', gap: 16, marginTop: 4 }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 6, font: "600 11px 'Libre Franklin'", color: '#5A6473' }}><input type="checkbox" checked={!!s.committed} onChange={(e) => mut(s.id, (x) => (x.committed = e.target.checked))} /> Committed this period</label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 6, font: "600 11px 'Libre Franklin'", color: '#5A6473' }}><input type="checkbox" checked={!!s.mine} onChange={(e) => mut(s.id, (x) => (x.mine = e.target.checked))} /> Mine</label>
                </div>
              </div>
            )}
          </div>
        )
      })}
      <button style={addBtn} onClick={() => { const id = nid('s'); setData((d) => d.streams.push({ id, code: 'NEW', name: 'New work stream', ownerId: (d.owners[0] || ({} as any)).id, status: 'plan', phaseId: (d.phases[0] || ({} as any)).id, group: '', start: 1, span: 1, deps: [], blurb: '', workType: 'Epic' })); ui.set({ expandedId: id }) }}>+ Add work stream</button>
    </div>
  )
}

function StructureTab({ data, setData }: { data: PmoData; setData: SetData }) {
  return (
    <div>
      <div style={{ ...lbl, fontSize: 10, marginBottom: 8 }}>Phases</div>
      {data.phases.map((p, i) => (
        <div key={p.id} style={card}>
          <Row>
            <input style={{ ...inp, flex: '0 0 48px' }} type="number" value={p.n} onChange={(e) => setData((d) => void (d.phases.find((x) => x.id === p.id)!.n = parseInt(e.target.value) || 1))} />
            <input style={inp} value={p.name} onChange={(e) => setData((d) => void (d.phases.find((x) => x.id === p.id)!.name = e.target.value))} />
          </Row>
          <input style={{ ...inp, marginBottom: 7 }} value={p.sub} onChange={(e) => setData((d) => void (d.phases.find((x) => x.id === p.id)!.sub = e.target.value))} />
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, font: "600 11px 'Libre Franklin'", color: '#5A6473' }}><input type="checkbox" checked={p.phi} onChange={(e) => setData((d) => void (d.phases.find((x) => x.id === p.id)!.phi = e.target.checked))} /> PHI</label>
            <div style={{ display: 'flex', gap: 5 }}>
              <MiniIconBtn label="↑" onClick={() => setData((d) => { if (i > 0) { const a = d.phases;[a[i - 1], a[i]] = [a[i], a[i - 1]] } })} />
              <MiniIconBtn label="↓" onClick={() => setData((d) => { const a = d.phases; if (i < a.length - 1) [a[i + 1], a[i]] = [a[i], a[i + 1]] })} />
              <MiniIconBtn label="Delete" onClick={() => setData((d) => { d.phases = d.phases.filter((x) => x.id !== p.id) })} />
            </div>
          </div>
        </div>
      ))}
      <button style={{ ...addBtn, marginBottom: 18 }} onClick={() => setData((d) => d.phases.push({ id: nid('p'), n: d.phases.length + 1, name: 'New phase', sub: '', phi: false }))}>+ Add phase</button>
      <div style={{ ...lbl, fontSize: 10, marginBottom: 8 }}>Vendors</div>
      {data.owners.map((o) => (
        <div key={o.id} style={card}>
          <Row>
            <input type="color" value={o.color} onChange={(e) => setData((d) => void (d.owners.find((x) => x.id === o.id)!.color = e.target.value))} style={{ width: 34, height: 30, border: 'none', background: 'none' }} />
            <input style={inp} value={o.name} onChange={(e) => setData((d) => void (d.owners.find((x) => x.id === o.id)!.name = e.target.value))} />
            <MiniIconBtn label="✕" onClick={() => setData((d) => { d.owners = d.owners.filter((x) => x.id !== o.id) })} />
          </Row>
          <input style={inp} value={o.role} onChange={(e) => setData((d) => void (d.owners.find((x) => x.id === o.id)!.role = e.target.value))} />
        </div>
      ))}
      <button style={addBtn} onClick={() => setData((d) => d.owners.push({ id: nid('o'), name: 'New vendor', role: '', color: '#5A6473' }))}>+ Add vendor</button>
    </div>
  )
}

function EnvTab({ data, setData }: { data: PmoData; setData: SetData }) {
  const e = data.environment
  const fld = (k: keyof typeof e, multi?: boolean) => (
    <div style={{ marginBottom: 9 }}>
      <label style={lbl}>{String(k)}</label>
      {multi ? (
        <textarea style={{ ...inp, minHeight: 50, resize: 'vertical' }} value={e[k] as string} onChange={(ev) => setData((d) => void ((d.environment as any)[k] = ev.target.value))} />
      ) : (
        <input style={inp} value={e[k] as string} onChange={(ev) => setData((d) => void ((d.environment as any)[k] = ev.target.value))} />
      )}
    </div>
  )
  return (
    <div>
      <div style={{ ...lbl, fontSize: 10, marginBottom: 8 }}>Perimeter & hosting</div>
      {fld('perimeterTop')}
      {fld('wanFw')}
      {fld('hosting', true)}
      <div style={{ ...lbl, fontSize: 10, margin: '14px 0 8px' }}>Zones & services</div>
      {e.zones.map((z) => (
        <div key={z.id} style={card}>
          <input style={{ ...inp, marginBottom: 6, fontWeight: 600 }} value={z.name} onChange={(ev) => setData((d) => void (d.environment.zones.find((x) => x.id === z.id)!.name = ev.target.value))} />
          {z.services.map((s) => (
            <Row key={s.id}>
              <input style={inp} value={s.name} onChange={(ev) => setData((d) => { const zz = d.environment.zones.find((x) => x.id === z.id)!; zz.services.find((x) => x.id === s.id)!.name = ev.target.value })} />
              <select style={{ ...inp, flex: '0 0 110px' }} value={s.type} onChange={(ev) => setData((d) => { const zz = d.environment.zones.find((x) => x.id === z.id)!; zz.services.find((x) => x.id === s.id)!.type = ev.target.value })}>{e.svcTypes.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}</select>
              <MiniIconBtn label="✕" onClick={() => setData((d) => { const zz = d.environment.zones.find((x) => x.id === z.id)!; zz.services = zz.services.filter((x) => x.id !== s.id) })} />
            </Row>
          ))}
          <button className="mini-btn" style={{ width: '100%', marginTop: 3 }} onClick={() => setData((d) => { const zz = d.environment.zones.find((x) => x.id === z.id)!; zz.services.push({ id: nid('sv'), name: 'New service', type: (e.svcTypes[0] || ({} as any)).id, note: '' }) })}>+ service</button>
        </div>
      ))}
    </div>
  )
}

function DataTab({ data, setData, replaceData, fileRef }: { data: PmoData; setData: SetData; replaceData: (d: PmoData) => void; fileRef: React.RefObject<HTMLInputElement> }) {
  return (
    <div>
      <div style={{ ...lbl, fontSize: 10, marginBottom: 8 }}>Open decisions</div>
      {(data.decisions || []).map((x) => (
        <div key={x.id} style={card}>
          <textarea style={{ ...inp, minHeight: 38, resize: 'vertical', marginBottom: 6 }} value={x.text} onChange={(e) => setData((d) => void (d.decisions.find((y) => y.id === x.id)!.text = e.target.value))} />
          <Row>
            <input style={inp} placeholder="owner" value={x.owner} onChange={(e) => setData((d) => void (d.decisions.find((y) => y.id === x.id)!.owner = e.target.value))} />
            <MiniIconBtn label={x.status === 'resolved' ? 'Reopen' : 'Resolve'} onClick={() => setData((d) => { const y = d.decisions.find((z) => z.id === x.id)!; y.status = y.status === 'resolved' ? 'open' : 'resolved' })} />
            <MiniIconBtn label="✕" onClick={() => setData((d) => { d.decisions = d.decisions.filter((y) => y.id !== x.id) })} />
          </Row>
        </div>
      ))}
      <button style={{ ...addBtn, marginBottom: 16 }} onClick={() => setData((d) => (d.decisions = d.decisions || []).push({ id: nid('dc'), text: 'New decision', owner: '', status: 'open', since: 'Now' }))}>+ Add decision</button>

      <div style={{ ...lbl, fontSize: 10, marginBottom: 8 }}>Active blockers</div>
      {(data.blockers || []).map((x) => (
        <div key={x.id} style={card}>
          <textarea style={{ ...inp, minHeight: 38, resize: 'vertical', marginBottom: 6 }} value={x.text} onChange={(e) => setData((d) => void (d.blockers.find((y) => y.id === x.id)!.text = e.target.value))} />
          <Row>
            <input style={inp} placeholder="owner" value={x.owner} onChange={(e) => setData((d) => void (d.blockers.find((y) => y.id === x.id)!.owner = e.target.value))} />
            <input style={{ ...inp, flex: '0 0 70px' }} placeholder="code" value={x.streamCode} onChange={(e) => setData((d) => void (d.blockers.find((y) => y.id === x.id)!.streamCode = e.target.value))} />
            <MiniIconBtn label={x.active !== false ? 'Mute' : 'Activate'} onClick={() => setData((d) => { const y = d.blockers.find((z) => z.id === x.id)!; y.active = y.active === false })} />
            <MiniIconBtn label="✕" onClick={() => setData((d) => { d.blockers = d.blockers.filter((y) => y.id !== x.id) })} />
          </Row>
        </div>
      ))}
      <button style={{ ...addBtn, marginBottom: 18 }} onClick={() => setData((d) => (d.blockers = d.blockers || []).push({ id: nid('bk'), text: 'New blocker', owner: '', streamCode: '', active: true }))}>+ Add blocker</button>

      <div style={{ ...lbl, fontSize: 10, marginBottom: 8 }}>Backup & restore</div>
      <div style={{ display: 'flex', gap: 8 }}>
        <button className="mini-btn" style={{ flex: 1, padding: '8px' }} onClick={() => exportJson(data)}>Export JSON</button>
        <button className="mini-btn" style={{ flex: 1, padding: '8px' }} onClick={() => fileRef.current?.click()}>Import JSON</button>
        <button className="mini-btn" style={{ flex: 1, padding: '8px', color: '#C2410C' }} onClick={() => { if (confirm('Reset all data to defaults?')) replaceData(freshDefaults()) }}>Reset</button>
      </div>
    </div>
  )
}

function PlaneTab({ data, setData, ui }: { data: PmoData; setData: SetData; ui: ReturnType<typeof useUI> }) {
  const [copied, setCopied] = useState(false)
  const [pushed, setPushed] = useState('')
  const [planeStatus, setPlaneStatus] = useState<PlaneStatus | null>(null)
  const [pulling, setPulling] = useState(false)
  const [pullMsg, setPullMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null)
  const brief = buildBrief(data)

  useEffect(() => {
    let live = true
    fetchPlaneStatus().then((s) => live && setPlaneStatus(s))
    return () => { live = false }
  }, [])

  const runPull = async () => {
    setPulling(true)
    setPullMsg(null)
    try {
      const res = await pullPlane()
      let summary = { matched: 0, imported: 0, total: 0, pulledAt: res.pulledAt }
      setData((d) => { summary = mergePlanePull(d, res.projects, res.pulledAt) })
      setPullMsg({ kind: 'ok', text: `Pulled ${summary.total} project${summary.total === 1 ? '' : 's'} from Plane — ${summary.matched} matched, ${summary.imported} imported.` })
    } catch (err) {
      setPullMsg({ kind: 'err', text: err instanceof Error ? err.message : 'Pull failed.' })
    } finally {
      setPulling(false)
    }
  }

  const lastPull = data.plane.lastPullAt ? new Date(data.plane.lastPullAt).toLocaleString() : null
  const stateRows = [
    { k: 'done', l: 'Done' },
    { k: 'wip', l: 'In progress' },
    { k: 'mixed', l: 'Partly done' },
    { k: 'plan', l: 'Planned' },
    { k: 'risk', l: 'At risk' },
  ]
  const syncedObj = (data.objectives || []).filter((o) => o.planeInitiativeId).length
  const syncedStr = data.streams.filter((s) => s.planeProjectId).length

  return (
    <div>
      <div style={{ background: '#F4F8FF', border: '1px solid #DCE8FB', borderRadius: 8, padding: '11px 13px', marginBottom: 14 }}>
        <div style={{ font: "700 12px 'Libre Franklin'", color: '#1B2330', marginBottom: 4 }}>Plane is the system of record</div>
        <div style={{ font: "400 11px/1.5 'Libre Franklin'", color: '#5A6473' }}>
          Structure pushes from here over MCP; status reads back. {syncedObj}/{(data.objectives || []).length} initiatives · {syncedStr}/{data.streams.length} projects synced.
        </div>
      </div>

      {/* Full pull from Plane — refresh on demand */}
      <div style={{ border: '1px solid ' + (planeStatus?.configured ? '#BFE0CF' : '#E4E8EE'), background: planeStatus?.configured ? '#F2F9F5' : '#F8FAFC', borderRadius: 8, padding: '12px 13px', marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
          <span style={{ font: "700 12px 'Libre Franklin'", color: '#1B2330' }}>Sync from Plane</span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, font: "700 8.5px 'IBM Plex Mono',monospace", color: planeStatus?.configured ? '#2F6B53' : '#8A93A2' }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: planeStatus == null ? '#C5CCD6' : planeStatus.configured ? '#1F8A5B' : '#C5CCD6' }} />
            {planeStatus == null ? 'CHECKING…' : planeStatus.configured ? 'CONNECTED' + (planeStatus.workspace ? ' · ' + planeStatus.workspace : '') : 'NOT CONFIGURED'}
          </span>
        </div>
        <div style={{ font: "400 10.5px/1.5 'Libre Franklin'", color: '#6A7382', marginBottom: 10 }}>
          Pull every project from the Plane workspace and reconcile it into your work streams — matched streams get live status &amp; completion, new projects are imported. Re-run any time to refresh.
        </div>
        <button
          onClick={runPull}
          disabled={pulling || (planeStatus != null && !planeStatus.configured)}
          style={{ width: '100%', background: pulling ? '#9AB7AD' : planeStatus?.configured ? '#1B2330' : '#C5CCD6', color: '#fff', border: 'none', borderRadius: 8, padding: '10px', font: "700 12.5px 'Libre Franklin'", cursor: pulling || (planeStatus != null && !planeStatus.configured) ? 'not-allowed' : 'pointer' }}
        >
          {pulling ? '⟳ Pulling…' : lastPull ? '⟳ Refresh from Plane' : '↓ Pull from Plane'}
        </button>
        {lastPull && (
          <div style={{ marginTop: 8, font: "500 10px 'IBM Plex Mono',monospace", color: '#9AA3B2' }}>
            Last pull {lastPull}{data.plane.lastPullSummary ? ` · ${data.plane.lastPullSummary.matched} matched · ${data.plane.lastPullSummary.imported} imported` : ''}
          </div>
        )}
        {pullMsg && (
          <div style={{ marginTop: 8, font: "500 11px 'Libre Franklin'", color: pullMsg.kind === 'ok' ? '#2F6B53' : '#A8553F', background: pullMsg.kind === 'ok' ? '#E4EEE9' : '#F6EAE6', borderRadius: 6, padding: '8px 10px' }}>{pullMsg.text}</div>
        )}
        {planeStatus != null && !planeStatus.configured && (
          <div style={{ marginTop: 8, font: "400 10px/1.5 'Libre Franklin'", color: '#8A93A2' }}>
            Set <code>PLANE_API_TOKEN</code> + <code>PLANE_WORKSPACE</code> on the server to enable live pulls.
          </div>
        )}
      </div>

      <label style={lbl}>Workspace slug</label>
      <input style={{ ...inp, marginBottom: 9 }} value={data.plane.workspaceSlug} onChange={(e) => setData((d) => void (d.plane.workspaceSlug = e.target.value))} placeholder="e.g. amdg" />
      <label style={lbl}>Host URL</label>
      <input style={{ ...inp, marginBottom: 14 }} value={data.plane.baseUrl} onChange={(e) => setData((d) => void (d.plane.baseUrl = e.target.value))} />

      <div style={{ ...lbl, fontSize: 10, marginBottom: 8 }}>Status → Plane state</div>
      {stateRows.map((r) => (
        <Row key={r.k}>
          <span style={{ flex: '0 0 110px', font: "600 11px 'Libre Franklin'", color: '#5A6473', alignSelf: 'center' }}>{r.l}</span>
          <input style={inp} value={(data.plane.stateMap || {})[r.k] || ''} onChange={(e) => setData((d) => void (d.plane.stateMap[r.k] = e.target.value))} />
        </Row>
      ))}

      <button
        onClick={() => {
          setData((d) => pushToPlane(d))
          setPushed('Pushed structure to Plane — initiatives & projects synced, source links written back.')
          setTimeout(() => setPushed(''), 3000)
        }}
        style={{ width: '100%', marginTop: 12, background: '#3E7C6A', color: '#fff', border: 'none', borderRadius: 8, padding: '11px', font: "700 12.5px 'Libre Franklin'", cursor: 'pointer' }}
      >
        ⟳ Push all structure to Plane
      </button>
      {pushed && <div style={{ marginTop: 9, font: "500 11px 'Libre Franklin'", color: '#2F6B53', background: '#E4EEE9', borderRadius: 6, padding: '8px 10px' }}>{pushed}</div>}
      {!data.plane.workspaceSlug && <div style={{ marginTop: 8, font: "500 10.5px 'Libre Franklin'", color: '#A8553F' }}>Set a workspace slug first so View-in-Plane links resolve.</div>}

      <div style={{ ...lbl, fontSize: 10, margin: '18px 0 8px' }}>Provisioning brief</div>
      <textarea readOnly value={brief} style={{ width: '100%', minHeight: 200, border: '1px solid #E4E8EE', borderRadius: 6, padding: 11, font: "400 10.5px/1.5 'IBM Plex Mono',monospace", color: '#41495A', background: '#FCFDFE', resize: 'vertical' }} />
      <button
        className="mini-btn"
        style={{ marginTop: 8, padding: '8px 14px' }}
        onClick={() => { try { navigator.clipboard.writeText(brief) } catch { /* ignore */ } setCopied(true); setTimeout(() => setCopied(false), 1500) }}
      >
        {copied ? '✓ Copied' : '⧉ Copy brief'}
      </button>
      <span style={{ marginLeft: 10, font: "500 10px 'IBM Plex Mono',monospace", color: '#B7BEC9' }}>{ui.view === 'objectives' ? 'Objectives view shows sync state' : ''}</span>
    </div>
  )
}
