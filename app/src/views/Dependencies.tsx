import { useRef, useState } from 'react'
import { useStore } from '../store/store'
import { useUI } from '../store/ui'
import { buildMaps, computeDeps, makePass } from '../lib/derive'
import { mix, nid } from '../data/helpers'
import type { PmoData, Stream } from '../data/types'

type Lens = 'functional' | 'logical' | 'delivery'
const NW = 222, NH = 104, GX = 104, GY = 30, PADX = 34, PADY = 58
const GRID = 24
const PAL = ['#4A6491', '#A8553F', '#3E7C6A', '#5B5391', '#B07D3C', '#2E7D52', '#5A6473', '#1E8A8A']

export function Dependencies() {
  const { data, setData } = useStore()
  const ui = useUI()
  const { ownerMap, enrich } = buildMaps(data)

  const [lens, setLens] = useState<Lens>('logical')
  const [zoom, setZoom] = useState(1)
  const [snap, setSnap] = useState(true)
  const [showGrid, setShowGrid] = useState(true)
  const [toolsMin, setToolsMin] = useState(false)
  const [palette, setPalette] = useState('#B07D3C')
  const [embellish, setEmbellish] = useState<'solid' | 'striped'>('solid')
  const [dragLive, setDragLive] = useState<{ id: string; x: number; y: number } | null>(null)
  const [noteLive, setNoteLive] = useState<{ id: string; x: number; y: number } | null>(null)

  const pass = makePass(ui)
  const fs = data.streams.filter(pass)
  const countLabel = fs.length + ' of ' + data.streams.length + ' streams'
  const { depthOf, crit } = computeDeps(fs)
  const codeMap: Record<string, Stream> = {}
  fs.forEach((s) => (codeMap[s.code] = s))
  const objById: Record<string, any> = {}
  ;(data.objectives || []).forEach((o) => (objById[o.id] = o))

  // lanes by lens
  let lanes: { key: string; label: string; color: string; members: Stream[]; x?: number }[] = []
  if (lens === 'functional') {
    const order: string[] = [], byG: Record<string, any> = {}
    fs.forEach((s) => {
      const o = objById[s.objectiveId || ''] || {}
      const k = s.objectiveId || '_'
      if (!byG[k]) {
        byG[k] = { key: k, label: (o.code ? o.code + ' · ' : '') + (o.name || 'Other'), color: o.color || '#7A8494', members: [] }
        order.push(k)
      }
      byG[k].members.push(s)
    })
    lanes = order.map((k) => byG[k])
  } else if (lens === 'delivery') {
    const order: string[] = [], byO: Record<string, any> = {}
    fs.forEach((s) => {
      const o = ownerMap[s.ownerId] || { name: 'Unassigned' }
      const k = s.ownerId || '_'
      if (!byO[k]) {
        byO[k] = { key: k, label: o.name, color: (o as any).color || '#7A8494', members: [] }
        order.push(k)
      }
      byO[k].members.push(s)
    })
    lanes = order.map((k) => byO[k])
  } else {
    const byT: Record<number, any> = {}, order: number[] = []
    fs.forEach((s) => {
      const lv = depthOf[s.code] || 0
      if (!byT[lv]) {
        byT[lv] = { key: 't' + lv, label: lv === 0 ? 'Independent' : 'Depends on tier ' + lv, color: '#5A6473', members: [] }
        order.push(lv)
      }
      byT[lv].members.push(s)
    })
    order.sort((a, b) => a - b)
    lanes = order.map((lv) => byT[lv])
  }
  const autoPos: Record<string, { x: number; y: number }> = {}
  lanes.forEach((ln, gi) => {
    const x = PADX + gi * (NW + GX)
    ln.x = x
    ln.members.forEach((s, j) => (autoPos[s.id] = { x, y: PADY + j * (NH + GY) }))
  })
  const posOf = (s: Stream) => {
    if (dragLive && dragLive.id === s.id) return { x: dragLive.x, y: dragLive.y }
    const pp = s.depPos && s.depPos[lens]
    if (pp && typeof pp.x === 'number') return { x: pp.x, y: pp.y }
    return autoPos[s.id] || { x: PADX, y: PADY }
  }
  const depNodes = fs.map((s) => {
    const e = enrich(s)
    const isC = !!crit[s.code]
    const p = posOf(s)
    const sel = ui.selectedId === s.id
    return {
      ...e,
      crit: isC,
      nx: p.x,
      ny: p.y,
      tf: `translate(${p.x}px,${p.y}px)`,
      depBorder: sel ? '2px solid ' + e.color : isC ? '2px solid #1B2330' : '1px solid #DCE1E8',
      critShadow: sel ? '0 8px 22px rgba(27,35,48,.18)' : isC ? '0 5px 16px rgba(27,35,48,.13)' : '0 1px 3px rgba(20,30,50,.09)',
    }
  })
  const posMap: Record<string, { x: number; y: number }> = {}
  depNodes.forEach((n) => (posMap[n.code] = { x: n.nx, y: n.ny }))
  const edges: { d: string; stroke: string; sw: number; dash: string }[] = []
  fs.forEach((s) => {
    ;(s.deps || []).forEach((c) => {
      if (!codeMap[c]) return
      const a = posMap[c], b = posMap[s.code]
      if (!a || !b) return
      const x1 = a.x + NW, y1 = a.y + NH / 2, x2 = b.x, y2 = b.y + NH / 2
      const mx = (x1 + x2) / 2
      const isC = lens === 'logical' && crit[c] && crit[s.code] && depthOf[c] === depthOf[s.code] - 1
      edges.push({ d: `M ${x1} ${y1} C ${mx} ${y1} ${mx} ${y2} ${x2} ${y2}`, stroke: isC ? '#1B2330' : '#C2C9D4', sw: isC ? 2.5 : 1.4, dash: isC ? '0' : '5 5' })
    })
  })
  const laneLabels = lanes.map((ln) => ({ label: ln.label, color: ln.color, tf: `translate(${ln.x}px,18px)` }))
  let mX = 620, mY = 440
  depNodes.forEach((n) => {
    mX = Math.max(mX, n.nx + NW)
    mY = Math.max(mY, n.ny + NH)
  })
  const canvasW = mX + PADX, canvasH = mY + PADY
  const worldW = Math.round(canvasW * zoom), worldH = Math.round(canvasH * zoom)
  const gridImg = showGrid ? 'radial-gradient(#E5E9EF 1px,transparent 1px)' : 'none'

  const notes = (data.depNotes || []).map((nt) => {
    const pp = noteLive && noteLive.id === nt.id ? noteLive : { x: nt.x, y: nt.y }
    const strp = nt.style === 'striped'
    const bg = strp
      ? `repeating-linear-gradient(45deg,${mix(nt.color, 0.7)},${mix(nt.color, 0.7)} 9px,${mix(nt.color, 0.88)} 9px,${mix(nt.color, 0.88)} 18px)`
      : mix(nt.color, 0.8)
    return { id: nt.id, text: nt.text || '', x: pp.x, y: pp.y, w: nt.w || 200, h: nt.h || 150, border: '1.5px solid ' + mix(nt.color, 0.42), bg }
  })

  // refs for drag bookkeeping
  const refs = useRef({ snap, zoom, lens, pos: posMap, nodePos: {} as Record<string, { x: number; y: number }>, notePos: {} as Record<string, { x: number; y: number }> })
  depNodes.forEach((n) => (refs.current.nodePos[n.id] = { x: n.nx, y: n.ny }))
  notes.forEach((n) => (refs.current.notePos[n.id] = { x: n.x, y: n.y }))
  refs.current.snap = snap
  refs.current.zoom = zoom
  refs.current.lens = lens

  const snapXY = (x: number, y: number) => (refs.current.snap ? { x: Math.round(x / GRID) * GRID, y: Math.round(y / GRID) * GRID } : { x, y })

  // node drag
  const dragRef = useRef<any>(null)
  const liveRef = useRef<typeof dragLive>(null)
  const onDown = (e: React.PointerEvent, id: string) => {
    const node = refs.current.nodePos[id] || { x: 0, y: 0 }
    dragRef.current = { id, moved: false, ox: e.clientX, oy: e.clientY, sx: node.x, sy: node.y, scale: refs.current.zoom }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    e.preventDefault()
  }
  const onMove = (e: PointerEvent) => {
    const g = dragRef.current
    if (!g) return
    const dx = (e.clientX - g.ox) / g.scale, dy = (e.clientY - g.oy) / g.scale
    if (!g.moved && (Math.abs(dx) > 3 || Math.abs(dy) > 3)) g.moved = true
    if (!g.moved) return
    const sn = snapXY(Math.max(0, g.sx + dx), Math.max(0, g.sy + dy))
    const live = { id: g.id, x: sn.x, y: sn.y }
    liveRef.current = live
    setDragLive(live)
  }
  const onUp = () => {
    const g = dragRef.current
    if (!g) return
    window.removeEventListener('pointermove', onMove)
    window.removeEventListener('pointerup', onUp)
    dragRef.current = null
    const live = liveRef.current
    if (!g.moved) {
      setDragLive(null)
      ui.set({ selectedId: g.id, itemId: g.id, itemKind: 'stream' })
      return
    }
    setDragLive(null)
    liveRef.current = null
    if (live) {
      const lns = refs.current.lens
      setData((d: PmoData) => {
        const s = d.streams.find((x) => x.id === g.id)
        if (s) {
          if (!s.depPos) s.depPos = {}
          s.depPos[lns] = { x: Math.round(live.x), y: Math.round(live.y) }
        }
      })
    }
  }

  // note drag
  const ndRef = useRef<any>(null)
  const nLiveRef = useRef<typeof noteLive>(null)
  const onNoteDown = (e: React.PointerEvent, id: string) => {
    const n = refs.current.notePos[id] || { x: 0, y: 0 }
    ndRef.current = { id, ox: e.clientX, oy: e.clientY, sx: n.x, sy: n.y, scale: refs.current.zoom }
    window.addEventListener('pointermove', onNoteMove)
    window.addEventListener('pointerup', onNoteUp)
    e.preventDefault()
  }
  const onNoteMove = (e: PointerEvent) => {
    const g = ndRef.current
    if (!g) return
    let nx = Math.max(0, g.sx + (e.clientX - g.ox) / g.scale), ny = Math.max(0, g.sy + (e.clientY - g.oy) / g.scale)
    if (refs.current.snap) {
      nx = Math.round(nx / GRID) * GRID
      ny = Math.round(ny / GRID) * GRID
    }
    const live = { id: g.id, x: nx, y: ny }
    nLiveRef.current = live
    setNoteLive(live)
  }
  const onNoteUp = () => {
    const g = ndRef.current
    if (!g) return
    window.removeEventListener('pointermove', onNoteMove)
    window.removeEventListener('pointerup', onNoteUp)
    ndRef.current = null
    const live = nLiveRef.current
    setNoteLive(null)
    nLiveRef.current = null
    if (live)
      setData((d) => {
        const n = (d.depNotes || []).find((x) => x.id === g.id)
        if (n) {
          n.x = Math.round(live.x)
          n.y = Math.round(live.y)
        }
      })
  }

  const addNote = () =>
    setData((d) => (d.depNotes = d.depNotes || []).push({ id: nid('dnote'), text: '', color: palette, style: embellish, x: 60, y: 60, w: 200, h: 150 }))
  const autoArrange = () =>
    setData((d) => d.streams.forEach((s) => s.depPos && s.depPos[lens] && delete s.depPos[lens]))

  const lensMeta = {
    functional: { title: 'Functional view', plain: 'what the program delivers, grouped by business outcome.', why: 'Best for explaining scope to clinic leaders and sponsors — it answers “what are we actually building?” without the technical sequencing.' },
    logical: { title: 'Logical view', plain: 'how the pieces depend on each other, left → right.', why: 'Surfaces the critical path — the chain of work that sets the finish date. Use it to see what blocks what and where a slip cascades.' },
    delivery: { title: 'Delivery view', plain: 'who owns each piece of work.', why: 'Shows how the build is split across the vendors — useful for balancing load and pinning accountability for each stream.' },
  }[lens]

  const toolBtn = (on: boolean): React.CSSProperties => ({
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    border: '1px solid ' + (on ? '#BFE0CF' : '#D5DBE3'), background: on ? '#E4EEE9' : '#fff', color: on ? '#2F6B53' : '#5A6473',
    borderRadius: 6, padding: '7px 10px', font: "600 11px 'Libre Franklin'", cursor: 'pointer',
  })

  return (
    <div style={{ maxWidth: 1640, margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 16 }}>
        <div>
          <div style={{ font: "700 19px 'Libre Franklin'", color: '#1B2330' }}>Dependency map</div>
          <div style={{ font: "400 12.5px 'Libre Franklin'", color: '#7A8494', marginTop: 2 }}>Drag any card to rearrange · pick a lens to see the same work three ways</div>
        </div>
        <div style={{ display: 'flex', gap: 2, background: '#E7EBF1', borderRadius: 8, padding: 3 }}>
          {(['functional', 'logical', 'delivery'] as Lens[]).map((t) => (
            <button
              key={t}
              onClick={() => { setLens(t); setDragLive(null) }}
              style={{ border: 'none', borderRadius: 6, padding: '7px 14px', font: "600 12px 'Libre Franklin'", cursor: 'pointer', textTransform: 'capitalize', ...(lens === t ? { background: '#1B2330', color: '#fff', boxShadow: '0 1px 3px rgba(0,0,0,.2)' } : { background: 'transparent', color: '#7A8494' }) }}
            >
              {t}
            </button>
          ))}
        </div>
      </div>
      <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start', background: '#F8FAFC', border: '1px solid #E7EBF1', borderLeft: '3px solid #1B2330', borderRadius: 5, padding: '12px 15px', marginBottom: 14 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ font: "700 13px 'Libre Franklin'", color: '#1B2330', marginBottom: 3 }}>{lensMeta.title} — {lensMeta.plain}</div>
          <div style={{ font: "400 12px/1.5 'Libre Franklin'", color: '#5A6473' }}>{lensMeta.why}</div>
        </div>
        <div style={{ font: "500 11px 'IBM Plex Mono',monospace", color: '#9AA3B2', flex: 'none', whiteSpace: 'nowrap' }}>{countLabel}</div>
      </div>

      <div style={{ position: 'relative' }}>
        <div style={{ background: '#fff', border: '1px solid #E4E8EE', borderRadius: 5, boxShadow: '0 1px 2px rgba(20,30,50,.05)', overflow: 'auto', height: 600 }}>
          <div style={{ position: 'relative', width: worldW, height: worldH, minWidth: '100%', minHeight: '100%' }}>
            <div style={{ position: 'absolute', left: 0, top: 0, width: canvasW, height: canvasH, transformOrigin: '0 0', transform: `scale(${zoom})`, backgroundColor: '#FCFDFE', backgroundImage: gridImg, backgroundSize: '24px 24px' }}>
              <svg width={canvasW} height={canvasH} style={{ position: 'absolute', left: 0, top: 0, pointerEvents: 'none', overflow: 'visible' }}>
                {edges.map((e, i) => (
                  <path key={i} d={e.d} fill="none" stroke={e.stroke} strokeWidth={e.sw} strokeDasharray={e.dash} strokeLinecap="round" />
                ))}
              </svg>
              {laneLabels.map((L, i) => (
                <div key={i} style={{ position: 'absolute', left: 0, top: 0, width: 222, transform: L.tf, font: "700 9.5px 'IBM Plex Mono',monospace", color: '#fff', background: L.color, borderRadius: 5, padding: '4px 9px', letterSpacing: '.04em', textTransform: 'uppercase', pointerEvents: 'none', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {L.label}
                </div>
              ))}
              {depNodes.map((s) => (
                <div
                  key={s.id}
                  onPointerDown={(e) => onDown(e, s.id)}
                  style={{ position: 'absolute', left: 0, top: 0, width: 222, transform: s.tf, background: s.cardBg, border: s.depBorder, borderLeft: '4px solid ' + s.color, borderRadius: 4, padding: '9px 11px', cursor: 'grab', boxShadow: s.critShadow, touchAction: 'none', userSelect: 'none' }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 6, pointerEvents: 'none' }}>
                    <span style={{ font: "600 12.5px 'Libre Franklin'", color: '#1B2330', lineHeight: 1.2 }}>{s.name}</span>
                    <span style={{ font: "500 9px 'IBM Plex Mono',monospace", color: '#A6AEBA', flex: 'none' }}>{s.code}</span>
                  </div>
                  <div style={{ display: 'flex', gap: 5, alignItems: 'center', marginTop: 6, flexWrap: 'wrap', pointerEvents: 'none' }}>
                    <span style={{ font: "600 8.5px 'IBM Plex Mono',monospace", padding: '2px 7px', borderRadius: 10, background: s.pillBg, color: s.pillColor }}>{s.pillText}</span>
                    <span style={{ font: "600 8.5px 'IBM Plex Mono',monospace", padding: '2px 7px', borderRadius: 10, background: '#EEF1F4', color: '#5A6473' }}>{s.ownerName}</span>
                    {s.crit && <span style={{ font: "600 8px 'IBM Plex Mono',monospace", padding: '2px 6px', borderRadius: 9, background: '#1B2330', color: '#fff' }}>CRITICAL</span>}
                  </div>
                  {s.depsText && <div style={{ font: "400 9.5px/1.35 'Libre Franklin'", color: '#7A8494', marginTop: 6, pointerEvents: 'none' }}>▸ needs {s.depsText}</div>}
                </div>
              ))}
              {notes.map((nt) => (
                <div key={nt.id} onPointerDown={(e) => onNoteDown(e, nt.id)} style={{ position: 'absolute', left: 0, top: 0, transform: `translate(${nt.x}px,${nt.y}px)`, width: nt.w, height: nt.h, padding: 0, borderRadius: 4, boxShadow: '0 3px 10px rgba(20,30,50,.16)', cursor: 'grab', border: nt.border, background: nt.bg, touchAction: 'none', userSelect: 'none' }}>
                  <div style={{ height: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'grab' }}>
                    <div style={{ width: 26, height: 3, borderRadius: 2, background: 'rgba(0,0,0,.2)' }} />
                  </div>
                  <button onClick={() => setData((d) => { const i = (d.depNotes || []).findIndex((x) => x.id === nt.id); if (i >= 0) d.depNotes!.splice(i, 1) })} onPointerDown={(e) => e.stopPropagation()} style={{ position: 'absolute', top: 3, right: 6, background: 'none', border: 'none', color: 'rgba(0,0,0,.4)', cursor: 'pointer', fontSize: 12, lineHeight: 1 }}>✕</button>
                  <textarea value={nt.text} onChange={(e) => setData((d) => { const n = (d.depNotes || []).find((x) => x.id === nt.id); if (n) n.text = e.target.value })} onPointerDown={(e) => e.stopPropagation()} placeholder="Type a note…" style={{ width: '100%', height: 'calc(100% - 16px)', border: 'none', background: 'transparent', outline: 'none', resize: 'none', padding: '2px 12px 10px', font: "600 13px/1.45 'Libre Franklin'", color: '#2A2418', boxSizing: 'border-box' }} />
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* tools window */}
        <div style={{ position: 'absolute', top: 14, right: 14, width: 190, background: '#fff', border: '1px solid #DCE1E8', borderRadius: 8, boxShadow: '0 8px 24px rgba(20,30,50,.16)', zIndex: 6, overflow: 'hidden' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#1B2330', color: '#fff', padding: '7px 11px' }}>
            <span style={{ font: "700 10px 'IBM Plex Mono',monospace", letterSpacing: '.1em' }}>TOOLS</span>
            <span style={{ font: "500 9px 'IBM Plex Mono',monospace", color: '#9AA9BD' }}>{Math.round(zoom * 100)}%</span>
            <button onClick={() => setToolsMin((v) => !v)} title="Minimize" style={{ background: 'rgba(255,255,255,.14)', border: 'none', color: '#fff', borderRadius: 4, width: 18, height: 18, fontSize: 13, lineHeight: 1, cursor: 'pointer', marginLeft: 8 }}>{toolsMin ? '+' : '−'}</button>
          </div>
          {!toolsMin && (
            <div style={{ padding: '10px 11px', display: 'flex', flexDirection: 'column', gap: 9 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ font: "600 11px 'Libre Franklin'", color: '#5A6473' }}>Zoom</span>
                <div style={{ display: 'flex', gap: 4 }}>
                  <button onClick={() => setZoom((z) => Math.max(0.5, Math.round((z - 0.1) * 100) / 100))} className="mini-btn" style={{ width: 28, padding: '4px 0', justifyContent: 'center' }}>−</button>
                  <button onClick={() => setZoom(1)} className="mini-btn" style={{ padding: '4px 8px' }}>Fit</button>
                  <button onClick={() => setZoom((z) => Math.min(1.6, Math.round((z + 0.1) * 100) / 100))} className="mini-btn" style={{ width: 28, padding: '4px 0', justifyContent: 'center' }}>+</button>
                </div>
              </div>
              <button onClick={() => setSnap((v) => !v)} style={toolBtn(snap)}><span>Snap to grid</span><span style={{ font: "700 9px 'IBM Plex Mono',monospace" }}>{snap ? 'ON' : 'OFF'}</span></button>
              <button onClick={() => setShowGrid((v) => !v)} style={toolBtn(showGrid)}><span>Show grid</span><span style={{ font: "700 9px 'IBM Plex Mono',monospace" }}>{showGrid ? 'ON' : 'OFF'}</span></button>
              <button onClick={autoArrange} className="mini-btn" style={{ justifyContent: 'center' }}>⤢ Auto-arrange</button>
              <div style={{ borderTop: '1px solid #EDF0F4', marginTop: 1, paddingTop: 9, display: 'flex', flexDirection: 'column', gap: 7 }}>
                <button onClick={addNote} className="mini-btn" style={{ justifyContent: 'flex-start' }}>+ Sticky note</button>
                <span style={{ font: "700 8.5px 'IBM Plex Mono',monospace", color: '#9AA3B2', letterSpacing: '.09em' }}>PALETTE</span>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                  {PAL.map((c) => (
                    <button key={c} onClick={() => setPalette(c)} style={{ width: 22, height: 22, borderRadius: 5, background: c, border: '2px solid ' + (c === palette ? '#1B2330' : 'transparent'), cursor: 'pointer' }} />
                  ))}
                </div>
                <div style={{ display: 'flex', gap: 5 }}>
                  {(['solid', 'striped'] as const).map((e) => (
                    <button key={e} onClick={() => setEmbellish(e)} style={{ flex: 1, borderRadius: 6, padding: 6, font: "600 10.5px 'Libre Franklin'", cursor: 'pointer', textTransform: 'capitalize', border: '1px solid ' + (embellish === e ? '#1B2330' : '#D5DBE3'), background: embellish === e ? '#1B2330' : '#fff', color: embellish === e ? '#fff' : '#5A6473' }}>{e}</button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
      <div style={{ display: 'flex', gap: 18, marginTop: 14, font: "400 11.5px 'Libre Franklin'", color: '#5A6473', alignItems: 'center', flexWrap: 'wrap' }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7 }}><span style={{ width: 24, borderTop: '2px solid #1B2330' }} /> critical path</span>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7 }}><span style={{ width: 24, borderTop: '2px dashed #B9C2CE' }} /> dependency link</span>
        <span style={{ color: '#8A93A2' }}>Drag cards to lay it out your way · click a card for detail · Auto-arrange resets this lens.</span>
      </div>
    </div>
  )
}
