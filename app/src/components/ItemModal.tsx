import { useStore } from '../store/store'
import { useUI } from '../store/ui'
import { buildMaps } from '../lib/derive'
import { planeUrl } from '../lib/activity'
import { nid } from '../data/helpers'
import type { PmoData, Service, Status, Stream, Todo } from '../data/types'

const LBLC = ['#E6B800', '#E8772E', '#E891AE', '#E03B2E', '#5BBE8B', '#3FB6C2', '#2D6FE0', '#13315C', '#7A52E0', '#C42E8E', '#2E7D52', '#5A6473']
const segOn: React.CSSProperties = { border: 'none', borderRadius: 7, padding: '7px 16px', fontSize: 14, cursor: 'pointer', lineHeight: 1 }
const propLabel: React.CSSProperties = { font: "600 12px 'Libre Franklin'", color: '#5A6473', marginBottom: 7 }
const propSelect: React.CSSProperties = {
  width: '100%',
  border: 'none',
  background: '#F1F3F6',
  borderRadius: 9,
  padding: '11px 12px',
  font: "600 13px 'Libre Franklin'",
  color: '#1B2330',
  marginBottom: 18,
  cursor: 'pointer',
}
const sectLabel: React.CSSProperties = {
  font: "700 11px 'IBM Plex Mono',monospace",
  color: '#9AA3B2',
  letterSpacing: '.08em',
  marginBottom: 8,
}

function findSvc(d: PmoData, id: string): Service | null {
  let r: Service | null = null
  ;(d.environment.extCloud.services || []).forEach((s) => {
    if (s.id === id) r = s
  })
  d.environment.zones.forEach((z) =>
    z.services.forEach((s) => {
      if (s.id === id) r = s
    }),
  )
  return r
}

