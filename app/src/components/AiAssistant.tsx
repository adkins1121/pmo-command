import { useStore } from '../store/store'
import { useUI } from '../store/ui'
import { mix } from '../data/helpers'
import { AI_NAME_MAP, INT_META, INT_ORDER } from '../lib/integrations'
import { aiSearch } from '../lib/mockClaude'

const SUGGESTIONS = [
  'What’s blocking the data migration right now?',
  'Any unanswered questions waiting on Cissy or ABES?',
  'Summarize decisions made in the last week.',
]

export function AiAssistant() {
  const { data } = useStore()
  const ui = useUI()
  if (!ui.aiOpen) return null

  const conn = data.connections || {}
  const connectedKeys = Object.keys(AI_NAME_MAP).filter((s) =>
    s === 'plane' ? !!(data.plane && data.plane.workspaceSlug) : !!(conn[s] && conn[s].connected),
  )
  const accentByName: Record<string, string> = {}
  INT_ORDER.forEach((svc) => (accentByName[INT_META[svc].name] = INT_META[svc].accent))
  const chips = connectedKeys.map((k) => {
    const name = AI_NAME_MAP[k]
    const accent = accentByName[name] || '#5A6473'
    return { name, color: accent, bg: mix(accent, 0.88) }
  })

  const ask = async () => {
    const q = (ui.aiQuery || '').trim()
    if (!q || ui.aiLoading) return
    // The whole program dataset is always searchable; connected connectors are
    // added only for attribution. No connectors are required to ask.
    const sources = chips.map((c) => c.name)
    ui.set({ aiLoading: true, aiError: '', aiAnswer: '', aiResults: null })
    try {
      const { answer, results } = await aiSearch(data, q, sources)
      ui.set({ aiLoading: false, aiAnswer: answer, aiResults: results })
    } catch (e: any) {
      ui.set({ aiLoading: false, aiError: 'Could not complete the search — ' + ((e && e.message) || String(e)) })
    }
  }

  const hasAnswer = !!ui.aiAnswer
  const hasResults = (ui.aiResults || []).length > 0
  const empty = !ui.aiLoading && !hasAnswer && !ui.aiError

  return (
    <>
      <div onClick={() => ui.set({ aiOpen: false })} style={{ position: 'fixed', inset: 0, background: 'rgba(10,15,24,.34)', zIndex: 72 }} />
      <div style={{ position: 'fixed', right: 0, top: 0, bottom: 0, width: 'min(440px,94vw)', zIndex: 73, background: '#fff', boxShadow: '-12px 0 40px rgba(0,0,0,.24)', display: 'flex', flexDirection: 'column' }}>
        <div style={{ background: 'linear-gradient(135deg,#2D6FE0,#1B9C8E)', color: '#fff', padding: '16px 18px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ font: "800 16px 'Libre Franklin'" }}>✦ AI assistant</span>
            <button onClick={() => ui.set({ aiOpen: false })} style={{ background: 'rgba(255,255,255,.18)', border: 'none', color: '#fff', borderRadius: 6, width: 26, height: 26, cursor: 'pointer', fontSize: 14 }}>✕</button>
          </div>
          <div style={{ font: "500 11.5px 'Libre Franklin'", opacity: 0.92, marginTop: 4 }}>Searches all your program data — and any connected sources — and answers in plain language.</div>
        </div>

        <div style={{ padding: '14px 18px', borderBottom: '1px solid #EEF1F4' }}>
          <textarea
            value={ui.aiQuery}
            onChange={(e) => ui.set({ aiQuery: e.target.value })}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                ask()
              }
            }}
            placeholder="Ask across all your program data…  (Enter)"
            style={{ width: '100%', minHeight: 56, resize: 'vertical', border: '1px solid #E4E8EE', borderRadius: 9, padding: '10px 12px', font: "500 13px/1.5 'Libre Franklin'", color: '#2A3242', outline: 'none' }}
          />
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 9 }}>
            <span style={{ font: "600 9.5px 'IBM Plex Mono',monospace", color: '#2F6B53', background: '#E4EEE9', borderRadius: 7, padding: '3px 8px' }}>All program data</span>
            {chips.map((c) => (
              <span key={c.name} style={{ font: "600 9.5px 'IBM Plex Mono',monospace", color: c.color, background: c.bg, borderRadius: 7, padding: '3px 8px' }}>
                {c.name}
              </span>
            ))}
          </div>
          <button onClick={ask} style={{ marginTop: 10, width: '100%', background: '#15202E', color: '#fff', border: 'none', borderRadius: 9, padding: '10px', font: "700 12.5px 'Libre Franklin'", cursor: 'pointer' }}>
            {ui.aiLoading ? 'Searching…' : 'Search all information'}
          </button>
        </div>

        <div style={{ flex: 1, overflow: 'auto', padding: '16px 18px' }}>
          {empty && (
            <div>
              <div style={{ font: "700 9px 'IBM Plex Mono',monospace", color: '#A6AEBA', letterSpacing: '.06em', marginBottom: 9 }}>TRY ASKING</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {SUGGESTIONS.map((s) => (
                  <button
                    key={s}
                    onClick={() => ui.set({ aiQuery: s })}
                    style={{ textAlign: 'left', background: '#F6F8FA', border: '1px solid #EEF1F4', borderRadius: 9, padding: '10px 12px', font: "500 12.5px 'Libre Franklin'", color: '#41495A', cursor: 'pointer' }}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}
          {ui.aiError && (
            <div style={{ background: '#FBF1ED', border: '1px solid #E2C2B8', borderRadius: 9, padding: '11px 14px', font: "500 12px 'Libre Franklin'", color: '#A8553F' }}>{ui.aiError}</div>
          )}
          {hasAnswer && (
            <div style={{ background: '#F4F8FF', border: '1px solid #DCE8FB', borderRadius: 10, padding: '13px 15px', marginBottom: 14 }}>
              <div style={{ font: "700 9px 'IBM Plex Mono',monospace", color: '#2D6FE0', letterSpacing: '.06em', marginBottom: 6 }}>SYNTHESIS</div>
              <div style={{ font: "500 13px/1.6 'Libre Franklin'", color: '#1B2330' }}>{ui.aiAnswer}</div>
            </div>
          )}
          {hasResults && (
            <>
              <div style={{ font: "700 9px 'IBM Plex Mono',monospace", color: '#A6AEBA', letterSpacing: '.06em', marginBottom: 9 }}>RESULTS</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
                {(ui.aiResults || []).map((r, i) => {
                  const accent = accentByName[r.source] || '#5A6473'
                  return (
                    <div key={i} style={{ border: '1px solid #E7E9EE', borderLeft: '3px solid ' + accent, borderRadius: 8, padding: '10px 12px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }}>
                        <span style={{ font: "600 12.5px 'Libre Franklin'", color: '#1B2330' }}>{r.title}</span>
                        <span style={{ font: "600 8.5px 'IBM Plex Mono',monospace", color: accent, background: mix(accent, 0.88), borderRadius: 7, padding: '2px 7px', flex: 'none' }}>{r.source}</span>
                      </div>
                      <div style={{ font: "400 11px/1.5 'Libre Franklin'", color: '#6A7382', marginTop: 4 }}>{r.snippet}</div>
                      <div style={{ font: "500 9px 'IBM Plex Mono',monospace", color: '#B7BEC9', marginTop: 5 }}>{r.date}</div>
                    </div>
                  )
                })}
              </div>
            </>
          )}
        </div>
      </div>
    </>
  )
}
