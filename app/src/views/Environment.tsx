import { useRef, useState } from 'react'
import { useStore } from '../store/store'
import { useUI } from '../store/ui'
import { mix, nid } from '../data/helpers'
import type { PmoData, Service } from '../data/types'

const ECW = 210, ECH = 78, EGAP = 14, EPAD = 14, EHEAD = 40, EFW = 940, GRID = 24
const PAL = ['#4A6491', '#A8553F', '#3E7C6A', '#5B5391', '#B07D3C', '#2E7D52', '#5A6473', '#1E8A8A']
const zoneAccents = ['#4A6491', '#A8553F', '#3E7C6A', '#5B5391', '#B07D3C']

interface NodeT {
  id: string
  kind: string
  x: number
  y: number
  w: number
  h?: number
  [k: string]: any
}

function reparent(d: PmoData, sid: string, toZid: string) {
  const take = (arr: Service[]) => {
    const i = arr.findIndex((s) => s.id === sid)
    return i >= 0 ? arr.splice(i, 1)[0] : null
  }
  let svc = take(d.environment.extCloud.services)
  if (!svc) for (const z of d.environment.zones) { svc = take(z.services); if (svc) break }
  if (!svc) return
  if (toZid === 'ext') d.environment.extCloud.services.push(svc)
  else { const z = d.environment.zones.find((z) => z.id === toZid); (z ? z.services : d.environment.extCloud.services).push(svc) }
}

