import { useStore } from '../store/store'
import { useUI } from '../store/ui'
import { buildMaps } from '../lib/derive'

export function Objectives() {
  const { data } = useStore()
  const ui = useUI()
  const { enrich } = buildMaps(data)
  const openCard = (id: string) => ui.set({ selectedId: id, itemId: id, itemKind: 'stream' })

  const objectivesView = (data.objectives || []).map((o) => {
    const sts = data.streams.filter((s) => s.objectiveId === o.id).map(enrich)
    const total = sts.length
    const done = sts.filter((s) => s.status === 'done').length
    const wip = sts.filter((s) => s.status === 'wip' || s.status === 'mixed').length
    const planc = sts.filter((s) => s.status === 'plan' || s.status === 'risk').length
    const synced = !!o.planeInitiativeId
    return {
      id: o.id,
      code: o.code,
      name: o.name,
      outcome: o.outcome,
      color: o.color || '#5A6473',
      streams: sts,
      doneW: (total ? (done / total) * 100 : 0) + '%',
      wipW: (total ? (wip / total) * 100 : 0) + '%',
      planW: (total ? (planc / total) * 100 : 0) + '%',
      pctLabel: total ? Math.round((done / total) * 100) + '% done' : 'no streams',
      planeText: synced ? 'Initiative ' + o.planeInitiativeId : 'Not synced',
      planeBg: synced ? '#E4EEE9' : '#F1E3CA',
      planeColor: synced ? '#3E7C6A' : '#8A6320',
    }
  })

  return (
    <div style={{ maxWidth: 1320, margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 16 }}>
        <div>
          <div style={{ font: "700 19px 'Libre Franklin'", color: '#1B2330' }}>Objectives</div>
          <div style={{ font: "400 12.5px 'Libre Franklin'", color: '#7A8494', marginTop: 2 }}>
            The outcomes the program delivers · each maps to a Plane Initiative, its streams become Projects
          </div>
        </div>
        <div style={{ font: "500 11px 'IBM Plex Mono',monospace", color: '#9AA3B2' }}>Option B · Initiative → Project</div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(420px,1fr))', gap: 14 }}>
        {objectivesView.map((o) => (
          <div
            key={o.id}
            style={{
              background: '#fff',
              border: '1px solid #E4E8EE',
              borderTop: '3px solid ' + o.color,
              borderRadius: 4,
              padding: '16px 18px',
              boxShadow: '0 1px 2px rgba(20,30,50,.05)',
              display: 'flex',
              flexDirection: 'column',
              gap: 11,
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 9 }}>
                <span style={{ font: "700 13px 'IBM Plex Mono',monospace", color: o.color }}>{o.code}</span>
                <span style={{ font: "700 15.5px 'Libre Franklin'", color: '#1B2330', lineHeight: 1.25 }}>{o.name}</span>
              </div>
              <span
                style={{
                  font: "600 8.5px 'IBM Plex Mono',monospace",
                  padding: '2px 7px',
                  borderRadius: 9,
                  background: o.planeBg,
                  color: o.planeColor,
                  flex: 'none',
                  whiteSpace: 'nowrap',
                }}
              >
                {o.planeText}
              </span>
            </div>
            <div style={{ font: "400 12px/1.5 'Libre Franklin'", color: '#5A6473' }}>{o.outcome}</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
              <div
                style={{
                  flex: 1,
                  height: 7,
                  borderRadius: 4,
                  background: '#EEF1F4',
                  overflow: 'hidden',
                  display: 'flex',
                }}
              >
                <div style={{ width: o.doneW, background: '#3E7C6A' }} />
                <div style={{ width: o.wipW, background: '#9DBFB4' }} />
                <div style={{ width: o.planW, background: '#DCE2E8' }} />
              </div>
              <span style={{ font: "600 10px 'IBM Plex Mono',monospace", color: '#7A8494', flex: 'none' }}>{o.pctLabel}</span>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {o.streams.map((s) => (
                <span
                  key={s.id}
                  onDoubleClick={() => openCard(s.id)}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    border: '1px solid #E7E9EE',
                    borderLeft: '3px solid ' + s.color,
                    borderRadius: 4,
                    padding: '5px 9px',
                    cursor: 'pointer',
                    background: s.cardBg,
                  }}
                >
                  <span style={{ font: "500 9px 'IBM Plex Mono',monospace", color: '#A6AEBA' }}>{s.code}</span>
                  <span style={{ font: "600 11px 'Libre Franklin'", color: '#1B2330' }}>{s.name}</span>
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
