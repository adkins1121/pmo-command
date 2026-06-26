import { useUI } from '../store/ui'
import { VIEWS } from '../lib/theme'

const NOTE: Record<string, string> = {
  standup: 'Committed/completed, carryover, active blockers and open decisions across two windows.',
  timeline: 'Each stream as a lane across sprints & phases, with the gates and milestones row.',
  deps: 'Drag-and-drop dependency canvas with Functional / Logical / Delivery lenses.',
  env: 'Freeform environment topology — trust zones, firewalls, services and the ABES entity.',
  insights: 'Claude-powered reconciliation engine surfacing where the plan and comms drift.',
  integrations: 'Connect Outlook, Teams, Plane (MCP), Claude, Gmail, Fireflies, Box and more.',
}

export function Placeholder() {
  const ui = useUI()
  const label = (VIEWS.find((v) => v.id === ui.view) || { label: '' }).label
  return (
    <div style={{ maxWidth: 720, margin: '64px auto 0', textAlign: 'center' }}>
      <div style={{ font: "700 19px 'Libre Franklin'", color: '#1B2330' }}>{label}</div>
      <div style={{ font: "400 13px 'Libre Franklin'", color: '#7A8494', marginTop: 8, lineHeight: 1.6 }}>
        {NOTE[ui.view] || ''}
      </div>
      <div
        style={{
          marginTop: 22,
          display: 'inline-block',
          background: '#fff',
          border: '1px solid #E4E8EE',
          borderRadius: 8,
          padding: '10px 16px',
          font: "600 11px 'IBM Plex Mono',monospace",
          color: '#9AA3B2',
          letterSpacing: '.04em',
        }}
      >
        BUILDING NEXT · core slice shipped first
      </div>
    </div>
  )
}
