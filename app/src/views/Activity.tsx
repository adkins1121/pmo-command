import { useMemo, useState } from 'react'
import { useStore } from '../store/store'
import { useUI } from '../store/ui'
import { ACTIVITY_TYPES, agoOf, buildActivity, type ActivityType } from '../lib/activity'

export function Activity() {
  const { data } = useStore()
  const ui = useUI()
  const [fType, setFType] = useState<'all' | ActivityType>('all')
  // single now-stamp per render so relative times are consistent
  const now = useMemo(() => Date.now(), [data, fType])

  const all = useMemo(() => buildActivity(data, now), [data, now])
  const counts: Record<string, number> = { all: all.length }
  ACTIVITY_TYPES.forEach((t) => (counts[t] = all.filter((e) => e.type === t).length))
  const entries = fType === 'all' ? all : all.filter((e) => e.type === fType)

  const typeOpts = [{ v: 'all', l: 'All activity' }, ...ACTIVITY_TYPES.map((t) => ({ v: t, l: t }))]

  return (
    <div style={{ maxWidth: 1000, margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div>
          <div style={{ font: "700 19px 'Libre Franklin'", color: '#1B2330' }}>Activity feed</div>
          <div style={{ font: "400 12.5px 'Libre Franklin'", color: '#7A8494', marginTop: 2 }}>
            Everything that moved — plan updates, decisions, insights, blockers and tasks. Every entry links back to its source.
          </div>
        </div>
        <select
          value={fType}
          onChange={(e) => setFType(e.target.value as 'all' | ActivityType)}
          style={{ border: '1px solid #D5DBE3', borderRadius: 6, padding: '7px 11px', fontSize: 12, background: '#fff', color: '#1B2330', cursor: 'pointer' }}
        >
          {typeOpts.map((o) => (
            <option key={o.v} value={o.v}>
              {o.l}
            </option>
          ))}
        </select>
      </div>

      {/* type chips */}
      <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap', marginBottom: 16 }}>
        {[{ v: 'all' as const, l: 'All', c: '#1B2330' }, ...ACTIVITY_TYPES.map((t) => ({ v: t, l: t, c: undefined }))].map((t) => {
          const on = fType === t.v
          return (
            <button
              key={t.v}
              onClick={() => setFType(t.v as 'all' | ActivityType)}
              style={{
                border: '1px solid ' + (on ? '#1B2330' : '#E4E8EE'),
                background: on ? '#1B2330' : '#fff',
                color: on ? '#fff' : '#5A6473',
                borderRadius: 20,
                padding: '6px 13px',
                font: "600 11.5px 'Libre Franklin'",
                cursor: 'pointer',
              }}
            >
              {t.l} <span style={{ opacity: 0.7, font: "600 10px 'IBM Plex Mono',monospace" }}>{counts[t.v] ?? 0}</span>
            </button>
          )
        })}
      </div>

      <div style={{ background: '#fff', border: '1px solid #E4E8EE', borderRadius: 8, boxShadow: '0 1px 2px rgba(20,30,50,.05)', overflow: 'hidden' }}>
        {entries.length === 0 && (
          <div style={{ padding: 28, textAlign: 'center', font: "500 12.5px 'Libre Franklin'", color: '#A6AEBA' }}>
            Nothing here yet
          </div>
        )}
        {entries.map((e, i) => (
          <div
            key={e.id}
            onDoubleClick={() => (e.openId ? ui.set({ itemId: e.openId, itemKind: e.openKind || 'stream' }) : undefined)}
            style={{
              display: 'flex',
              gap: 13,
              padding: '14px 18px',
              borderTop: i === 0 ? 'none' : '1px solid #F0F2F5',
              cursor: e.openId ? 'pointer' : 'default',
              alignItems: 'flex-start',
            }}
          >
            {/* timeline dot */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 'none', paddingTop: 3 }}>
              <span style={{ width: 10, height: 10, borderRadius: '50%', background: e.typeColor }} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, flexWrap: 'wrap' }}>
                <span
                  style={{
                    font: "700 8.5px 'IBM Plex Mono',monospace",
                    letterSpacing: '.05em',
                    textTransform: 'uppercase',
                    color: e.typeColor,
                    background: e.typeColor + '1A',
                    borderRadius: 5,
                    padding: '2px 7px',
                  }}
                >
                  {e.type}
                </span>
                <span style={{ font: "500 10px 'IBM Plex Mono',monospace", color: '#9AA3B2' }}>{agoOf(e.at, now)}</span>
              </div>
              <div style={{ font: "600 13px/1.4 'Libre Franklin'", color: '#1B2330' }}>{e.title}</div>
              <div style={{ font: "500 10.5px 'IBM Plex Mono',monospace", color: '#8A93A2', marginTop: 3 }}>{e.meta}</div>
            </div>
            {/* source link */}
            <div style={{ flex: 'none', textAlign: 'right' }}>
              {e.source.url ? (
                <a
                  href={e.source.url}
                  target="_blank"
                  rel="noopener"
                  title={e.source.ref ? e.source.label + ' · ' + e.source.ref : 'Open in ' + e.source.label}
                  style={{
                    textDecoration: 'none',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 5,
                    font: "600 10px 'IBM Plex Mono',monospace",
                    color: '#2D6FE0',
                    background: '#EEF4FE',
                    border: '1px solid #D6E4FB',
                    borderRadius: 6,
                    padding: '4px 9px',
                  }}
                >
                  ↗ {e.source.label}
                </a>
              ) : (
                <span
                  title={e.source.ref ? e.source.label + ' · ' + e.source.ref : e.source.label}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 5,
                    font: "600 10px 'IBM Plex Mono',monospace",
                    color: '#8A93A2',
                    background: '#F4F6F9',
                    border: '1px solid #E4E8EE',
                    borderRadius: 6,
                    padding: '4px 9px',
                  }}
                >
                  {e.source.label}
                </span>
              )}
              {e.source.ref && (
                <div style={{ font: "500 9px 'IBM Plex Mono',monospace", color: '#B7BEC9', marginTop: 3, maxWidth: 150, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {e.source.ref}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
