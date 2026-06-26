import { useState } from 'react'
import { useStore } from '../store/store'
import { useUI } from '../store/ui'
import { buildMaps } from '../lib/derive'
import type { Stream, Todo } from '../data/types'

const DAY = 86400000

export function Standup() {
  const { data, setData } = useStore()
  const ui = useUI()
  const { enrich } = buildMaps(data)
  const [copied, setCopied] = useState(false)

  const NOW = Date.now()
  const lastRep = data.lastReportAt || NOW - DAY
  const agoOf = (ts: number) => {
    if (!ts) return ''
    const h = Math.round((NOW - ts) / 3600000)
    if (h < 1) return 'just now'
    if (h < 24) return h + 'h ago'
    return Math.round(h / 24) + 'd ago'
  }

  const stOwner = ui.fSuOwner
  const stType = ui.fSuType
  const sPass = (s: Stream) =>
    (stOwner === 'all' || (stOwner === 'mine' ? !!s.mine : s.ownerId === stOwner)) &&
    (stType === 'all' || (s.workType || 'Epic') === stType)
  const tPass = (t: Todo) =>
    (stOwner === 'all' || stOwner === 'mine' || t.ownerId === stOwner) && (stType === 'all' || (t.workType || 'Task') === stType)
  const fActive = stOwner !== 'all' || stType !== 'all'
  const src = ui.fSuSource || 'all'
  const srcPlan = src === 'all' || src === 'plan'
  const srcAd = src === 'all' || src === 'adhoc'

  const completedAll: { label: string; kind: string; at: number; openId: string; openKind: 'stream' | 'todo' }[] = []
  data.streams.forEach((s) => {
    if (srcPlan && s.status === 'done' && s.completedAt && sPass(s))
      completedAll.push({ label: s.code + ' · ' + s.name, kind: 'On plan', at: s.completedAt, openId: s.id, openKind: 'stream' })
  })
  ;(data.todos || []).forEach((t) => {
    if (srcAd && t.done && t.completedAt && tPass(t))
      completedAll.push({ label: t.text, kind: 'Ad hoc', at: t.completedAt, openId: t.id, openKind: 'todo' })
  })
  const mkCompleted = (from: number) => completedAll.filter((i) => i.at >= from).sort((a, b) => b.at - a.at)

  const carryList: { label: string; tag: string; tagBg: string; tagColor: string; openId: string; openKind: 'stream' | 'todo' }[] = []
  data.streams.forEach((s) => {
    if (srcPlan && s.committed && s.status !== 'done' && sPass(s)) {
      const e = enrich(s)
      carryList.push({ label: s.code + ' · ' + s.name, tag: e.pillText, tagBg: e.pillBg, tagColor: e.pillColor, openId: s.id, openKind: 'stream' })
    }
  })
  ;(data.todos || []).forEach((t) => {
    if (srcAd && t.committed && !t.done && tPass(t))
      carryList.push({ label: t.text, tag: 'Ad hoc', tagBg: '#EEF1F4', tagColor: '#5A6473', openId: t.id, openKind: 'todo' })
  })

  const blockersAll: { text: string; meta: string }[] = []
  ;(data.blockers || []).forEach((b) => {
    if (b.active !== false && srcPlan) {
      const bs = b.streamCode ? data.streams.find((x) => x.code === b.streamCode) : null
      if (!fActive || (bs && sPass(bs))) blockersAll.push({ text: b.text, meta: (b.owner || '') + (b.streamCode ? ' · ' + b.streamCode : '') })
    }
  })
  data.streams.forEach((s) => {
    if (srcPlan && s.status !== 'done' && sPass(s))
      (s.deps || []).forEach((c) => {
        const dep = data.streams.find((x) => x.code === c)
        if (dep && (dep.status === 'plan' || dep.status === 'risk'))
          blockersAll.push({ text: s.code + ' ' + s.name + ' is waiting on ' + dep.code + ' ' + dep.name, meta: 'dependency' })
      })
  })

  const decisionsOpenL = (srcPlan ? (data.decisions || []).filter((x) => x.status !== 'resolved') : []).map((x) => ({
    text: x.text,
    meta: (x.owner || '') + (x.since ? ' · raised ' + x.since : ''),
  }))

  type Item = { primary: string; meta: string; tag: string; tagBg: string; tagColor: string; openId?: string; openKind?: 'stream' | 'todo' }
  const uCompleted = (arr: typeof completedAll): Item[] =>
    arr.map((i) => ({ primary: i.label, meta: i.kind + ' · ' + agoOf(i.at), tag: '✓', tagBg: '#E4EEE9', tagColor: '#3E7C6A', openId: i.openId, openKind: i.openKind }))
  const uCarry: Item[] = carryList.map((i) => ({ primary: i.label, meta: '', tag: i.tag, tagBg: i.tagBg, tagColor: i.tagColor, openId: i.openId, openKind: i.openKind }))
  const uBlockers: Item[] = blockersAll.map((i) => ({ primary: i.text, meta: i.meta, tag: '!', tagBg: '#F6EAE6', tagColor: '#A8553F' }))
  const uDecisions: Item[] = decisionsOpenL.map((i) => ({ primary: i.text, meta: i.meta, tag: '?', tagBg: '#EFEAF6', tagColor: '#5B5391' }))
  const sectionsFor = (completed: typeof completedAll) =>
    [
      { title: 'Committed · completed', accent: '#3E7C6A', items: uCompleted(completed) },
      { title: 'Committed · not yet complete', accent: '#B07D3C', items: uCarry },
      { title: 'Active blockers', accent: '#A8553F', items: uBlockers },
      { title: 'Open decisions', accent: '#5B5391', items: uDecisions },
    ].map((s) => ({ ...s, count: s.items.length, empty: !s.items.length }))

  const standup = [
    { key: 'since', title: 'Since last report', sub: 'last reported ' + agoOf(lastRep), sections: sectionsFor(mkCompleted(lastRep)) },
    { key: 'week', title: 'Last 7 days', sub: 'rolling 7-day window', sections: sectionsFor(mkCompleted(NOW - 7 * DAY)) },
  ]

  const copyForTeams = () => {
    const bullet = (arr: any[], f: (i: any) => string) => (arr.length ? arr.map(f).join('\n') : '  • (none)')
    let su = 'DAILY STANDUP — ABES ERPNext  (' + new Date(NOW).toLocaleDateString() + ')\n'
    su += '\nSINCE LAST REPORT (' + agoOf(lastRep) + ')\n'
    su += 'Completed:\n' + bullet(mkCompleted(lastRep), (i) => '  • ' + i.label) + '\n'
    su += 'Committed, still open:\n' + bullet(carryList, (i) => '  • ' + i.label) + '\n'
    su += 'Active blockers:\n' + bullet(blockersAll, (i) => '  • ' + i.text) + '\n'
    su += 'Open decisions:\n' + bullet(decisionsOpenL, (i) => '  • ' + i.text) + '\n'
    try {
      navigator.clipboard.writeText(su)
    } catch {
      /* ignore */
    }
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  const selStyle: React.CSSProperties = { border: '1px solid #D5DBE3', borderRadius: 6, padding: '6px 9px', fontSize: 11, background: '#fff', color: '#1B2330' }
  const suOwnerOpts = [{ v: 'mine', l: 'My tasks' }, { v: 'all', l: 'All owners' }, ...data.owners.map((o) => ({ v: o.id, l: o.name }))]
  const suTypeOpts = [{ v: 'all', l: 'All types' }, { v: 'Epic', l: 'Epic' }, { v: 'Task', l: 'Task' }, { v: 'Milestone', l: 'Milestone' }]
  const suSourceOpts = [{ v: 'all', l: 'On plan + ad hoc' }, { v: 'plan', l: 'On plan' }, { v: 'adhoc', l: 'Ad hoc' }]

  return (
    <div style={{ maxWidth: 1340, margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div>
          <div style={{ font: "700 19px 'Libre Franklin'", color: '#1B2330' }}>Daily standup</div>
          <div style={{ font: "400 12.5px 'Libre Franklin'", color: '#7A8494', marginTop: 2 }}>
            Committed/completed, carryover, blockers and open decisions — since last report and the last 7 days
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <select value={ui.fSuOwner} onChange={(e) => ui.set({ fSuOwner: e.target.value })} style={selStyle}>
            {suOwnerOpts.map((o) => (
              <option key={o.v} value={o.v}>{o.l}</option>
            ))}
          </select>
          <select value={ui.fSuType} onChange={(e) => ui.set({ fSuType: e.target.value })} style={selStyle}>
            {suTypeOpts.map((o) => (
              <option key={o.v} value={o.v}>{o.l}</option>
            ))}
          </select>
          <select value={ui.fSuSource} onChange={(e) => ui.set({ fSuSource: e.target.value })} style={selStyle}>
            {suSourceOpts.map((o) => (
              <option key={o.v} value={o.v}>{o.l}</option>
            ))}
          </select>
          <button onClick={() => setData((d) => void (d.lastReportAt = Date.now()))} className="mini-btn">
            Mark reported (reset)
          </button>
          <button onClick={copyForTeams} style={{ background: '#1B2330', color: '#fff', border: 'none', borderRadius: 6, padding: '7px 12px', font: "600 11px 'Libre Franklin'", cursor: 'pointer' }}>
            {copied ? '✓ Copied' : '⧉ Copy for Teams'}
          </button>
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(440px,1fr))', gap: 16, alignItems: 'start' }}>
        {standup.map((w) => (
          <div key={w.key} style={{ background: '#fff', border: '1px solid #E4E8EE', borderRadius: 5, boxShadow: '0 1px 2px rgba(20,30,50,.05)', overflow: 'hidden' }}>
            <div style={{ background: '#F6F8FA', borderBottom: '1px solid #EAEDF1', padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
              <span style={{ font: "700 15px 'Libre Franklin'", color: '#1B2330' }}>{w.title}</span>
              <span style={{ font: "500 10px 'IBM Plex Mono',monospace", color: '#8A93A2' }}>{w.sub}</span>
            </div>
            <div style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 16 }}>
              {w.sections.map((sec, si) => (
                <div key={si}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                    <span style={{ width: 8, height: 8, borderRadius: 2, background: sec.accent, flex: 'none' }} />
                    <span style={{ font: "700 11px 'Libre Franklin'", color: '#1B2330', textTransform: 'uppercase', letterSpacing: '.03em' }}>{sec.title}</span>
                    <span style={{ font: "600 9px 'IBM Plex Mono',monospace", color: '#fff', background: sec.accent, borderRadius: 9, padding: '1px 7px' }}>{sec.count}</span>
                  </div>
                  {sec.empty && <div style={{ font: "400 11px 'Libre Franklin'", color: '#A6AEBA', padding: '2px 0 2px 16px', fontStyle: 'italic' }}>Nothing here</div>}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                    {sec.items.map((i, ii) => (
                      <div
                        key={ii}
                        onDoubleClick={() => (i.openId ? ui.set({ itemId: i.openId, itemKind: i.openKind || 'stream' }) : undefined)}
                        style={{ display: 'flex', alignItems: 'flex-start', gap: 8, padding: '6px 9px', border: '1px solid #EEF1F4', borderRadius: 3, cursor: i.openId ? 'pointer' : 'default' }}
                      >
                        <span style={{ font: "700 9px 'IBM Plex Mono',monospace", background: i.tagBg, color: i.tagColor, borderRadius: 5, padding: '2px 6px', flex: 'none', marginTop: 1 }}>{i.tag}</span>
                        <div style={{ minWidth: 0 }}>
                          <div style={{ font: "500 12px/1.35 'Libre Franklin'", color: '#1B2330' }}>{i.primary}</div>
                          {i.meta && <div style={{ font: "500 9.5px 'IBM Plex Mono',monospace", color: '#8A93A2', marginTop: 2 }}>{i.meta}</div>}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