export function ItemModal() {
  const { data, setData } = useStore()
  const ui = useUI()
  const { enrich } = buildMaps(data)

  if (!ui.itemId) return null
  const itemId = ui.itemId
  const kind = ui.itemKind

  // mutate the active item
  const mutItem = (fn: (s: any, d: PmoData) => void) =>
    setData((d) => {
      if (kind === 'service') {
        const s = findSvc(d, itemId)
        if (s) fn(s, d)
      } else if (kind === 'todo') {
        const s = (d.todos || []).find((x) => x.id === itemId)
        if (s) fn(s, d)
      } else {
        const s = d.streams.find((x) => x.id === itemId)
        if (s) fn(s, d)
      }
    })

  const close = () => ui.set({ itemId: null, labelPickerOpen: false, labelEdit: null })

  // ---- build itemView ----
  type IV = any
  let itemView: IV = null
  if (kind === 'service') {
    const svc = findSvc(data, itemId)
    if (svc) {
      let contZid = 'ext',
        contName = 'External cloud'
      data.environment.zones.forEach((z) => {
        if (z.services.some((s) => s.id === svc.id)) {
          contZid = z.id
          contName = z.name
        }
      })
      const tEntry = (data.environment.svcTypes || []).find((x) => x.id === svc.type) || ({} as any)
      itemView = {
        isStream: false,
        isService: true,
        id: svc.id,
        name: svc.name || '',
        code: tEntry.short || 'SERVICE',
        blurb: svc.note || '',
        svcType: svc.type,
        contZid,
        activity: [{ text: 'Service in ' + contName }],
      }
    }
  } else if (kind === 'todo') {
    const td = (data.todos || []).find((x) => x.id === itemId)
    if (td) {
      const done = !!td.done
      itemView = {
        isTodo: true,
        id: td.id,
        name: td.text || '',
        code: 'TO-DO',
        blurb: td.desc || '',
        priority: td.priority || 'med',
        source: td.source || 'manual',
        phaseId: td.phaseId,
        objectiveId: td.objectiveId,
        ownerId: td.ownerId,
        workType: td.workType || 'Task',
        activity: [{ text: 'Ad-hoc to-do' }],
        incBtn: { ...segOn, background: done ? 'transparent' : '#fff', color: done ? '#A6AEBA' : '#1B2330', boxShadow: done ? 'none' : '0 1px 2px rgba(20,30,50,.16)' },
        cmpBtn: { ...segOn, background: done ? '#1F8A5B' : 'transparent', color: done ? '#fff' : '#A6AEBA', boxShadow: done ? '0 1px 2px rgba(20,30,50,.16)' : 'none' },
      }
    }
  } else {
    const raw = data.streams.find((x) => x.id === itemId)
    if (raw) {
      const e = enrich(raw)
      const lids = raw.labelIds || []
      const labels = lids
        .map((id) => (data.labels || []).find((l) => l.id === id))
        .filter(Boolean)
        .map((l) => ({ id: l!.id, name: l!.name, color: l!.color }))
      const subs = (raw.subtasks || []).map((t) => ({
        id: t.id,
        text: t.text,
        done: t.done,
        check: t.done ? '✓' : '',
        boxBg: t.done ? '#1F8A5B' : '#fff',
        boxBorder: t.done ? '#1F8A5B' : '#CBD2DC',
        textColor: t.done ? '#9AA3B2' : '#2A3242',
        strike: t.done ? ('line-through' as const) : ('none' as const),
      }))
      const comments = (raw.comments || []).map((c) => ({ id: c.id, text: c.text, when: new Date(c.at).toLocaleDateString() }))
      const activity = [{ text: 'Created · ' + raw.code + ' ' + raw.name }, { text: 'Status → ' + e.pillText }]
      itemView = {
        isStream: true,
        id: raw.id,
        name: raw.name,
        code: raw.code,
        blurb: raw.blurb || '',
        phaseId: raw.phaseId,
        objectiveId: raw.objectiveId,
        ownerId: raw.ownerId,
        status: raw.status,
        workType: raw.workType || 'Epic',
        group: raw.group || '',
        depsText: (raw.deps || []).join(', '),
        subtasks: subs,
        comments,
        activity,
        labels,
        hasLabels: labels.length > 0,
      }
    }
  }
  if (!itemView) return null

  // ---- option lists ----
  const statusOpts = [
    { v: 'done', l: 'Done' },
    { v: 'wip', l: 'In progress' },
    { v: 'mixed', l: 'Partly done' },
    { v: 'plan', l: 'Planned' },
    { v: 'risk', l: 'At risk' },
  ]
  const phaseOpts = data.phases.map((p) => ({ v: p.id, l: 'P' + p.n + ' · ' + p.name }))
  const objectiveOpts = (data.objectives || []).map((o) => ({ v: o.id, l: o.code + ' · ' + o.name }))
  const ownerOpts = data.owners.map((o) => ({ v: o.id, l: o.name }))
  const itemWorkTypeOpts = [
    { v: 'Epic', l: 'Epic' },
    { v: 'Task', l: 'Task' },
    { v: 'Milestone', l: 'Milestone' },
  ]
  const prOpts = [
    { v: 'high', l: 'High' },
    { v: 'med', l: 'Med' },
    { v: 'low', l: 'Low' },
  ]
  const todoSourceOpts = [
    { v: 'manual', l: 'Manual' },
    { v: 'email', l: 'Outlook' },
    { v: 'teams', l: 'Teams' },
    { v: 'plane', l: 'Plane' },
  ]
  const envSvcTypeOpts2 = (data.environment.svcTypes || []).map((x) => ({ v: x.id, l: x.label }))
  const envContOpts = [{ v: 'ext', l: 'External cloud' }, ...data.environment.zones.map((z) => ({ v: z.id, l: z.name }))]

  // label picker / editor view models
  const itemLabelIds = (kind === 'stream' && (data.streams.find((x) => x.id === itemId) || ({} as Stream)).labelIds) || []
  const labelPickerItems = (data.labels || []).map((l) => {
    const on = itemLabelIds.indexOf(l.id) >= 0
    return { id: l.id, name: l.name, color: l.color, check: on ? '✓' : '', boxBg: on ? '#1F8A5B' : '#fff', boxBorder: on ? '#1F8A5B' : '#CBD2DC' }
  })
  const labelEditView = ui.labelEdit
    ? {
        name: ui.labelEdit.name || '',
        color: ui.labelEdit.color,
        swatches: LBLC.map((c) => ({ color: c, ring: c === ui.labelEdit!.color ? '#15202E' : 'transparent', check: c === ui.labelEdit!.color ? '✓' : '' })),
      }
    : null

  // ---- label handlers ----
  const onLabelSave = () => {
    const le = ui.labelEdit
    if (!le) return
    setData((d) => {
      d.labels = d.labels || []
      if (le.id) {
        const l = d.labels.find((x) => x.id === le.id)
        if (l) {
          l.name = le.name || 'Label'
          l.color = le.color
        }
      } else {
        const id = nid('lab')
        d.labels.push({ id, name: le.name || 'Label', color: le.color })
        const s = d.streams.find((x) => x.id === itemId)
        if (s) {
          s.labelIds = s.labelIds || []
          s.labelIds.push(id)
        }
      }
    })
    ui.set({ labelEdit: null, labelPickerOpen: true })
  }
  const onLabelDelete = () => {
    const le = ui.labelEdit
    if (!le || !le.id) return
    setData((d) => {
      d.labels = (d.labels || []).filter((x) => x.id !== le.id)
      d.streams.forEach((s) => {
        if (s.labelIds) s.labelIds = s.labelIds.filter((x) => x !== le.id)
      })
    })
    ui.set({ labelEdit: null })
  }

  const onArchive = () => {
    if (kind === 'service') {
      if (!confirm('Delete this service?')) return
      setData((d) => {
        ;(d.environment.extCloud.services || []).forEach((s, i) => {
          if (s.id === itemId) d.environment.extCloud.services.splice(i, 1)
        })
        d.environment.zones.forEach((z) => {
          const i = z.services.findIndex((s) => s.id === itemId)
          if (i >= 0) z.services.splice(i, 1)
        })
      })
      ui.set({ itemId: null })
      return
    }
    if (!confirm('Archive (delete) this work stream?')) return
    setData((d) => {
      const i = d.streams.findIndex((x) => x.id === itemId)
      if (i >= 0) d.streams.splice(i, 1)
    })
    ui.set({ itemId: null })
  }

  return (
    <div
      onClick={close}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(18,26,40,.46)',
        zIndex: 60,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 28,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 'min(1060px,95vw)',
          maxHeight: '88vh',
          background: '#fff',
          borderRadius: 15,
          boxShadow: '0 30px 80px rgba(15,22,36,.42)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        {/* title row */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '22px 26px 12px' }}>
          <input
            value={itemView.name}
            onChange={(e) => mutItem((s) => (kind === 'todo' ? (s.text = e.target.value) : (s.name = e.target.value)))}
            placeholder="Task name"
            style={{ flex: 1, border: 'none', outline: 'none', font: "800 26px 'Libre Franklin'", color: '#15202E', background: 'transparent', padding: 0, letterSpacing: '-.01em' }}
          />
          <span style={{ font: "500 12px 'IBM Plex Mono',monospace", color: '#B7BEC9', flex: 'none' }}>{itemView.code}</span>
          <button onClick={close} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 20, color: '#9AA3B2', lineHeight: 1, padding: '2px 4px' }}>
            ✕
          </button>
        </div>

        <div style={{ flex: 1, display: 'flex', minHeight: 0, overflow: 'hidden' }}>
          {/* LEFT */}
          <div style={{ flex: 1, overflow: 'auto', padding: '10px 26px 24px' }}>
            <div style={sectLabel}>DESCRIPTION</div>
            <textarea
              value={itemView.blurb}
              onChange={(e) => mutItem((s) => (kind === 'service' ? (s.note = e.target.value) : kind === 'todo' ? (s.desc = e.target.value) : (s.blurb = e.target.value)))}
              placeholder="Add description…"
              style={{ width: '100%', minHeight: 60, border: 'none', outline: 'none', resize: 'vertical', font: "400 14px/1.6 'Libre Franklin'", color: '#2A3242', background: 'transparent', padding: 0, marginBottom: 22 }}
            />
            {itemView.isStream && (
              <>
                <div style={sectLabel}>SUBTASKS</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 5, marginBottom: 8 }}>
                  {itemView.subtasks.map((t: any) => (
                    <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '7px 10px', background: '#F6F7F9', borderRadius: 8 }}>
                      <button
                        onClick={() => mutItem((s) => {
                          const x = (s.subtasks || []).find((q: any) => q.id === t.id)
                          if (x) x.done = !x.done
                        })}
                        style={{ width: 18, height: 18, flex: 'none', borderRadius: 5, border: '1.5px solid ' + t.boxBorder, background: t.boxBg, color: '#fff', fontSize: 11, lineHeight: 1, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                      >
                        {t.check}
                      </button>
                      <span style={{ flex: 1, font: "500 13px 'Libre Franklin'", color: t.textColor, textDecoration: t.strike }}>{t.text}</span>
                      <button
                        onClick={() => mutItem((s) => {
                          const i = (s.subtasks || []).findIndex((q: any) => q.id === t.id)
                          if (i >= 0) s.subtasks.splice(i, 1)
                        })}
                        style={{ background: 'none', border: 'none', color: '#B7BEC9', cursor: 'pointer', fontSize: 15, lineHeight: 1 }}
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
                <input
                  onKeyDown={(e) => {
                    if (e.key !== 'Enter') return
                    const v = (e.currentTarget.value || '').trim()
                    if (!v) return
                    mutItem((s) => (s.subtasks = s.subtasks || []).push({ id: nid('sub'), text: v, done: false }))
                    e.currentTarget.value = ''
                  }}
                  placeholder="Add subtask…  (Enter)"
                  style={{ width: '100%', border: 'none', outline: 'none', background: '#F6F7F9', borderRadius: 8, padding: '10px 12px', font: "500 13px 'Libre Franklin'", color: '#2A3242', marginBottom: 22 }}
                />
                <div style={sectLabel}>COMMENTS</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 7, marginBottom: 8 }}>
                  {itemView.comments.map((c: any) => (
                    <div key={c.id} style={{ background: '#F6F7F9', borderRadius: 8, padding: '9px 12px' }}>
                      <div style={{ font: "500 13px/1.5 'Libre Franklin'", color: '#2A3242' }}>{c.text}</div>
                      <div style={{ font: "500 9.5px 'IBM Plex Mono',monospace", color: '#9AA3B2', marginTop: 3 }}>You · {c.when}</div>
                    </div>
                  ))}
                </div>
                <input
                  onKeyDown={(e) => {
                    if (e.key !== 'Enter') return
                    const v = (e.currentTarget.value || '').trim()
                    if (!v) return
                    mutItem((s) => (s.comments = s.comments || []).push({ id: nid('cm'), text: v, at: Date.now() }))
                    e.currentTarget.value = ''
                  }}
                  placeholder="Write a comment…  (Enter)"
                  style={{ width: '100%', border: 'none', outline: 'none', background: '#F6F7F9', borderRadius: 8, padding: '11px 12px', font: "500 13px 'Libre Franklin'", color: '#2A3242', marginBottom: 22 }}
                />
                <div style={sectLabel}>ACTIVITY</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                  {itemView.activity.map((a: any, i: number) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, font: "500 11.5px 'Libre Franklin'", color: '#6A7382' }}>
                      <span style={{ width: 18, height: 18, borderRadius: '50%', background: '#EEF1F4', flex: 'none' }} />
                      <span>{a.text}</span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>

          {/* RIGHT — properties */}
          <div style={{ width: 316, flex: 'none', borderLeft: '1px solid #ECEEF2', overflow: 'auto', padding: '18px 22px', position: 'relative' }}>
            <div style={sectLabel}>PROPERTIES</div>

            {itemView.isService && (
              <>
                <div style={propLabel}>Type</div>
                <select value={itemView.svcType} onChange={(e) => mutItem((s) => (s.type = e.target.value))} style={propSelect}>
                  {envSvcTypeOpts2.map((o) => (
                    <option key={o.v} value={o.v}>
                      {o.l}
                    </option>
                  ))}
                </select>
                <div style={propLabel}>Location</div>
                <select
                  value={itemView.contZid}
                  onChange={(e) => {
                    const toZid = e.target.value
                    setData((d) => envReparent(d, itemId, toZid))
                  }}
                  style={{ ...propSelect, marginBottom: 0 }}
                >
                  {envContOpts.map((o) => (
                    <option key={o.v} value={o.v}>
                      {o.l}
                    </option>
                  ))}
                </select>
              </>
            )}

            {itemView.isTodo && (
              <>
                <div style={propLabel}>Completed</div>
                <div style={{ display: 'inline-flex', background: '#F1F3F6', borderRadius: 9, padding: 3, marginBottom: 18 }}>
                  <button onClick={() => setTodoDone(setData, itemId, false)} style={itemView.incBtn}>✕</button>
                  <button onClick={() => setTodoDone(setData, itemId, true)} style={itemView.cmpBtn}>✓</button>
                </div>
                <div style={propLabel}>Priority</div>
                <select value={itemView.priority} onChange={(e) => mutItem((s) => (s.priority = e.target.value))} style={propSelect}>
                  {prOpts.map((o) => (
                    <option key={o.v} value={o.v}>{o.l}</option>
                  ))}
                </select>
                <div style={propLabel}>Source</div>
                <select value={itemView.source} onChange={(e) => mutItem((s) => (s.source = e.target.value))} style={propSelect}>
                  {todoSourceOpts.map((o) => (
                    <option key={o.v} value={o.v}>{o.l}</option>
                  ))}
                </select>
                <div style={propLabel}>Phase</div>
                <select value={itemView.phaseId} onChange={(e) => mutItem((s) => (s.phaseId = e.target.value))} style={propSelect}>
                  {phaseOpts.map((o) => (
                    <option key={o.v} value={o.v}>{o.l}</option>
                  ))}
                </select>
                <div style={propLabel}>Objective</div>
                <select value={itemView.objectiveId} onChange={(e) => mutItem((s) => (s.objectiveId = e.target.value))} style={propSelect}>
                  {objectiveOpts.map((o) => (
                    <option key={o.v} value={o.v}>{o.l}</option>
                  ))}
                </select>
                <div style={propLabel}>Vendor</div>
                <select value={itemView.ownerId} onChange={(e) => mutItem((s) => (s.ownerId = e.target.value))} style={propSelect}>
                  {ownerOpts.map((o) => (
                    <option key={o.v} value={o.v}>{o.l}</option>
                  ))}
                </select>
              </>
            )}

            {itemView.isStream && (
              <>
                <div style={propLabel}>Status</div>
                <select
                  value={itemView.status}
                  onChange={(e) => mutItem((s) => {
                    s.status = e.target.value as Status
                    s.completedAt = e.target.value === 'done' ? Date.now() : null
                  })}
                  style={propSelect}
                >
                  {statusOpts.map((o) => (
                    <option key={o.v} value={o.v}>{o.l}</option>
                  ))}
                </select>
                <div style={propLabel}>Phase</div>
                <select value={itemView.phaseId} onChange={(e) => mutItem((s) => (s.phaseId = e.target.value))} style={propSelect}>
                  {phaseOpts.map((o) => (
                    <option key={o.v} value={o.v}>{o.l}</option>
                  ))}
                </select>

                {/* Labels */}
                <div style={propLabel}>Labels</div>
                {itemView.hasLabels && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
                    {itemView.labels.map((l: any) => (
                      <span
                        key={l.id}
                        onClick={() => ui.set({ labelEdit: { id: l.id, name: l.name, color: l.color }, labelPickerOpen: false })}
                        style={{ font: "700 11px 'Libre Franklin'", color: '#fff', background: l.color, borderRadius: 7, padding: '4px 10px', cursor: 'pointer' }}
                      >
                        {l.name}
                      </span>
                    ))}
                  </div>
                )}
                <button
                  onClick={() => ui.update((s) => ({ labelPickerOpen: !s.labelPickerOpen, labelEdit: null }))}
                  style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', border: 'none', background: '#F1F3F6', borderRadius: 9, padding: '11px 12px', font: "600 13px 'Libre Franklin'", color: '#5A6473', cursor: 'pointer', marginBottom: 18 }}
                >
                  <span>Add labels…</span>
                  <span style={{ fontSize: 16, lineHeight: 1 }}>+</span>
                </button>
                {ui.labelPickerOpen && (
                  <div style={{ position: 'absolute', right: 22, top: 248, width: 268, background: '#fff', border: '1px solid #E4E8EE', borderRadius: 11, boxShadow: '0 16px 40px rgba(15,22,36,.22)', zIndex: 5, padding: '14px 14px 10px' }}>
                    <div style={{ ...sectLabel, marginBottom: 11 }}>LABELS</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 8 }}>
                      {labelPickerItems.map((l) => (
                        <div key={l.id} style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                          <button
                            onClick={() => toggleLabel(setData, itemId, l.id)}
                            style={{ width: 19, height: 19, flex: 'none', borderRadius: 5, border: '1.5px solid ' + l.boxBorder, background: l.boxBg, color: '#fff', fontSize: 12, lineHeight: 1, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                          >
                            {l.check}
                          </button>
                          <span onClick={() => toggleLabel(setData, itemId, l.id)} style={{ flex: 1, font: "700 12px 'Libre Franklin'", color: '#fff', background: l.color, borderRadius: 7, padding: '5px 10px', cursor: 'pointer' }}>
                            {l.name}
                          </span>
                        </div>
                      ))}
                    </div>
                    <button
                      onClick={() => ui.set({ labelEdit: { id: null, name: 'New Label', color: '#3FB6C2' }, labelPickerOpen: false })}
                      style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 9, border: 'none', background: 'none', borderRadius: 8, padding: '9px 6px', font: "600 13px 'Libre Franklin'", color: '#1B2330', cursor: 'pointer' }}
                    >
                      <span style={{ fontSize: 16, lineHeight: 1 }}>+</span> Create new label
                    </button>
                  </div>
                )}
                {labelEditView && (
                  <div style={{ position: 'absolute', right: 22, top: 248, width: 280, background: '#fff', border: '1px solid #E4E8EE', borderRadius: 11, boxShadow: '0 16px 40px rgba(15,22,36,.24)', zIndex: 6, padding: '15px 16px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                      <span style={{ font: "700 13px 'Libre Franklin'", color: '#1B2330' }}>Edit Label</span>
                      <button onClick={() => ui.set({ labelEdit: null })} style={{ background: 'none', border: 'none', color: '#9AA3B2', cursor: 'pointer', fontSize: 15, lineHeight: 1 }}>✕</button>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 14 }}>
                      <span style={{ font: "700 12px 'Libre Franklin'", color: '#fff', background: labelEditView.color, borderRadius: 8, padding: '5px 13px' }}>{labelEditView.name}</span>
                    </div>
                    <div style={{ font: "600 11px 'Libre Franklin'", color: '#5A6473', marginBottom: 6 }}>Name</div>
                    <input
                      value={labelEditView.name}
                      onChange={(e) => ui.update((s) => ({ labelEdit: { ...s.labelEdit!, name: e.target.value } }))}
                      style={{ width: '100%', border: 'none', background: '#F1F3F6', borderRadius: 8, padding: '10px 12px', font: "600 13px 'Libre Franklin'", color: '#1B2330', outline: 'none', marginBottom: 14 }}
                    />
                    <div style={{ font: "600 11px 'Libre Franklin'", color: '#5A6473', marginBottom: 8 }}>Color</div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6,1fr)', gap: 8, marginBottom: 16 }}>
                      {labelEditView.swatches.map((c) => (
                        <button
                          key={c.color}
                          onClick={() => ui.update((s) => ({ labelEdit: { ...s.labelEdit!, color: c.color } }))}
                          style={{ height: 30, borderRadius: 7, background: c.color, border: '2px solid ' + c.ring, cursor: 'pointer', color: '#fff', fontSize: 12, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                        >
                          {c.check}
                        </button>
                      ))}
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <button onClick={onLabelDelete} style={{ background: 'none', border: 'none', color: '#C2410C', font: "600 12px 'Libre Franklin'", cursor: 'pointer' }}>Delete</button>
                      <button onClick={onLabelSave} style={{ background: '#15202E', color: '#fff', border: 'none', borderRadius: 8, padding: '9px 20px', font: "700 12px 'Libre Franklin'", cursor: 'pointer' }}>Save</button>
                    </div>
                  </div>
                )}

                <div style={propLabel}>Objective</div>
                <select value={itemView.objectiveId} onChange={(e) => mutItem((s) => (s.objectiveId = e.target.value))} style={propSelect}>
                  {objectiveOpts.map((o) => (
                    <option key={o.v} value={o.v}>{o.l}</option>
                  ))}
                </select>
                <div style={propLabel}>Vendor</div>
                <select value={itemView.ownerId} onChange={(e) => mutItem((s) => (s.ownerId = e.target.value))} style={propSelect}>
                  {ownerOpts.map((o) => (
                    <option key={o.v} value={o.v}>{o.l}</option>
                  ))}
                </select>
                <div style={propLabel}>Work item type</div>
                <select value={itemView.workType} onChange={(e) => mutItem((s) => (s.workType = e.target.value))} style={propSelect}>
                  {itemWorkTypeOpts.map((o) => (
                    <option key={o.v} value={o.v}>{o.l}</option>
                  ))}
                </select>
                <div style={propLabel}>Group</div>
                <input value={itemView.group} onChange={(e) => mutItem((s) => (s.group = e.target.value))} placeholder="—" style={{ ...propSelect, cursor: 'text' }} />
                <div style={{ display: 'flex', gap: 10 }}>
                  <div style={{ flex: '0 0 96px' }}>
                    <div style={propLabel}>Code</div>
                    <input value={itemView.code} onChange={(e) => mutItem((s) => (s.code = e.target.value))} style={{ ...propSelect, cursor: 'text' }} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={propLabel}>Depends on</div>
                    <input
                      value={itemView.depsText}
                      onChange={(e) => mutItem((s) => (s.deps = e.target.value.split(',').map((x: string) => x.trim()).filter(Boolean)))}
                      placeholder="codes, comma-sep"
                      style={{ ...propSelect, cursor: 'text' }}
                    />
                  </div>
                </div>
              </>
            )}
          </div>
        </div>

        {/* footer */}
        <div style={{ borderTop: '1px solid #ECEEF2', padding: '14px 26px', display: 'flex', gap: 12, alignItems: 'center' }}>
          <button onClick={onArchive} style={{ display: 'flex', alignItems: 'center', gap: 8, border: '1px solid #E6A08F', color: '#C2410C', background: '#fff', borderRadius: 9, padding: '10px 18px', font: "600 13px 'Libre Franklin'", cursor: 'pointer' }}>
            ▣ Archive
          </button>
          {itemView.isStream && (() => {
            const raw = data.streams.find((x) => x.id === itemId)
            const url = raw ? planeUrl(data, raw) : undefined
            return url ? (
              <a href={url} target="_blank" rel="noopener" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 8, border: 'none', color: '#fff', background: '#1B2330', borderRadius: 9, padding: '10px 18px', font: "600 13px 'Libre Franklin'" }}>
                ↗ View in Plane
              </a>
            ) : (
              <span title="Not in Plane yet — push it from the Plane sync tab" style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#A6AEBA', background: '#EEF1F4', borderRadius: 9, padding: '10px 18px', font: "600 13px 'Libre Franklin'", cursor: 'not-allowed' }}>
                View in Plane
              </span>
            )
          })()}
        </div>
      </div>
    </div>
  )
}

