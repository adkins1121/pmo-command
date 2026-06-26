import { useStore } from '../store/store'
import { useUI } from '../store/ui'
import { buildMaps, makePass } from '../lib/derive'
import { mix } from '../data/helpers'

export function Timeline() {
  const { data } = useStore()
  const ui = useUI()
  const { enrich } = buildMaps(data)
  const fs = data.streams.filter(makePass(ui))
  const countLabel = fs.length + ' of ' + data.streams.length + ' streams'

  const buckets = data.timeline.buckets
  const nB = buckets.length
  const tlGridCols = 'repeat(' + nB + ',1fr)'
  const clampC = (s: number, sp: number) => {
    const a = Math.min(Math.max(1, s), nB)
    const b = Math.min(a + Math.max(1, sp), nB + 1)
    return a + ' / ' + b
  }
  const laneRows = fs.map(enrich).map((s) => {
    const planlike = s.status === 'plan' || s.status === 'risk'
    return {
      ...s,
      gc: clampC(s.start, s.span),
      barBg: planlike ? mix(s.color, 0.9) : s.color,
      barColor: planlike ? s.color : '#FFFFFF',
      barBorder: planlike ? '1px dashed ' + s.color : '1px solid ' + s.color,
    }
  })
  const tlBands = data.timeline.bands.map((b) => ({ name: b.name, gc: clampC(b.start, b.span) }))
  const tlMilestones = data.timeline.milestones.map((m) => ({
    label: m.label,
    sub: m.sub,
    gc: Math.min(Math.max(1, m.bucket), nB) + ' / ' + (Math.min(Math.max(1, m.bucket), nB) + 1),
  }))

  const labelCol: React.CSSProperties = { width: 238, flex: 'none' }
  const grid = (extra?: React.CSSProperties): React.CSSProperties => ({ flex: 1, display: 'grid', gap: 6, gridTemplateColumns: tlGridCols, ...extra })

  return (
    <div style={{ maxWidth: 1640, margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 16 }}>
        <div>
          <div style={{ font: "700 19px 'Libre Franklin'", color: '#1B2330' }}>Timeline</div>
          <div style={{ font: "400 12.5px 'Libre Franklin'", color: '#7A8494', marginTop: 2 }}>
            Each stream as a lane across sprints &amp; phases · relative timing
          </div>
        </div>
        <div style={{ font: "500 11px 'IBM Plex Mono',monospace", color: '#9AA3B2' }}>{countLabel}</div>
      </div>
      <div style={{ background: '#fff', border: '1px solid #E4E8EE', borderRadius: 4, padding: '20px 22px', boxShadow: '0 1px 2px rgba(20,30,50,.05)' }}>
        {/* bands */}
        <div style={{ display: 'flex', marginBottom: 6 }}>
          <div style={labelCol} />
          <div style={grid()}>
            {tlBands.map((b, i) => (
              <div key={i} style={{ gridColumn: b.gc, background: '#F1F3F6', borderRadius: 2, padding: '6px 10px', font: "600 11px 'Libre Franklin'", color: '#41495A', textAlign: 'center' }}>
                {b.name}
              </div>
            ))}
          </div>
        </div>
        {/* bucket headers */}
        <div style={{ display: 'flex', marginBottom: 10 }}>
          <div style={{ ...labelCol, font: "600 9px 'IBM Plex Mono',monospace", color: '#A6AEBA', textTransform: 'uppercase', letterSpacing: '.06em', display: 'flex', alignItems: 'flex-end' }}>
            Work stream
          </div>
          <div style={grid()}>
            {buckets.map((bk, i) => (
              <div key={i} style={{ font: "600 10px 'IBM Plex Mono',monospace", color: '#8A93A2', textAlign: 'center', paddingBottom: 3, borderBottom: '1px solid #ECEEF1' }}>
                {bk}
              </div>
            ))}
          </div>
        </div>
        {/* lanes */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
          {laneRows.map((r) => (
            <div key={r.id} style={{ display: 'flex', alignItems: 'center' }}>
              <div onDoubleClick={() => ui.set({ itemId: r.id, itemKind: 'stream' })} style={{ ...labelCol, paddingRight: 12, cursor: 'pointer' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: r.color, flex: 'none' }} />
                  <span style={{ font: "600 12px 'Libre Franklin'", color: '#1B2330', lineHeight: 1.2 }}>{r.name}</span>
                </div>
                <div style={{ font: "500 9px 'IBM Plex Mono',monospace", color: '#A6AEBA', paddingLeft: 15 }}>
                  {r.code} · {r.ownerName}
                </div>
              </div>
              <div style={grid()}>
                <div
                  onDoubleClick={() => ui.set({ itemId: r.id, itemKind: 'stream' })}
                  style={{ gridColumn: r.gc, background: r.barBg, color: r.barColor, border: r.barBorder, borderRadius: 3, padding: '5px 10px', minHeight: 24, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, cursor: 'pointer' }}
                >
                  <span style={{ font: "500 9.5px 'IBM Plex Mono',monospace", opacity: 0.92 }}>{r.code}</span>
                  <span style={{ font: "600 10px 'Libre Franklin'" }}>{r.pillText}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
        {/* milestones */}
        <div style={{ display: 'flex', alignItems: 'flex-start', marginTop: 14, paddingTop: 14, borderTop: '1px solid #EDEFF2' }}>
          <div style={{ ...labelCol, font: "600 9px 'IBM Plex Mono',monospace", color: '#A6AEBA', textTransform: 'uppercase', letterSpacing: '.06em' }}>Gates &amp; milestones</div>
          <div style={grid({ alignItems: 'start' })}>
            {tlMilestones.map((m, i) => (
              <div key={i} style={{ gridColumn: m.gc, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, textAlign: 'center' }}>
                <span style={{ width: 13, height: 13, background: '#1B2330', transform: 'rotate(45deg)', borderRadius: 2 }} />
                <span style={{ font: "600 10.5px 'Libre Franklin'", color: '#1B2330', lineHeight: 1.2 }}>{m.label}</span>
                <span style={{ font: "500 9px 'IBM Plex Mono',monospace", color: '#8A93A2' }}>{m.sub}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
