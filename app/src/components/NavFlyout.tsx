import { useTheme } from '../store/store'
import { useUI } from '../store/ui'
import { VIEWS } from '../lib/theme'

export function NavFlyout() {
  const ui = useUI()
  const { primary: ACCENT } = useTheme()
  if (!ui.navOpen) return null

  const brandStyle: React.CSSProperties = {
    width: 30,
    height: 30,
    borderRadius: 8,
    flex: 'none',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 13,
    color: '#fff',
    background: ACCENT,
    boxShadow: `0 2px 10px ${ACCENT}66`,
  }

  return (
    <>
      <div
        onClick={() => ui.set({ navOpen: false })}
        style={{ position: 'fixed', inset: 0, background: 'rgba(10,15,24,.42)', zIndex: 70 }}
      />
      <div
        style={{
          position: 'fixed',
          left: 0,
          top: 0,
          bottom: 0,
          width: 252,
          zIndex: 71,
          background: 'linear-gradient(180deg,#1F2937,#151C28)',
          boxShadow: '8px 0 30px rgba(0,0,0,.34)',
          padding: '16px 14px',
          display: 'flex',
          flexDirection: 'column',
          gap: 3,
          overflow: 'auto',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 11,
            padding: '4px 8px 14px',
            marginBottom: 6,
            borderBottom: '1px solid #2A3344',
          }}
        >
          <div style={brandStyle}>◆</div>
          <div>
            <div style={{ font: "700 14px 'Libre Franklin'", color: '#fff', letterSpacing: '-.01em' }}>AMDG PMO</div>
            <div style={{ font: "500 8px 'IBM Plex Mono',monospace", color: '#8A93A2', letterSpacing: '.04em' }}>
              ERPNEXT · ABES PROGRAM
            </div>
          </div>
        </div>
        {VIEWS.map((v) => {
          const on = ui.view === v.id
          return (
            <button
              key={v.id}
              onClick={() => ui.set({ view: v.id, navOpen: false })}
              style={{
                textAlign: 'left',
                border: 'none',
                borderRadius: 8,
                padding: '11px 13px',
                font: "600 13px 'Libre Franklin'",
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                background: on ? ACCENT : 'transparent',
                color: on ? '#fff' : '#C7CDD6',
              }}
            >
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: on ? '#fff' : '#5A6B82', flex: 'none' }} />
              {v.label}
            </button>
          )
        })}
      </div>
    </>
  )
}