// ---- helpers reused by handlers ----
function setTodoDone(setData: (m: (d: PmoData) => void) => void, id: string, done: boolean) {
  setData((d) => {
    const t = (d.todos || []).find((x: Todo) => x.id === id)
    if (t) {
      t.done = done
      t.completedAt = done ? Date.now() : null
    }
  })
}
function toggleLabel(setData: (m: (d: PmoData) => void) => void, id: string, lid: string) {
  setData((d) => {
    const s = d.streams.find((x) => x.id === id)
    if (!s) return
    s.labelIds = s.labelIds || []
    const i = s.labelIds.indexOf(lid)
    if (i >= 0) s.labelIds.splice(i, 1)
    else s.labelIds.push(lid)
  })
}
function envReparent(d: PmoData, sid: string, toZid: string) {
  const take = (arr: Service[]) => {
    const i = arr.findIndex((s) => s.id === sid)
    return i >= 0 ? arr.splice(i, 1)[0] : null
  }
  let svc = take(d.environment.extCloud.services)
  if (!svc) {
    for (const z of d.environment.zones) {
      svc = take(z.services)
      if (svc) break
    }
  }
  if (!svc) return
  if (toZid === 'ext') d.environment.extCloud.services.push(svc)
  else {
    const z = d.environment.zones.find((z) => z.id === toZid)
    ;(z ? z.services : d.environment.extCloud.services).push(svc)
  }
}
