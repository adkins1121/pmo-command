import { useStore } from '../store/store'
import { useUI } from '../store/ui'
import { buildMaps, computeDeps } from '../lib/derive'
import type { Status, ViewId } from '../data/types'

export function Dashboard() {
  const { data } = useStore()
  const ui = useUI()
  const { enrich } = buildMaps(data)
  const { crit, codeMap } = computeDeps(data.streams)

  const go = (view: ViewId, extra?: Partial<{ fOwner: string; fPhase: string }>) => ui.set({ view, ...extra })

  const dsTotal = data.streams.length
  const cntS = (s: Status) => data.streams.filter((x) => x.status === s).length
  const dsDone = cntS('done')
  const dsWip = cntS('wip') + cntS('mixed')
  const dsPlan = cntS('plan')
  const dsRisk = cntS('risk')
  const dsPct = dsTotal ? Math.round((dsDone / dsTotal) * 100) : 0
  const dsBlockers = (data.blockers || []).filter((b) => b.active !== false).length
  const dsDecisions = (data.decisions || []).filter((x) => x.status !== 'resolved').length
  const dsCrit = Object.keys(crit || {}).length
  const todoOpen = (data.todos || []).filter((t) => !t.done).length

  const statCards = [
    { label: 'Work streams', value: '' + dsTotal, sub: 'across ' + data.phases.length + ' phases', view: 'board' as ViewId, accent: '#4A6491' },
    { label: 'In progress', value: '' + dsWip, sub: 'active now', view: 'board' as ViewId, accent: '#3E7C6A' },
    { label: 'Complete', value: dsPct + '%', sub: dsDone + ' of ' + dsTotal + ' done', view: 'timeline' as ViewId, accent: '#2E7D52' },
    { label: 'On critical path', value: '' + dsCrit, sub: 'longest chain', view: 'deps' as ViewId, accent: '#1B2330' },
    { label: 'Needs attention', value: '' + (dsBlockers + dsDecisions), sub: dsBlockers + ' blockers · ' + dsDecisions + ' decisions', view: 'standup' as ViewId, accent: '#A8553F' },
  ]
  const statusMix = [
    { label: 'Done', v: dsDone, color: '#2E7D52' },
    { label: 'In progress', v: cntS('wip'), color: '#3E7C6A' },
    { label: 'Partly', v: cntS('mixed'), color: '#B07D3C' },
    { label: 'Planned', v: dsPlan, color: '#7A8494' },
    { label: 'At risk', v: dsRisk, color: '#A8553F' },
  ].map((x) => ({ ...x, show: x.v > 0 }))
  const phaseRows = data.phases.map((p) => {
    const items = data.streams.filter((s) => s.phaseId === p.id)
    const done = items.filter((s) => s.status === 'done').length
    const pct = items.length ? Math.round((done / items.length) * 100) : 0
    return { phaseId: p.id, name: 'P' + p.n + ' · ' + p.name, total: items.length, done, pctTxt: pct + '%', barW: pct + '%', accent: p.phi ? '#A8553F' : '#4A6491' }
  })
  const vendorRows = data.owners
    .map((o) => {
      const items = data.streams.filter((s) => s.ownerId === o.id)
      return {
        ownerId: o.id,
        name: o.name,
        color: o.color,
        count: items.length,
        active: items.filter((s) => s.status !== 'done').length,
        barW: (dsTotal ? Math.round((items.length / dsTotal) * 100) : 0) + '%',
      }
    })
    .filter((v) => v.count > 0)
    .sort((a, b) => b.count - a.count)
  const riskList = data.streams
    .filter((s) => s.status === 'risk' || (s.deps || []).some((c) => {
      const dep = codeMap[c]
      return dep && (dep.status === 'plan' || dep.status === 'risk')
    }))
    .slice(0, 5)
    .map((s) => {
      const e = enrich(s)
      return { id: s.id, name: s.name, code: s.code, pillText: e.pillText, pillBg: e.pillBg, pillColor: e.pillColor, color: e.color }
    })
  const attention = [
    { label: 'Active blockers', value: '' + dsBlockers, view: 'standup' as ViewId, color: '#A8553F' },
    { label: 'Open decisions', value: '' + dsDecisions, view: 'standup' as ViewId, color: '#5B5391' },
    { label: 'Ad-hoc to-dos open', value: '' + todoOpen, view: 'focus' as ViewId, color: '#B07D3C' },
  ]
  const initiativesView = (data.objectives || []).map((o) => {
    const items = data.streams.filter((s) => s.objectiveId === o.id)
    const done = items.filter((s) => s.status === 'done').length
    const pct = items.length ? Math.round((done / items.length) * 100) : 0
    return {
      id: o.id,
      code: o.code,
      name: o.name,
      color: o.color,
      total: items.length,
      done,
      pctTxt: pct + '%',
      barW: pct + '%',
      planeLabel: o.planeInitiativeId ? 'Plane ' + o.planeInitiativeId : 'Not linked',
      planeColor: o.planeInitiativeId ? '#3E7C6A' : '#A6AEBA',
    }
  })

  const cardBase: React.CSSProperties = {
    background: '#fff',
    border: '1px solid #E4E8EE',
    borderRadius: 7,
    padding: '16px 18px',
    boxShadow: '0 1px 2px rgba(20,30,50,.05)',
  }
  const cardH: React.CSSProperties = { font: "700 14px 'Libre Franklin'", color: '#1B2330', marginBottom: 13 }

  return (
    <div style={{ maxWidth: 1340, margin: '0 auto' }}>
      <div style={{ marginBottom: 18 }}>
        <div style={{ font: "700 19px 'Libre Franklin'", color: '#1B2330' }}>Program dashboard</div>
        <div style={{ font: "400 12.5px 'Libre Franklin'", color: '#7A8494', marginTop: 2 }}>
          Live snapshot of the ERPNext modernization program · click any tile to dive in
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(186px,1fr))', gap: 12, marginBottom: 16 }}>
        {statCards.map((c, i) => (
          <div
            key={i}
            onClick={() => go(c.view)}
            className="dash-tile"
            style={{
              background: '#fff',
              border: '1px solid #E4E8EE',
              borderTop: '3px solid ' + c.accent,
              borderRadius: 7,
              padding: '15px 16px',
              cursor: 'pointer',
              boxShadow: '0 1px 2px rgba(20,30,50,.05)',
            }}
          >
            <div style={{ font: "800 30px 'Libre Franklin'", color: '#15202E', lineHeight: 1, letterSpacing: '-.02em' }}>{c.value}</div>
            <div style={{ font: "600 12.5px 'Libre Franklin'", color: '#1B2330', marginTop: 7 }}>{c.label}</div>
            <div style={{ font: "500 10px 'IBM Plex Mono',monospace", color: '#9AA3B2', marginTop: 3 }}>{c.sub}</div>
          </div>
        ))}
      </div>

      {/* Initiatives */}
      <div style={{ ...cardBase, marginBottom: 14 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 13 }}>
          <div style={{ font: "700 14px 'Libre Franklin'", color: '#1B2330' }}>Initiatives</div>
          <div onClick={() => go('objectives')} style={{ font: "500 10px 'IBM Plex Mono',monospace", color: '#9AA3B2', cursor: 'pointer' }}>
            Objectives → Plane Initiatives ›
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(300px,1fr))', gap: 12 }}>
          {initiativesView.map((o) => (
            <div
              key={o.id}
              className="hov-row"
              onClick={() => go('objectives')}
              style={{ border: '1px solid #EEF1F4', borderLeft: '3px solid ' + o.color, borderRadius: 6, padding: '12px 13px', cursor: 'pointer' }}
            >
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 7 }}>
                <span style={{ font: "700 12px 'IBM Plex Mono',monospace", color: o.color, flex: 'none' }}>{o.code}</span>
                <span style={{ font: "600 12.5px/1.25 'Libre Franklin'", color: '#1B2330', flex: 1, minWidth: 0 }}>{o.name}</span>
              </div>
              <div style={{ height: 7, borderRadius: 5, background: '#EEF1F4', overflow: 'hidden', marginBottom: 7 }}>
                <div style={{ height: '100%', width: o.barW, background: o.color, borderRadius: 5 }} />
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ font: "500 10px 'IBM Plex Mono',monospace", color: '#9AA3B2' }}>
                  {o.done}/{o.total} streams · {o.pctTxt}
                </span>
                <span
                  style={{
                    font: "600 8.5px 'IBM Plex Mono',monospace",
                    padding: '2px 7px',
                    borderRadius: 9,
                    background: '#F1F3F6',
                    color: o.planeColor,
                  }}
                >
                  {o.planeLabel}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1.25fr 1fr', gap: 14, alignItems: 'start' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* Progress by phase */}
          <div style={cardBase}>
            <div style={cardH}>Progress by phase</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {phaseRows.map((p) => (
                <div key={p.phaseId} onClick={() => go('board', { fPhase: p.phaseId })} style={{ cursor: 'pointer' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 5 }}>
                    <span style={{ font: "600 12px 'Libre Franklin'", color: '#1B2330' }}>{p.name}</span>
                    <span style={{ font: "500 10px 'IBM Plex Mono',monospace", color: '#9AA3B2' }}>
                      {p.done}/{p.total} · {p.pctTxt}
                    </span>
                  </div>
                  <div style={{ height: 8, borderRadius: 5, background: '#EEF1F4', overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: p.barW, background: p.accent, borderRadius: 5 }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
          {/* Status mix */}
          <div style={cardBase}>
            <div style={cardH}>Status mix</div>
            <div style={{ display: 'flex', height: 16, borderRadius: 5, overflow: 'hidden', marginBottom: 13 }}>
              {statusMix.filter((s) => s.show).map((s, i) => (
                <div key={i} style={{ flex: s.v, background: s.color }} />
              ))}
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
              {statusMix.map((s, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ width: 9, height: 9, borderRadius: 2, background: s.color, flex: 'none' }} />
                  <span style={{ font: "500 11px 'Libre Franklin'", color: '#5A6473' }}>{s.label}</span>
                  <span style={{ font: "600 11px 'IBM Plex Mono',monospace", color: '#1B2330' }}>{s.v}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* Vendor workload */}
          <div style={cardBase}>
            <div style={cardH}>Vendor workload</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 11 }}>
              {vendorRows.map((v) => (
                <div key={v.ownerId} onClick={() => go('board', { fOwner: v.ownerId })} style={{ cursor: 'pointer' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 5 }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7, font: "600 12px 'Libre Franklin'", color: '#1B2330' }}>
                      <span style={{ width: 9, height: 9, borderRadius: '50%', background: v.color }} />
                      {v.name}
                    </span>
                    <span style={{ font: "500 10px 'IBM Plex Mono',monospace", color: '#9AA3B2' }}>
                      {v.active} active · {v.count} total
                    </span>
                  </div>
                  <div style={{ height: 8, borderRadius: 5, background: '#EEF1F4', overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: v.barW, background: v.color, borderRadius: 5 }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
          {/* Needs attention */}
          <div style={cardBase}>
            <div style={cardH}>Needs attention</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 7, marginBottom: 13 }}>
              {attention.map((a, i) => (
                <div
                  key={i}
                  className="hov-row"
                  onClick={() => go(a.view)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 10,
                    padding: '9px 12px',
                    border: '1px solid #EEF1F4',
                    borderLeft: '3px solid ' + a.color,
                    borderRadius: 5,
                    cursor: 'pointer',
                  }}
                >
                  <span style={{ font: "600 12.5px 'Libre Franklin'", color: '#1B2330' }}>{a.label}</span>
                  <span style={{ font: "800 17px 'Libre Franklin'", color: a.color }}>{a.value}</span>
                </div>
              ))}
            </div>
            <div
              style={{
                font: "600 9px 'IBM Plex Mono',monospace",
                color: '#A6AEBA',
                textTransform: 'uppercase',
                letterSpacing: '.06em',
                marginBottom: 8,
              }}
            >
              At-risk streams
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {riskList.map((s) => (
                <div
                  key={s.id}
                  className="hov-row"
                  onDoubleClick={() => ui.set({ selectedId: s.id, itemId: s.id, itemKind: 'stream' })}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    padding: '7px 10px',
                    border: '1px solid #EEF1F4',
                    borderLeft: '3px solid ' + s.color,
                    borderRadius: 4,
                    cursor: 'pointer',
                  }}
                >
                  <span
                    style={{
                      flex: 1,
                      minWidth: 0,
                      font: "600 12px 'Libre Franklin'",
                      color: '#1B2330',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}
                  >
                    {s.name}
                  </span>
                  <span
                    style={{
                      font: "600 8.5px 'IBM Plex Mono',monospace",
                      padding: '2px 7px',
                      borderRadius: 9,
                      background: s.pillBg,
                      color: s.pillColor,
                      flex: 'none',
                    }}
                  >
                    {s.pillText}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