export function EnvironmentView() {
  const { data, setData } = useStore()
  const ui = useUI()
  const env = data.environment

  const [zoom, setZoom] = useState(1)
  const [snap, setSnap] = useState(true)
  const [showGrid, setShowGrid] = useState(true)
  const [toolsMin, setToolsMin] = useState(false)
  const [palette, setPalette] = useState('#B07D3C')
  const [embellish, setEmbellish] = useState<'solid' | 'striped'>('solid')
  const [live, setLive] = useState<{ id: string; x: number; y: number } | null>(null)
  const [sizeLive, setSizeLive] = useState<{ id: string; w: number; h: number } | null>(null)
  const [hoverCid, setHoverCid] = useState<string | null>(null)

  const ePos = env.canvasPos || {}, eSize = env.canvasSize || {}, eLock = env.fwLocked || {}
  const stMap: Record<string, any> = {}
  env.svcTypes.forEach((t) => (stMap[t.id] = t))
  const tagOf = (type: string) => {
    const t = stMap[type] || { color: '#888', short: '?' }
    return { tagColor: t.color, tagBg: mix(t.color, 0.86), tagLabel: t.short }
  }
  const abesEnt = env.entities.find((e) => /abes/i.test(e.name)) || env.entities[0] || ({ name: 'ABES', role: '' } as any)
  const envAbes = { name: abesEnt.name, role: abesEnt.role, apps: (env.abesApps || []).map((a, i) => ({ label: a, bg: i === 0 ? '#F1DBD3' : '#EEF1F4', color: i === 0 ? '#8A4634' : '#5A6473' })) }
  const envRoadmap = data.phases.map((p) => ({ n: p.n, name: p.name }))
  const envEntities = env.entities.map((e) => ({ color: e.color, name: e.name, role: e.role }))
  const envSvcTypes = env.svcTypes.map((t) => ({ color: t.color, name: t.label, role: t.desc }))

  const ePosOf = (id: string, dx: number, dy: number) =>
    live && live.id === id ? { x: live.x, y: live.y } : ePos[id] && typeof ePos[id].x === 'number' ? { x: ePos[id].x, y: ePos[id].y } : { x: dx, y: dy }
  const sizeOf = (id: string, dw: number, dh?: number) => {
    const s = sizeLive && sizeLive.id === id ? sizeLive : eSize[id]
    return { w: s && typeof s.w === 'number' ? s.w : dw, h: s && typeof (s as any).h === 'number' ? (s as any).h : (dh as number) }
  }
  const colsFor = (w: number) => Math.max(1, Math.floor((w - 2 * EPAD + EGAP) / (ECW + EGAP)))
  const contHOf = (n: number, w: number) => EHEAD + Math.max(1, Math.ceil((n || 1) / colsFor(w))) * (ECH + EGAP) + EPAD - EGAP

  const conts: any[] = [{ cid: 'cont_ext', zid: 'ext', title: env.extCloud.title, accent: '#B07D3C', services: env.extCloud.services, dx: 540, dy: 24, dw: 560 }]
  env.zones.forEach((z, zi) =>
    conts.push({ cid: 'cont_' + z.id, zid: z.id, title: z.name, badge: z.badge, badgeBg: /phi/i.test(z.badge) ? '#F1DBD3' : '#EEF1F4', badgeColor: /phi/i.test(z.badge) ? '#A8553F' : '#8A93A2', accent: zoneAccents[(zi + 1) % zoneAccents.length], services: z.services, fwAbove: z.fwAbove, dw: 940 }),
  )
  const extC = conts[0]
  extC._w = sizeOf('cont_ext', extC.dw).w
  extC._h = sizeOf('cont_ext', extC.dw, contHOf(extC.services.length, extC._w)).h
  const topB = Math.max(24 + extC._h, 24 + 236, 24 + 128)
  let cy = topB + 30
  const fwRaw: any[] = [{ id: 'fw_wan', label: env.wanFw, dx: 248, dy: cy }]
  cy += 56
  for (let zi = 0; zi < env.zones.length; zi++) {
    const z = env.zones[zi]
    if (z.fwAbove) { fwRaw.push({ id: 'fw_' + z.id, label: z.fwAbove, dx: 248, dy: cy }); cy += 56 }
    const c = conts[zi + 1]
    c.dx = 248; c.dy = cy
    c._w = sizeOf(c.cid, c.dw).w
    c._h = sizeOf(c.cid, c.dw, contHOf(c.services.length, c._w)).h
    cy += c._h + 24
  }
  ;(env.extraFw || []).forEach((f) => fwRaw.push({ id: f.id, label: f.label, dx: 264, dy: 72 }))

  const containerNodes: NodeT[] = [], cardNodes: NodeT[] = [], otherNodes: NodeT[] = [], fwNodes: NodeT[] = [], contRects: any[] = []
  conts.forEach((c) => {
    const cp = ePosOf(c.cid, c.dx, c.dy)
    contRects.push({ cid: c.cid, zid: c.zid, x: cp.x, y: cp.y, w: c._w, h: c._h })
    containerNodes.push({ id: c.cid, kind: 'container', x: cp.x, y: cp.y, w: c._w, h: c._h, title: c.title, badge: c.badge || '', badgeBg: c.badgeBg || '#EEF1F4', badgeColor: c.badgeColor || '#8A93A2', accent: c.accent, hov: hoverCid === c.cid, resizeH: true })
    const cols = colsFor(c._w)
    c.services.forEach((s: Service, j: number) => {
      const col = j % cols, row = Math.floor(j / cols)
      const dxp = cp.x + EPAD + col * (ECW + EGAP), dyp = cp.y + EHEAD + row * (ECH + EGAP)
      const cid = 'card_' + s.id
      const sz = sizeOf(cid, ECW)
      const pp = ePosOf(cid, dxp, dyp)
      const tg = c.zid === 'ext' ? { tagBg: mix('#B07D3C', 0.86), tagColor: '#8A6320', tagLabel: 'CLOUD' } : tagOf(s.type)
      cardNodes.push({ id: cid, kind: 'card', sid: s.id, parentZid: c.zid, x: pp.x, y: pp.y, w: sz.w, name: s.name, note: s.note, accent: tg.tagColor, tagBg: tg.tagBg, tagColor: tg.tagColor, tagLabel: tg.tagLabel })
    })
  })
  { const rp = ePosOf('roadmap', 24, 24), rs = sizeOf('roadmap', 200); otherNodes.push({ id: 'roadmap', kind: 'roadmap', x: rp.x, y: rp.y, w: rs.w, phases: envRoadmap }) }
  { const ap = ePosOf('abes', 248, 24), as = sizeOf('abes', 300); otherNodes.push({ id: 'abes', kind: 'abes', x: ap.x, y: ap.y, w: as.w, name: envAbes.name, role: envAbes.role, apps: envAbes.apps }) }
  const epx = 248 + 940 + 28
  const panelDefs = [
    { id: 'panel_ent', title: 'Entities & responsibilities', rows: envEntities, text: '' },
    { id: 'panel_svc', title: 'Service types', rows: envSvcTypes, text: '' },
    { id: 'panel_host', title: 'Where the servers live', rows: [] as any[], text: env.hosting },
  ]
  let ppy = 24
  panelDefs.forEach((pd) => {
    const pp = ePosOf(pd.id, epx, ppy), ps = sizeOf(pd.id, 250)
    otherNodes.push({ kind: 'panel', x: pp.x, y: pp.y, w: ps.w, ...pd } as NodeT)
    ppy += 70 + pd.rows.length * 52 + (pd.text ? 80 : 0)
  })
  fwRaw.forEach((f) => {
    const fp = ePosOf(f.id, f.dx, f.dy), fs = sizeOf(f.id, EFW)
    const locked = !!eLock[f.id]
    fwNodes.push({ id: f.id, kind: 'firewall', x: fp.x, y: fp.y, w: fs.w, label: f.label, locked, lockIcon: locked ? '● LOCKED' : 'LOCK' })
  })
  const noteNodes: NodeT[] = (env.notes || []).map((nt) => {
    const np = ePosOf(nt.id, 120, 120), ns = sizeOf(nt.id, 200, 150)
    return { id: nt.id, kind: 'note', x: np.x, y: np.y, w: ns.w, h: ns.h, text: nt.text || '', noteColor: nt.color || '#B07D3C', noteStyle: nt.style || 'solid' }
  })

  const envNodes: NodeT[] = [...containerNodes, ...fwNodes, ...noteNodes, ...otherNodes, ...cardNodes].map((n): NodeT => {
    const locked = !!n.locked
    let box: React.CSSProperties
    if (n.kind === 'container') box = { height: n.h, padding: '10px 13px', background: n.hov ? '#E7F1EA' : '#F1F4F8', border: '1.5px solid ' + (n.hov ? '#3E7C6A' : '#D3DBE6'), borderTop: '3px solid ' + n.accent, borderRadius: 7, boxShadow: '0 1px 3px rgba(20,30,50,.07)', cursor: 'grab' }
    else if (n.kind === 'firewall') box = { background: 'repeating-linear-gradient(45deg,#F3DED7,#F3DED7 9px,#FBF1ED 9px,#FBF1ED 18px)', border: '1px solid ' + (locked ? '#C0826F' : '#E2C2B8'), borderRadius: 4, padding: '9px 12px', boxShadow: '0 1px 3px rgba(20,30,50,.08)', cursor: locked ? 'default' : 'grab' }
    else if (n.kind === 'abes') box = { background: '#FCF7F5', border: '2px solid #A8553F', borderRadius: 6, padding: '12px 14px', boxShadow: '0 2px 8px rgba(20,30,50,.1)', cursor: 'grab' }
    else if (n.kind === 'roadmap') box = { background: '#F6F8FB', border: '1px solid #DCE2EA', borderRadius: 6, padding: '12px 13px', boxShadow: '0 1px 3px rgba(20,30,50,.08)', cursor: 'grab' }
    else if (n.kind === 'panel') box = { background: '#fff', border: '1px solid #E7E9EE', borderRadius: 6, padding: '12px 13px', boxShadow: '0 1px 3px rgba(20,30,50,.08)', cursor: 'grab' }
    else if (n.kind === 'note') { const strp = n.noteStyle === 'striped'; box = { height: n.h, padding: 0, borderRadius: 4, boxShadow: '0 3px 10px rgba(20,30,50,.16)', cursor: 'grab', border: '1.5px solid ' + mix(n.noteColor, 0.42), background: strp ? `repeating-linear-gradient(45deg,${mix(n.noteColor, 0.7)},${mix(n.noteColor, 0.7)} 9px,${mix(n.noteColor, 0.88)} 9px,${mix(n.noteColor, 0.88)} 18px)` : mix(n.noteColor, 0.8) } }
    else box = { background: '#fff', border: '1px solid #E7E9EE', borderLeft: '3px solid ' + (n.accent || '#888'), borderRadius: 4, padding: '8px 10px', boxShadow: '0 2px 6px rgba(20,30,50,.1)', cursor: 'grab' }
    return { ...n, box, resizeH: n.resizeH || n.kind === 'note', resizable: n.kind !== 'firewall', rzCursor: n.resizeH || n.kind === 'note' ? 'nwse-resize' : 'ew-resize', locked }
  })

  // refs for drag bookkeeping
  const refs = useRef({ snap, zoom, pos: {} as Record<string, { x: number; y: number }>, sizes: {} as Record<string, { w: number; h: number; rh: boolean }>, cardParent: {} as Record<string, string>, containers: contRects, locked: eLock })
  refs.current.snap = snap; refs.current.zoom = zoom; refs.current.containers = contRects; refs.current.locked = eLock
  refs.current.pos = {}; refs.current.sizes = {}; refs.current.cardParent = {}
  envNodes.forEach((n) => { refs.current.pos[n.id] = { x: n.x, y: n.y }; refs.current.sizes[n.id] = { w: n.w, h: n.h || 0, rh: !!n.resizeH }; if (n.kind === 'card') refs.current.cardParent[n.id] = n.parentZid })

  let eMX = 980, eMY = 560
  envNodes.forEach((n) => { const h = n.h || (n.kind === 'panel' ? 180 : n.kind === 'roadmap' ? 236 : n.kind === 'abes' ? 128 : n.kind === 'card' ? ECH : 46); eMX = Math.max(eMX, n.x + n.w); eMY = Math.max(eMY, n.y + h) })
  const canvasW = eMX + 50, canvasH = eMY + 50
  const worldW = Math.round(canvasW * zoom), worldH = Math.round(canvasH * zoom)
  const gridImg = showGrid ? 'radial-gradient(#E5E9EF 1px,transparent 1px)' : 'none'

  // drag
  const dragRef = useRef<any>(null), liveRef = useRef(live)
  const snapXY = (x: number, y: number) => (refs.current.snap ? { x: Math.round(x / GRID) * GRID, y: Math.round(y / GRID) * GRID } : { x, y })
  const onDown = (e: React.PointerEvent, id: string) => {
    if (refs.current.locked[id]) return
    const node = refs.current.pos[id] || { x: 0, y: 0 }
    const sz = refs.current.sizes[id] || { w: 210 }
    dragRef.current = { id, isCard: id.indexOf('card_') === 0, w: sz.w, moved: false, ox: e.clientX, oy: e.clientY, sx: node.x, sy: node.y, scale: refs.current.zoom }
    window.addEventListener('pointermove', onMove); window.addEventListener('pointerup', onUp); e.preventDefault()
  }
  const onMove = (e: PointerEvent) => {
    const dg = dragRef.current; if (!dg) return
    const dx = (e.clientX - dg.ox) / dg.scale, dy = (e.clientY - dg.oy) / dg.scale
    if (!dg.moved && (Math.abs(dx) > 3 || Math.abs(dy) > 3)) dg.moved = true
    if (!dg.moved) return
    const sn = snapXY(Math.max(0, dg.sx + dx), Math.max(0, dg.sy + dy))
    let hover: string | null = null
    if (dg.isCard) { const cx = sn.x + (dg.w || 210) / 2, cyy = sn.y + 39; refs.current.containers.forEach((c) => { if (cx >= c.x && cx <= c.x + c.w && cyy >= c.y && cyy <= c.y + c.h) hover = c.cid }) }
    const lv = { id: dg.id, x: sn.x, y: sn.y }; liveRef.current = lv; setLive(lv); setHoverCid(hover)
  }
  const onUp = () => {
    const dg = dragRef.current; if (!dg) return
    window.removeEventListener('pointermove', onMove); window.removeEventListener('pointerup', onUp); dragRef.current = null
    const lv = liveRef.current; setLive(null); setHoverCid(null); liveRef.current = null
    if (!(dg.moved && lv)) return
    let toZid: string | null = null
    if (dg.isCard) { const cx = lv.x + (dg.w || 210) / 2, cyy = lv.y + 39; refs.current.containers.forEach((c) => { if (cx >= c.x && cx <= c.x + c.w && cyy >= c.y && cyy <= c.y + c.h) toZid = c.zid }) }
    const sid = dg.isCard ? dg.id.slice(5) : null
    const fromZid = refs.current.cardParent[dg.id]
    setData((d) => {
      if (!d.environment.canvasPos) d.environment.canvasPos = {}
      d.environment.canvasPos[dg.id] = { x: Math.round(lv.x), y: Math.round(lv.y) }
      if (dg.isCard && toZid && toZid !== fromZid && sid) reparent(d, sid, toZid)
    })
  }
  // resize
  const rzRef = useRef<any>(null), szLiveRef = useRef(sizeLive)
  const onResizeDown = (e: React.PointerEvent, id: string) => {
    e.stopPropagation()
    const s = refs.current.sizes[id] || { w: 200, h: 0, rh: false }
    rzRef.current = { id, ox: e.clientX, oy: e.clientY, ow: s.w, oh: s.h, rh: s.rh, scale: refs.current.zoom }
    window.addEventListener('pointermove', onResizeMove); window.addEventListener('pointerup', onResizeUp); e.preventDefault()
  }
  const onResizeMove = (e: PointerEvent) => {
    const rz = rzRef.current; if (!rz) return
    let w = Math.max(140, rz.ow + (e.clientX - rz.ox) / rz.scale)
    let h = rz.rh ? Math.max(72, rz.oh + (e.clientY - rz.oy) / rz.scale) : rz.oh
    if (refs.current.snap) { w = Math.round(w / GRID) * GRID; if (rz.rh) h = Math.round(h / GRID) * GRID }
    const lv = { id: rz.id, w, h }; szLiveRef.current = lv; setSizeLive(lv)
  }
  const onResizeUp = () => {
    const rz = rzRef.current; if (!rz) return
    window.removeEventListener('pointermove', onResizeMove); window.removeEventListener('pointerup', onResizeUp); rzRef.current = null
    const lv = szLiveRef.current; setSizeLive(null); szLiveRef.current = null
    if (lv) setData((d) => { if (!d.environment.canvasSize) d.environment.canvasSize = {}; d.environment.canvasSize[lv.id] = rz.rh ? { w: Math.round(lv.w), h: Math.round(lv.h) } : { w: Math.round(lv.w) } })
  }

  const toggleLock = (e: React.MouseEvent, id: string) => {
    e.stopPropagation()
    setData((d) => { if (!d.environment.fwLocked) d.environment.fwLocked = {}; d.environment.fwLocked[id] = !d.environment.fwLocked[id] })
  }
  const openCard = (id: string) => { if (id.indexOf('card_') === 0) ui.set({ itemId: id.slice(5), itemKind: 'service' }) }

  const addCard = () => setData((d) => { const ty = (d.environment.svcTypes[0] || ({} as any)).id || 't_amdg'; d.environment.extCloud.services.push({ id: nid('sv'), name: 'New service', type: ty, note: 'Describe this service' }) })
  const addContainer = () => setData((d) => d.environment.zones.push({ id: nid('z'), name: 'New container', badge: '', fwAbove: '', services: [] }))
  const addFirewall = () => setData((d) => { const id = nid('fw'); if (!d.environment.extraFw) d.environment.extraFw = []; d.environment.extraFw.push({ id, label: 'New firewall · rename in Edit' }); if (!d.environment.canvasPos) d.environment.canvasPos = {}; d.environment.canvasPos[id] = { x: 264, y: 72 } })
  const addNote = () => setData((d) => { if (!d.environment.notes) d.environment.notes = []; const id = nid('note'); d.environment.notes.push({ id, text: '', color: palette, style: embellish }); if (!d.environment.canvasPos) d.environment.canvasPos = {}; d.environment.canvasPos[id] = { x: 120, y: 120 }; if (!d.environment.canvasSize) d.environment.canvasSize = {}; d.environment.canvasSize[id] = { w: 200, h: 150 } })
  const autoArrange = () => setData((d) => { if (d.environment) { d.environment.canvasPos = {}; d.environment.canvasSize = {} } })

  const toolBtn = (on: boolean): React.CSSProperties => ({ display: 'flex', alignItems: 'center', justifyContent: 'space-between', border: '1px solid ' + (on ? '#BFE0CF' : '#D5DBE3'), background: on ? '#E4EEE9' : '#fff', color: on ? '#2F6B53' : '#5A6473', borderRadius: 6, padding: '7px 10px', font: "600 11px 'Libre Franklin'", cursor: 'pointer' })

  return (
    <div style={{ maxWidth: 1780, margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 14 }}>
        <div>
          <div style={{ font: "700 19px 'Libre Franklin'", color: '#1B2330' }}>Environment map</div>
          <div style={{ font: "400 12.5px/1.5 'Libre Franklin'", color: '#7A8494', marginTop: 2, maxWidth: 1040 }}>
            Freeform canvas — drag any block or card to rearrange. <span style={{ color: '#A8553F', fontWeight: 600 }}>Lock the firewalls</span> to pin the trust boundaries so they don't move while you reorganize everything else. Double-click a service card to edit it.
          </div>
        </div>
      </div>
      <div style={{ position: 'relative' }}>
        <div style={{ background: '#fff', border: '1px solid #E4E8EE', borderRadius: 5, boxShadow: '0 1px 2px rgba(20,30,50,.05)', overflow: 'auto', height: 640 }}>
          <div style={{ position: 'relative', width: worldW, height: worldH, minWidth: '100%', minHeight: '100%' }}>
            <div style={{ position: 'absolute', left: 0, top: 0, width: canvasW, height: canvasH, transformOrigin: '0 0', transform: `scale(${zoom})`, backgroundColor: '#FCFDFE', backgroundImage: gridImg, backgroundSize: '24px 24px' }}>
              {envNodes.map((n) => (
                <div key={n.id} onPointerDown={(e) => onDown(e, n.id)} onDoubleClick={() => openCard(n.id)} style={{ position: 'absolute', left: 0, top: 0, width: n.w, transform: `translate(${n.x}px,${n.y}px)`, ...n.box, touchAction: 'none', userSelect: 'none' }}>
                  {n.kind === 'container' && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, pointerEvents: 'none' }}>
                      <span style={{ font: "700 13px 'Libre Franklin'", color: '#1B2330' }}>{n.title}</span>
                      {n.badge && <span style={{ font: "600 8.5px 'IBM Plex Mono',monospace", padding: '2px 8px', borderRadius: 9, background: n.badgeBg, color: n.badgeColor }}>{n.badge}</span>}
                    </div>
                  )}
                  {n.kind === 'note' && (
                    <>
                      <div style={{ height: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'grab' }}><div style={{ width: 26, height: 3, borderRadius: 2, background: 'rgba(0,0,0,.2)' }} /></div>
                      <button onClick={() => setData((d) => { const i = (d.environment.notes || []).findIndex((x) => x.id === n.id); if (i >= 0) d.environment.notes!.splice(i, 1) })} onPointerDown={(e) => e.stopPropagation()} style={{ position: 'absolute', top: 3, right: 6, background: 'none', border: 'none', color: 'rgba(0,0,0,.4)', cursor: 'pointer', fontSize: 12, lineHeight: 1 }}>✕</button>
                      <textarea value={n.text} onChange={(e) => setData((d) => { const nt = (d.environment.notes || []).find((x) => x.id === n.id); if (nt) nt.text = e.target.value })} onPointerDown={(e) => e.stopPropagation()} placeholder="Type a note…" style={{ width: '100%', height: 'calc(100% - 16px)', border: 'none', background: 'transparent', outline: 'none', resize: 'none', padding: '2px 12px 10px', font: "600 13px/1.45 'Libre Franklin'", color: '#2A2418', boxSizing: 'border-box' }} />
                    </>
                  )}
                  {n.kind === 'firewall' && (
                    <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 16 }}>
                      <span style={{ font: "700 9.5px 'IBM Plex Mono',monospace", letterSpacing: '.06em', color: '#A8553F', textTransform: 'uppercase', pointerEvents: 'none' }}>{n.label}</span>
                      <button onClick={(e) => toggleLock(e, n.id)} onPointerDown={(e) => e.stopPropagation()} title="Lock / unlock this firewall" style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', background: n.locked ? '#1B2330' : '#fff', color: n.locked ? '#fff' : '#A8553F', border: '1px solid ' + (n.locked ? '#1B2330' : '#E2C2B8'), borderRadius: 5, font: "700 8px 'IBM Plex Mono',monospace", letterSpacing: '.05em', padding: '3px 7px', cursor: 'pointer' }}>{n.lockIcon}</button>
                    </div>
                  )}
                  {n.kind === 'card' && (
                    <>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 6, pointerEvents: 'none' }}>
                        <span style={{ font: "600 12px 'Libre Franklin'", color: '#1B2330', lineHeight: 1.2 }}>{n.name}</span>
                        <span style={{ font: "600 7.5px 'IBM Plex Mono',monospace", padding: '2px 5px', borderRadius: 5, background: n.tagBg, color: n.tagColor, flex: 'none' }}>{n.tagLabel}</span>
                      </div>
                      {n.note && <div style={{ font: "400 9.5px/1.35 'Libre Franklin'", color: '#6A7382', marginTop: 4, pointerEvents: 'none' }}>{n.note}</div>}
                    </>
                  )}
                  {n.kind === 'abes' && (
                    <>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8, pointerEvents: 'none' }}>
                        <span style={{ font: "700 14px 'Libre Franklin'", color: '#A8553F' }}>{n.name}</span>
                        <span style={{ font: "600 8px 'IBM Plex Mono',monospace", padding: '2px 7px', borderRadius: 9, background: '#F1DBD3', color: '#A8553F' }}>SEPARATE ENTITY</span>
                      </div>
                      <div style={{ font: "400 10.5px/1.4 'Libre Franklin'", color: '#6A7382', marginTop: 4, pointerEvents: 'none' }}>{n.role}</div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 9, pointerEvents: 'none' }}>
                        {n.apps.map((a: any, i: number) => (<span key={i} style={{ font: "500 10px 'Libre Franklin'", padding: '3px 8px', borderRadius: 10, background: a.bg, color: a.color }}>{a.label}</span>))}
                      </div>
                    </>
                  )}
                  {n.kind === 'roadmap' && (
                    <>
                      <div style={{ font: "700 12px 'Libre Franklin'", color: '#4A6491', pointerEvents: 'none' }}>AMDG · innovation cycles</div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 7, marginTop: 10, pointerEvents: 'none' }}>
                        {n.phases.map((p: any, i: number) => (
                          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#fff', border: '1px solid #E3E8EF', borderLeft: '3px solid #4A6491', borderRadius: 3, padding: '6px 8px' }}>
                            <span style={{ font: "700 11px 'IBM Plex Mono',monospace", color: '#4A6491', flex: 'none' }}>P{p.n}</span>
                            <span style={{ font: "600 10.5px 'Libre Franklin'", color: '#1B2330', lineHeight: 1.2 }}>{p.name}</span>
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                  {n.kind === 'panel' && (
                    <>
                      <div style={{ font: "600 10px 'IBM Plex Mono',monospace", color: '#8A93A2', textTransform: 'uppercase', letterSpacing: '.06em', pointerEvents: 'none' }}>{n.title}</div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 9, marginTop: 10, pointerEvents: 'none' }}>
                        {n.rows.map((r: any, i: number) => (
                          <div key={i} style={{ display: 'flex', gap: 9, alignItems: 'flex-start' }}>
                            <span style={{ width: 11, height: 11, borderRadius: 3, background: r.color, flex: 'none', marginTop: 2 }} />
                            <div style={{ minWidth: 0 }}>
                              <div style={{ font: "600 12px 'Libre Franklin'", color: '#1B2330' }}>{r.name}</div>
                              {r.role && <div style={{ font: "400 10px/1.4 'Libre Franklin'", color: '#6A7382' }}>{r.role}</div>}
                            </div>
                          </div>
                        ))}
                      </div>
                      {n.text && <div style={{ font: "400 11px/1.5 'Libre Franklin'", color: '#41495A', marginTop: 8, pointerEvents: 'none' }}>{n.text}</div>}
                    </>
                  )}
                  {n.resizable && (
                    <div onPointerDown={(e) => onResizeDown(e, n.id)} style={{ position: 'absolute', right: -2, bottom: -2, width: 16, height: 16, cursor: n.rzCursor, borderRadius: '0 0 5px 0', background: 'linear-gradient(135deg,transparent 42%,#AAB4C2 42%,#AAB4C2 58%,transparent 58%,transparent 70%,#AAB4C2 70%,#AAB4C2 86%,transparent 86%)' }} />
                  )}
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
              <div style={{ borderTop: '1px solid #EDF0F4', marginTop: 1, paddingTop: 9, display: 'flex', flexDirection: 'column', gap: 6 }}>
                <span style={{ font: "700 8.5px 'IBM Plex Mono',monospace", color: '#9AA3B2', letterSpacing: '.09em' }}>ADD ELEMENT</span>
                <button onClick={addCard} className="mini-btn" style={{ justifyContent: 'flex-start' }}>+ Service card</button>
                <button onClick={addContainer} className="mini-btn" style={{ justifyContent: 'flex-start' }}>+ Container</button>
                <button onClick={addFirewall} className="mini-btn" style={{ justifyContent: 'flex-start' }}>+ Firewall</button>
                <button onClick={addNote} className="mini-btn" style={{ justifyContent: 'flex-start' }}>+ Sticky note</button>
              </div>
              <div style={{ borderTop: '1px solid #EDF0F4', marginTop: 1, paddingTop: 9, display: 'flex', flexDirection: 'column', gap: 7 }}>
                <span style={{ font: "700 8.5px 'IBM Plex Mono',monospace", color: '#9AA3B2', letterSpacing: '.09em' }}>PALETTE</span>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                  {PAL.map((c) => (<button key={c} onClick={() => setPalette(c)} style={{ width: 22, height: 22, borderRadius: 5, background: c, border: '2px solid ' + (c === palette ? '#1B2330' : 'transparent'), cursor: 'pointer' }} />))}
                </div>
                <div style={{ display: 'flex', gap: 5 }}>
                  {(['solid', 'striped'] as const).map((e) => (<button key={e} onClick={() => setEmbellish(e)} style={{ flex: 1, borderRadius: 6, padding: 6, font: "600 10.5px 'Libre Franklin'", cursor: 'pointer', textTransform: 'capitalize', border: '1px solid ' + (embellish === e ? '#1B2330' : '#D5DBE3'), background: embellish === e ? '#1B2330' : '#fff', color: embellish === e ? '#fff' : '#5A6473' }}>{e}</button>))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
