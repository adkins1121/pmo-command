import { useSync } from '../store/store'

// Small ambient sync status pill (bottom-left) + a blocking conflict resolver.
// Hidden entirely when there is no remote backend ('off').
export function SyncIndicator() {
  const sync = useSync()
  if (sync.status === 'off') return null

  const meta: Record<string, { dot: string; label: string; color: string; bg: string }> = {
    idle: { dot: '#1F8A5B', label: sync.lastSyncAt ? 'Synced' : 'Connected', color: '#2F6B53', bg: '#E4EEE9' },
    saving: { dot: '#2D6FE0', label: 'Saving…', color: '#2D6FE0', bg: '#E7EEFB' },
    offline: { dot: '#B45309', label: 'Offline — saved locally', color: '#B45309', bg: '#FEF3E2' },
    conflict: { dot: '#C2410C', label: 'Sync conflict', color: '#C2410C', bg: '#FBEAE5' },
  }
  const m = meta[sync.status] || meta.idle

  return (
    <>
      <div
        title={sync.lastSyncAt ? 'Last synced ' + new Date(sync.lastSyncAt).toLocaleTimeString() : 'Shared persistence active'}
        style={{ position: 'fixed', left: 14, bottom: 14, zIndex: 50, display: 'flex', alignItems: 'center', gap: 7, background: m.bg, color: m.color, border: '1px solid ' + m.color + '33', borderRadius: 20, padding: '6px 12px', font: "700 10.5px 'IBM Plex Mono',monospace", letterSpacing: '.03em', boxShadow: '0 2px 10px rgba(20,30,50,.12)' }}
      >
        <span style={{ width: 7, height: 7, borderRadius: '50%', background: m.dot }} />
        {m.label.toUpperCase()}
      </div>

      {sync.status === 'conflict' && sync.conflictRemote && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(18,26,40,.5)', zIndex: 80, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
          <div style={{ width: 'min(460px,94vw)', background: '#fff', borderRadius: 14, boxShadow: '0 30px 80px rgba(15,22,36,.45)', padding: '22px 24px' }}>
            <div style={{ font: "800 17px 'Libre Franklin'", color: '#15202E', marginBottom: 8 }}>Someone else saved changes</div>
            <div style={{ font: "400 13px/1.6 'Libre Franklin'", color: '#5A6473', marginBottom: 18 }}>
              The shared copy was updated by another session while you were editing (their revision {sync.conflictRemote.rev}).
              Choose which version to keep — this can't be undone.
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <button
                onClick={() => sync.resolveConflict('theirs')}
                style={{ textAlign: 'left', border: '1px solid #D5DBE3', background: '#F8FAFC', borderRadius: 10, padding: '12px 14px', cursor: 'pointer' }}
              >
                <div style={{ font: "700 13px 'Libre Franklin'", color: '#1B2330' }}>Load their version</div>
                <div style={{ font: "400 11.5px 'Libre Franklin'", color: '#7A8494', marginTop: 2 }}>Discard your unsaved local edits and use the shared copy.</div>
              </button>
              <button
                onClick={() => sync.resolveConflict('mine')}
                style={{ textAlign: 'left', border: '1px solid #E6A08F', background: '#FCF6F3', borderRadius: 10, padding: '12px 14px', cursor: 'pointer' }}
              >
                <div style={{ font: "700 13px 'Libre Franklin'", color: '#A8553F' }}>Keep my version</div>
                <div style={{ font: "400 11.5px 'Libre Franklin'", color: '#A87B6A', marginTop: 2 }}>Overwrite the shared copy with your current edits.</div>
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
