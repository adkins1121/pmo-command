import { useStore } from '../store/store'
import { INT_META, INT_ORDER, MS_SVCS } from '../lib/integrations'

export function Integrations() {
  const { data, setData } = useStore()
  const conn = data.connections || {}

  const intConnected = (svc: string) =>
    svc === 'plane' ? !!(data.plane && data.plane.workspaceSlug) : !!(conn[svc] && conn[svc].connected)
  const intAcct = (svc: string) => (conn[svc] && conn[svc].account) || ''

  const integrations = INT_ORDER.map((svc) => {
    const m = INT_META[svc]
    const on = intConnected(svc)
    return {
      svc,
      ...m,
      connected: on,
      statusText: on ? 'Connected' : 'Not connected',
      acct: on ? intAcct(svc) : '',
      btnText: on ? (svc === 'plane' ? 'Open Plane sync' : 'Disconnect') : 'Connect',
      statusBg: on ? '#E4EEE9' : '#F1F3F6',
      statusColor: on ? '#2F6B53' : '#8A93A2',
      btnStyle: {
        width: '100%',
        borderRadius: 8,
        padding: 10,
        font: "600 12.5px 'Libre Franklin'",
        cursor: 'pointer',
        marginTop: 'auto',
        ...(on
          ? { background: '#fff', color: '#5A6473', border: '1px solid #D5DBE3' }
          : { background: '#1B2330', color: '#fff', border: 'none' }),
      } as React.CSSProperties,
    }
  })
  const intConnectedCount = integrations.filter((i) => i.connected).length
  const msAllConnected = MS_SVCS.every((s) => intConnected(s))

  const onConnect = (svc: string) => {
    if (svc === 'plane') {
      const slug = prompt('Connect Plane — enter your workspace slug:', data.plane.workspaceSlug || '')
      if (slug === null) return
      setData((d) => void (d.plane.workspaceSlug = slug.trim()))
      return
    }
    const cur = (data.connections || {})[svc]
    const prompts: Record<string, string> = {
      github: 'Connect GitHub — enter the org or owner (e.g. altus-kc):',
      gmail: 'Connect Gmail — enter the account email:',
      fireflies: 'Connect Fireflies — enter the workspace name:',
      claude: 'Connect Claude — enter your Anthropic workspace / org:',
      box: 'Connect Box — enter the enterprise / account:',
    }
    let acct: string | null = null
    if (prompts[svc] && !(cur && cur.connected)) {
      acct = prompt(prompts[svc], '')
      if (acct === null) return
    }
    setData((d) => {
      if (!d.connections) d.connections = {}
      if (!d.connections[svc]) d.connections[svc] = { connected: false, account: '' }
      d.connections[svc].connected = !d.connections[svc].connected
      if (prompts[svc]) {
        const fb: Record<string, string> = {
          github: 'github.com',
          gmail: 'me@gmail.com',
          fireflies: 'workspace',
          claude: 'anthropic.com',
          box: 'enterprise',
        }
        d.connections[svc].account = d.connections[svc].connected ? (acct && acct.trim() ? acct.trim() : fb[svc]) : ''
      }
    })
  }

  const onConnectMicrosoft = () => {
    const acct = prompt('Connect Microsoft 365 — enter the org account email:', '')
    if (acct === null) return
    setData((d) => {
      if (!d.connections) d.connections = {}
      ;['m365', 'outlook', 'teams', 'sharepoint', 'onedrive'].forEach((svc) => {
        if (!d.connections[svc]) d.connections[svc] = { connected: false, account: '' }
        d.connections[svc].connected = true
        d.connections[svc].account = acct.trim() || 'org@contoso.com'
      })
    })
  }

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 18 }}>
        <div>
          <div style={{ font: "700 19px 'Libre Franklin'", color: '#1B2330' }}>Integrations</div>
          <div style={{ font: "400 12.5px 'Libre Franklin'", color: '#7A8494', marginTop: 2 }}>
            Connect the tools the program runs on. Email, chat and meeting notes flow into your queues; Plane &amp; GitHub keep the plan and the code in sync.
          </div>
        </div>
        <div style={{ font: "600 11px 'IBM Plex Mono',monospace", color: '#3E7C6A', flex: 'none', whiteSpace: 'nowrap' }}>
          {intConnectedCount} connected
        </div>
      </div>

      {/* Microsoft 365 sweep */}
      <div
        style={{
          background: '#fff',
          border: '1px solid #E4E8EE',
          borderLeft: '3px solid #2D6FE0',
          borderRadius: 8,
          padding: '14px 17px',
          marginBottom: 14,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: 14,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 13 }}>
          <div style={{ width: 40, height: 40, borderRadius: 10, background: '#3E5C9A', color: '#fff', flex: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', font: "800 16px 'Libre Franklin'" }}>
            M
          </div>
          <div>
            <div style={{ font: "700 14px 'Libre Franklin'", color: '#1B2330' }}>Microsoft 365 suite</div>
            <div style={{ font: "400 12px 'Libre Franklin'", color: '#5A6473', marginTop: 1 }}>
              Outlook, Teams, SharePoint &amp; OneDrive — authorize once and connect the whole suite in a single sweep.
            </div>
          </div>
        </div>
        <button
          onClick={onConnectMicrosoft}
          style={{
            border: 'none',
            borderRadius: 8,
            padding: '10px 18px',
            font: "600 12.5px 'Libre Franklin'",
            cursor: 'pointer',
            whiteSpace: 'nowrap',
            ...(msAllConnected ? { background: '#E4EEE9', color: '#2F6B53' } : { background: '#2D6FE0', color: '#fff' }),
          }}
        >
          {msAllConnected ? 'All connected' : 'Connect all Microsoft'}
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(340px,1fr))', gap: 14 }}>
        {integrations.map((i) => (
          <div
            key={i.svc}
            style={{
              background: '#fff',
              border: '1px solid #E4E8EE',
              borderRadius: 8,
              padding: '17px 18px',
              boxShadow: '0 1px 2px rgba(20,30,50,.05)',
              display: 'flex',
              flexDirection: 'column',
              gap: 12,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
              <div style={{ width: 42, height: 42, borderRadius: 10, background: i.accent, color: '#fff', flex: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', font: "800 16px 'Libre Franklin'" }}>
                {i.icon}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ font: "700 15px 'Libre Franklin'", color: '#1B2330' }}>{i.name}</div>
                <div style={{ font: "500 10px 'IBM Plex Mono',monospace", color: '#9AA3B2', marginTop: 1 }}>{i.cat}</div>
              </div>
              <span
                style={{
                  font: "700 8.5px 'IBM Plex Mono',monospace",
                  padding: '3px 9px',
                  borderRadius: 9,
                  background: i.statusBg,
                  color: i.statusColor,
                  flex: 'none',
                  whiteSpace: 'nowrap',
                }}
              >
                {i.statusText}
              </span>
            </div>
            <div style={{ font: "400 12px/1.55 'Libre Franklin'", color: '#5A6473' }}>{i.desc}</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
              {i.syncs.map((s, k) => (
                <div key={k} style={{ display: 'flex', alignItems: 'center', gap: 8, font: "500 11.5px 'Libre Franklin'", color: '#41495A' }}>
                  <span style={{ width: 5, height: 5, borderRadius: '50%', background: i.accent, flex: 'none' }} />
                  {s}
                </div>
              ))}
            </div>
            {i.acct && (
              <div style={{ font: "500 10px 'IBM Plex Mono',monospace", color: '#8A93A2', background: '#F6F8FA', borderRadius: 6, padding: '6px 9px' }}>
                {i.acct}
              </div>
            )}
            <button onClick={() => onConnect(i.svc)} style={i.btnStyle}>
              {i.btnText}
            </button>
          </div>
        ))}
      </div>

      <div style={{ marginTop: 14, font: "400 11px 'IBM Plex Mono',monospace", color: '#B7BEC9' }}>
        Connections are stored locally for this prototype · MCP / live auth wires in here.
      </div>
    </div>
  )
}
