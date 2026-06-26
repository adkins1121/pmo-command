import { useStore } from '../store/store'
import { useUI } from '../store/ui'
import { buildMaps, makePass, type EnrichedStream } from '../lib/derive'

export function Board() {
  const { data } = useStore()
  const ui = useUI()
  const { enrich } = buildMaps(data)
  const pass = makePass(ui)
  const fs = data.streams.filter(pass)
  const countLabel = fs.length + ' of ' + data.streams.length + ' streams'

  const openCard = (id: string) => ui.set({ selectedId: id, itemId: id, itemKind: 'stream' })

  const phaseCols = data.phases.map((ph) => {
    const items = fs.filter((s) => s.phaseId === ph.id).map(enrich)
    const order: string[] = []
    items.forEach((s) => {
      if (!order.includes(s.group)) order.push(s.group)
    })
    const groups = order.map((g) => ({ name: g, items: items.filter((s) => s.group === g) }))
    return {
      id: ph.id,
      n: ph.n,
      name: ph.name,
      sub: ph.sub,
      accent: ph.phi ? '#A8553F' : '#4A6491',
      phiLabel: ph.phi ? 'PHI' : 'NO PHI',
      phiBg: ph.phi ? '#F6EAE6' : '#EEF1F4',
      phiColor: ph.phi ? '#A8553F' : '#5A6473',
      groups,
    }
  })

  const card = (s: EnrichedStream) => (
    <div
      key={s.id}
      onDoubleClick={() => openCard(s.id)}
      style={{
        background: s.cardBg,
        border: s.cardBorder,
        borderLeft: '4px solid ' + s.color,
        borderRadius: 3,
        padding: '9px 11px',
        display: 'flex',
        flexDirection: 'column',
        gap: 6,
        cursor: 'pointer',
        boxShadow: '0 1px 2px rgba(20,30,50,.04)',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }}>
        <span style={{ font: "600 12.5px 'Libre Franklin'", color: '#1B2330', lineHeight: 1.25 }}>{s.name}</span>
        <span style={{ font: "500 9.5px 'IBM Plex Mono',monospace", color: '#A6AEBA', flex: 'none' }}>{s.code}</span>
      </div>
      <div style={{ font: "400 10.5px/1.45 'Libre Franklin'", color: '#5A6473' }}>{s.blurb}</div>
      <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
        <span
          style={{
            font: "600 8.5px 'IBM Plex Mono',monospace",
            padding: '2px 7px',
            borderRadius: 10,
            background: s.pillBg,
            color: s.pillColor,
          }}
        >
          {s.pillText}
        </span>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, font: "500 10px 'Libre Franklin'", color: '#7A8494' }}>
          <span style={{ width: 7, height: 7, borderRadius: '50%', background: s.color }} />
          {s.ownerName}
        </span>
        <span
          style={{
            font: "600 8px 'IBM Plex Mono',monospace",
            color: '#7A8494',
            border: '1px solid #E4E8EE',
            borderRadius: 8,
            padding: '1px 6px',
          }}
        >
          {s.workType}
        </span>
      </div>
    </div>
  )

  return (
    <div style={{ maxWidth: 1640, margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 16 }}>
        <div>
          <div style={{ font: "700 19px 'Libre Franklin'", color: '#1B2330' }}>Program board</div>
          <div style={{ font: "400 12.5px 'Libre Franklin'", color: '#7A8494', marginTop: 2 }}>
            Work streams by phase · color = vendor · treatment = status
          </div>
        </div>
        <div style={{ font: "500 11px 'IBM Plex Mono',monospace", color: '#9AA3B2' }}>{countLabel}</div>
      </div>
      <div style={{ display: 'flex', gap: 13, alignItems: 'stretch' }}>
        {phaseCols.map((col) => (
          <div key={col.id} style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div
              style={{
                background: '#fff',
                border: '1px solid #E4E8EE',
                borderTop: '3px solid ' + col.accent,
                borderRadius: 3,
                padding: '11px 12px',
                boxShadow: '0 1px 2px rgba(20,30,50,.05)',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ font: "600 11px 'IBM Plex Mono',monospace", color: col.accent, letterSpacing: '.04em' }}>
                  PHASE {col.n}
                </span>
                <span
                  style={{
                    font: "600 8.5px 'IBM Plex Mono',monospace",
                    padding: '2px 6px',
                    borderRadius: 9,
                    background: col.phiBg,
                    color: col.phiColor,
                  }}
                >
                  {col.phiLabel}
                </span>
              </div>
              <div style={{ font: "700 14.5px 'Libre Franklin'", color: '#1B2330', marginTop: 5 }}>{col.name}</div>
              <div style={{ font: "400 10.5px/1.4 'Libre Franklin'", color: '#7A8494', marginTop: 3 }}>{col.sub}</div>
            </div>
            {col.groups.map((g, gi) => (
              <div key={gi} style={{ display: 'contents' }}>
                {g.name && (
                  <div
                    style={{
                      font: "600 9px 'IBM Plex Mono',monospace",
                      color: '#A6AEBA',
                      textTransform: 'uppercase',
                      letterSpacing: '.07em',
                      marginTop: 3,
                    }}
                  >
                    {g.name}
                  </div>
                )}
                {g.items.map(card)}
              </div>
            ))}
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 16, marginTop: 20, flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 300, background: '#fff', border: '1px solid #E4E8EE', borderRadius: 3, padding: '15px 17px' }}>
          <div
            style={{
              font: "600 10px 'IBM Plex Mono',monospace",
              color: '#8A93A2',
              textTransform: 'uppercase',
              letterSpacing: '.06em',
              marginBottom: 9,
            }}
          >
            Gates & milestones
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
            {data.gates.map((gt) => (
              <div key={gt.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                <span
                  style={{
                    width: 10,
                    height: 10,
                    background: '#1B2330',
                    transform: 'rotate(45deg)',
                    borderRadius: 1,
                    flex: 'none',
                    marginTop: 3,
                  }}
                />
                <span style={{ font: "400 11.5px/1.4 'Libre Franklin'", color: '#41495A' }}>
                  <b>{gt.label}</b> — {gt.note}
                </span>
              </div>
            ))}
          </div>
        </div>
        <div
          style={{
            flex: 1,
            minWidth: 300,
            background: '#fff',
            border: '1px solid #E4E8EE',
            borderLeft: '3px solid #A8553F',
            borderRadius: 3,
            padding: '15px 17px',
          }}
        >
          <div
            style={{
              font: "600 10px 'IBM Plex Mono',monospace",
              color: '#A8553F',
              textTransform: 'uppercase',
              letterSpacing: '.06em',
              marginBottom: 9,
            }}
          >
            Phase 1 hard constraints · ADR-005
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {data.constraints.map((c) => (
              <div key={c.id} style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                <span style={{ color: '#A8553F', fontWeight: 700, flex: 'none' }}>—</span>
                <span style={{ font: "400 11.5px/1.45 'Libre Franklin'", color: '#41495A' }}>{c.text}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
