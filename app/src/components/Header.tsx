import { useMemo, useRef } from 'react'
import { useStore } from '../store/store'
import { useUI } from '../store/ui'
import type { ViewId } from '../data/types'
import { ACCENT, VIEWS } from '../lib/theme'
import { exportJson, freshDefaults, readImportFile } from '../lib/io'
import { downloadDrawio } from '../lib/drawio'

const DIM_DEFS: Record<string, { label: string; key: keyof FilterKeys }> = {
  phase: { label: 'Phase', key: 'fPhase' },
  vendor: { label: 'Vendor', key: 'fOwner' },
  status: { label: 'Status', key: 'fStatus' },
  objective: { label: 'Objective', key: 'fObjective' },
  worktype: { label: 'Work type', key: 'fWorkType' },
  group: { label: 'Group', key: 'fGroup' },
}
type FilterKeys = {
  fPhase: string
  fOwner: string
  fStatus: string
  fObjective: string
  fWorkType: string
  fGroup: string
}

export function Header() {
  const { data, replaceData } = useStore()
  const ui = useUI()
  const fileRef = useRef<HTMLInputElement>(null)

  const curView = (VIEWS.find((v) => v.id === ui.view) || { label: 'Dashboard' }).label

  // ---- options for filter dims ----
  const groupsU: string[] = []
  data.streams.forEach((s) => {
    if (s.group && groupsU.indexOf(s.group) < 0) groupsU.push(s.group)
  })
  const dimOpts: Record<string, { v: string; l: string }[]> = {
    phase: [{ v: 'all', l: 'All phases' }, ...data.phases.map((p) => ({ v: p.id, l: 'P' + p.n + ' · ' + p.name }))],
    vendor: [{ v: 'all', l: 'All vendors' }, ...data.owners.map((o) => ({ v: o.id, l: o.name }))],
    status: [
      { v: 'all', l: 'All status' },
      { v: 'done', l: 'Done' },
      { v: 'wip', l: 'In progress' },
      { v: 'mixed', l: 'Partly done' },
      { v: 'plan', l: 'Planned' },
      { v: 'risk', l: 'At risk' },
    ],
    objective: [
      { v: 'all', l: 'All objectives' },
      ...(data.objectives || []).map((o) => ({ v: o.id, l: o.code + ' · ' + o.name })),
    ],
    worktype: [
      { v: 'all', l: 'All work types' },
      { v: 'Epic', l: 'Epic' },
      { v: 'Task', l: 'Task' },
      { v: 'Milestone', l: 'Milestone' },
    ],
    group: [{ v: 'all', l: 'All groups' }, ...groupsU.map((g) => ({ v: g, l: g }))],
  }
  const activeFilters = ui.activeFilters
  const filterChips = activeFilters
    .filter((id) => DIM_DEFS[id])
    .map((id) => {
      const dd = DIM_DEFS[id]
      const val = (ui as any)[dd.key] || 'all'
      return { id, label: dd.label, key: dd.key, value: val, opts: dimOpts[id], active: val !== 'all' }
    })
  const availableAdd = Object.keys(DIM_DEFS)
    .filter((id) => activeFilters.indexOf(id) < 0)
    .map((id) => ({ id, label: DIM_DEFS[id].label }))
  const activeFilterCount = filterChips.filter((c) => c.active).length

  // ---- global search ----
  const searchResults = useMemo(() => {
    const sq = (ui.searchQ || '').trim().toLowerCase()
    const res: {
      type: string
      typeColor: string
      label: string
      sub: string
      view: ViewId
      item: string
    }[] = []
    if (sq) {
      data.streams
        .filter((s) => (s.name + ' ' + s.code + ' ' + (s.blurb || '')).toLowerCase().indexOf(sq) >= 0)
        .slice(0, 6)
        .forEach((s) =>
          res.push({ type: 'Work stream', typeColor: '#4A6491', label: s.name, sub: s.code, view: 'board', item: s.id }),
        )
      ;(data.objectives || [])
        .filter((o) => (o.name + ' ' + o.code).toLowerCase().indexOf(sq) >= 0)
        .slice(0, 4)
        .forEach((o) =>
          res.push({ type: 'Objective', typeColor: '#5B5391', label: o.name, sub: o.code, view: 'objectives', item: '' }),
        )
      ;(data.todos || [])
        .filter((t) => (t.text || '').toLowerCase().indexOf(sq) >= 0)
        .slice(0, 4)
        .forEach((t) => res.push({ type: 'Ad-hoc to-do', typeColor: '#B07D3C', label: t.text, sub: '', view: 'focus', item: '' }))
      const svc: typeof res = []
      data.environment.zones.forEach((z) =>
        z.services.forEach((s) => {
          if ((s.name + ' ' + (s.note || '')).toLowerCase().indexOf(sq) >= 0)
            svc.push({ type: 'Environment', typeColor: '#3E7C6A', label: s.name, sub: z.name, view: 'env', item: '' })
        }),
      )
      ;(data.environment.extCloud.services || []).forEach((s) => {
        if ((s.name + ' ' + (s.note || '')).toLowerCase().indexOf(sq) >= 0)
          svc.push({ type: 'Environment', typeColor: '#3E7C6A', label: s.name, sub: 'External cloud', view: 'env', item: '' })
      })
      svc.slice(0, 4).forEach((r) => res.push(r))
    }
    return res.slice(0, 12)
  }, [ui.searchQ, data])
  const searchOpen = (ui.searchQ || '').trim().length > 0
  const searchEmpty = searchOpen && searchResults.length === 0

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

  const closeMenu = () => ui.set({ headerMenuOpen: false })

  return (
    <header
      id="appHeader"
      style={{
        flex: 'none',
        background: 'linear-gradient(180deg,#1F2937,#151C28)',
        color: '#fff',
        padding: '0 20px',
        height: 62,
        display: 'flex',
        alignItems: 'center',
        gap: 16,
        boxShadow: '0 1px 0 rgba(0,0,0,.25),0 2px 8px rgba(0,0,0,.15)',
      }}
    >
      <div style={brandStyle}>◆</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 1, flex: 'none' }}>
        <div style={{ font: "700 15px 'Libre Franklin'", letterSpacing: '-.01em' }}>AMDG PMO</div>
        <div style={{ font: "500 9px 'IBM Plex Mono',monospace", color: '#8A93A2', letterSpacing: '.04em' }}>
          ERPNEXT · ABES PROGRAM
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 'none' }}>
        <button
          onClick={() => ui.set({ navOpen: true })}
          title="Menu"
          style={{
            background: '#2A3344',
            color: '#fff',
            border: '1px solid #3A4456',
            borderRadius: 8,
            width: 38,
            height: 34,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 16,
            cursor: 'pointer',
            lineHeight: 1,
          }}
        >
          ☰
        </button>
        <span style={{ font: "700 14px 'Libre Franklin'", color: '#fff', whiteSpace: 'nowrap' }}>{curView}</span>
      </div>

      {/* center: filters + search */}
      <div style={{ flex: 1, display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 10, padding: '0 16px' }}>
        <div style={{ position: 'relative', flex: 'none' }}>
          <button
            onClick={() => ui.update((s) => ({ filterOpen: !s.filterOpen, filterAddOpen: false }))}
            title="Filters"
            style={{
              background: '#2A3344',
              color: '#C7CDD6',
              border: '1px solid #3A4456',
              borderRadius: 8,
              height: 38,
              padding: '0 13px',
              display: 'flex',
              alignItems: 'center',
              gap: 7,
              cursor: 'pointer',
              font: "600 12px 'Libre Franklin'",
            }}
          >
            <svg width="13" height="13" viewBox="0 0 14 14">
              <path d="M1 2h12l-4.6 5.6V12L5.6 10.4V7.6z" fill="currentColor" />
            </svg>
            Filters
            {activeFilterCount > 0 && (
              <span
                style={{
                  background: '#E6772E',
                  color: '#fff',
                  borderRadius: 9,
                  minWidth: 17,
                  height: 17,
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  font: "700 9px 'IBM Plex Mono',monospace",
                  padding: '0 4px',
                }}
              >
                {activeFilterCount}
              </span>
            )}
          </button>
          {ui.filterOpen && (
            <>
              <div
                onClick={() => ui.set({ filterOpen: false, filterAddOpen: false })}
                style={{ position: 'fixed', inset: 0, zIndex: 40 }}
              />
              <div
                style={{
                  position: 'absolute',
                  left: 0,
                  top: 46,
                  zIndex: 41,
                  width: 292,
                  background: '#fff',
                  border: '1px solid #E4E8EE',
                  borderRadius: 11,
                  boxShadow: '0 18px 46px rgba(15,22,36,.3)',
                  padding: 14,
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                  <span style={{ font: "700 12px 'Libre Franklin'", color: '#1B2330' }}>Filters · global</span>
                  <button
                    onClick={() => ui.set({ fPhase: 'all', fOwner: 'all', fStatus: 'all', fObjective: 'all', fWorkType: 'all', fGroup: 'all' })}
                    style={{ background: 'none', border: 'none', color: '#8A93A2', font: "600 11px 'Libre Franklin'", cursor: 'pointer' }}
                  >
                    Clear all
                  </button>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 11 }}>
                  {filterChips.map((f) => (
                    <div key={f.id}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                        <span style={{ font: "600 10px 'Libre Franklin'", color: '#5A6473' }}>{f.label}</span>
                        <button
                          onClick={() =>
                            ui.update((s) => ({
                              activeFilters: s.activeFilters.filter((x) => x !== f.id),
                              [f.key]: 'all',
                            }))
                          }
                          style={{ background: 'none', border: 'none', color: '#C5CCD6', cursor: 'pointer', fontSize: 13, lineHeight: 1 }}
                        >
                          ✕
                        </button>
                      </div>
                      <select
                        value={f.value}
                        onChange={(e) => ui.set({ [f.key]: e.target.value } as any)}
                        style={{
                          width: '100%',
                          border: '1px solid #E4E8EE',
                          background: '#F8FAFC',
                          borderRadius: 8,
                          padding: '8px 10px',
                          font: "600 12px 'Libre Franklin'",
                          color: '#1B2330',
                          cursor: 'pointer',
                        }}
                      >
                        {f.opts.map((o) => (
                          <option key={o.v} value={o.v}>
                            {o.l}
                          </option>
                        ))}
                      </select>
                    </div>
                  ))}
                </div>
                {availableAdd.length > 0 && (
                  <>
                    <button
                      onClick={() => ui.update((s) => ({ filterAddOpen: !s.filterAddOpen }))}
                      style={{
                        marginTop: 12,
                        width: '100%',
                        border: '1px dashed #D5DBE3',
                        background: 'none',
                        borderRadius: 8,
                        padding: 9,
                        font: "600 12px 'Libre Franklin'",
                        color: '#5A6473',
                        cursor: 'pointer',
                      }}
                    >
                      + Add filter dimension
                    </button>
                    {ui.filterAddOpen && (
                      <div
                        style={{
                          marginTop: 6,
                          display: 'flex',
                          flexDirection: 'column',
                          gap: 2,
                          border: '1px solid #EEF1F4',
                          borderRadius: 8,
                          padding: 5,
                        }}
                      >
                        {availableAdd.map((a) => (
                          <button
                            key={a.id}
                            className="hov-soft"
                            onClick={() =>
                              ui.update((s) => ({ activeFilters: s.activeFilters.concat([a.id]), filterAddOpen: false }))
                            }
                            style={{
                              textAlign: 'left',
                              background: 'none',
                              border: 'none',
                              borderRadius: 6,
                              padding: '8px 10px',
                              font: "600 12px 'Libre Franklin'",
                              color: '#1B2330',
                              cursor: 'pointer',
                            }}
                          >
                            {a.label}
                          </button>
                        ))}
                      </div>
                    )}
                  </>
                )}
              </div>
            </>
          )}
        </div>

        <div style={{ position: 'relative', width: '100%', maxWidth: 440 }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              background: '#2A3344',
              border: '1px solid #3A4456',
              borderRadius: 8,
              padding: '7px 11px',
            }}
          >
            <span style={{ color: '#8A93A2', fontSize: 14, lineHeight: 1 }}>⌕</span>
            <input
              value={ui.searchQ}
              onChange={(e) => ui.set({ searchQ: e.target.value })}
              placeholder="Search everything…"
              style={{
                flex: 1,
                background: 'transparent',
                border: 'none',
                outline: 'none',
                color: '#E6EAF0',
                font: "500 12.5px 'Libre Franklin'",
              }}
            />
          </div>
          {searchOpen && (
            <>
              <div onClick={() => ui.set({ searchQ: '' })} style={{ position: 'fixed', inset: 0, zIndex: 40 }} />
              <div
                style={{
                  position: 'absolute',
                  left: 0,
                  right: 0,
                  top: 44,
                  zIndex: 41,
                  background: '#fff',
                  border: '1px solid #E4E8EE',
                  borderRadius: 11,
                  boxShadow: '0 18px 46px rgba(15,22,36,.32)',
                  padding: 6,
                  maxHeight: '62vh',
                  overflow: 'auto',
                }}
              >
                {searchEmpty && (
                  <div style={{ padding: 16, font: "500 12.5px 'Libre Franklin'", color: '#8A93A2', textAlign: 'center' }}>
                    No matches found
                  </div>
                )}
                {searchResults.map((r, i) => (
                  <button
                    key={i}
                    className="hov-soft"
                    onClick={() =>
                      ui.set({
                        searchQ: '',
                        view: r.view,
                        itemId: r.item || null,
                        itemKind: 'stream',
                        selectedId: r.item || null,
                        headerMenuOpen: false,
                      })
                    }
                    style={{
                      width: '100%',
                      textAlign: 'left',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10,
                      background: 'none',
                      border: 'none',
                      borderRadius: 8,
                      padding: '9px 11px',
                      cursor: 'pointer',
                    }}
                  >
                    <span style={{ width: 7, height: 7, borderRadius: 2, background: r.typeColor, flex: 'none' }} />
                    <span style={{ flex: 1, minWidth: 0 }}>
                      <span
                        style={{
                          display: 'block',
                          font: "600 13px 'Libre Franklin'",
                          color: '#1B2330',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                        }}
                      >
                        {r.label}
                      </span>
                      <span style={{ font: "500 10px 'IBM Plex Mono',monospace", color: '#9AA3B2' }}>{r.type}</span>
                    </span>
                    <span style={{ font: "500 10px 'IBM Plex Mono',monospace", color: '#B7BEC9', flex: 'none' }}>{r.sub}</span>
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {/* right cluster */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <button
          onClick={() => ui.set({ navOpen: false, headerMenuOpen: false })}
          title="AI assistant — search your connectors"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 7,
            background: 'linear-gradient(135deg,#2D6FE0,#1B9C8E)',
            color: '#fff',
            border: 'none',
            borderRadius: 7,
            padding: '7px 13px',
            font: "700 12px 'Libre Franklin'",
            cursor: 'pointer',
            boxShadow: '0 2px 8px rgba(29,111,224,.34)',
            opacity: 0.6,
          }}
        >
          ✦ Ask AI
        </button>
        <div style={{ position: 'relative' }}>
          <button
            onClick={() => ui.update((s) => ({ headerMenuOpen: !s.headerMenuOpen }))}
            title="More options"
            style={{
              background: 'transparent',
              color: '#C7CDD6',
              border: '1px solid #3A4456',
              borderRadius: 6,
              padding: '6px 11px',
              font: "700 14px 'Libre Franklin'",
              cursor: 'pointer',
              lineHeight: 1,
              letterSpacing: '1px',
            }}
          >
            ⋯
          </button>
          {ui.headerMenuOpen && (
            <>
              <div onClick={closeMenu} style={{ position: 'fixed', inset: 0, zIndex: 40 }} />
              <div
                style={{
                  position: 'absolute',
                  right: 0,
                  top: 40,
                  zIndex: 41,
                  background: '#fff',
                  border: '1px solid #E4E8EE',
                  borderRadius: 10,
                  boxShadow: '0 16px 44px rgba(15,22,36,.3)',
                  padding: 6,
                  minWidth: 184,
                  display: 'flex',
                  flexDirection: 'column',
                }}
              >
                {[
                  { label: 'Save as PDF', onClick: () => { closeMenu(); window.print() } },
                  { label: 'Export to draw.io', onClick: () => { closeMenu(); downloadDrawio(data) } },
                  { label: 'Export JSON', onClick: () => { closeMenu(); exportJson(data) } },
                  { label: 'Import JSON', onClick: () => { closeMenu(); fileRef.current?.click() } },
                ].map((m) => (
                  <button
                    key={m.label}
                    className="hov-soft"
                    onClick={m.onClick}
                    style={{
                      textAlign: 'left',
                      background: 'none',
                      border: 'none',
                      borderRadius: 7,
                      padding: '9px 11px',
                      font: "600 12.5px 'Libre Franklin'",
                      color: '#1B2330',
                      cursor: 'pointer',
                    }}
                  >
                    {m.label}
                  </button>
                ))}
                <div style={{ height: 1, background: '#EEF1F4', margin: '4px 8px' }} />
                <button
                  onClick={() => {
                    closeMenu()
                    if (confirm('Reset all data to defaults? This clears your saved edits.')) {
                      replaceData(freshDefaults())
                      ui.set({ selectedId: null, expandedId: null, itemId: null })
                    }
                  }}
                  style={{
                    textAlign: 'left',
                    background: 'none',
                    border: 'none',
                    borderRadius: 7,
                    padding: '9px 11px',
                    font: "600 12.5px 'Libre Franklin'",
                    color: '#C2410C',
                    cursor: 'pointer',
                  }}
                >
                  Reset to defaults
                </button>
              </div>
            </>
          )}
        </div>
        <button
          onClick={() => ui.update((s) => ({ edit: !s.edit, selectedId: null, editCollapsed: false }))}
          style={{
            background: ui.edit ? '#3E7C6A' : ACCENT,
            color: '#fff',
            border: 'none',
            borderRadius: 6,
            padding: '6px 14px',
            font: "600 11px 'Libre Franklin'",
            cursor: 'pointer',
          }}
        >
          {ui.edit ? 'Done editing' : 'Edit'}
        </button>
        <input
          type="file"
          accept="application/json"
          ref={fileRef}
          onChange={async (e) => {
            const f = e.target.files && e.target.files[0]
            if (!f) return
            try {
              replaceData(await readImportFile(f))
            } catch {
              alert('Could not parse that JSON file.')
            }
            e.target.value = ''
          }}
          style={{ display: 'none' }}
        />
      </div>
    </header>
  )
}
