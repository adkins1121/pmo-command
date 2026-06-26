import type { PmoData } from '../data/types'
import { mix } from '../data/helpers'

/** Faithful port of buildDrawio(): emits an editable mxGraph diagram. */
export function buildDrawio(d: PmoData): string {
  const om: Record<string, any> = {}
  d.owners.forEach((o) => (om[o.id] = o))
  const pIdx: Record<string, number> = {}
  d.phases.forEach((p, i) => (pIdx[p.id] = i))
  const esc = (s: string) =>
    (s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
  let cells = ''
  const rc: Record<number, number> = {}
  const nByCode: Record<string, string> = {}
  d.phases.forEach((p, i) => {
    cells +=
      '<mxCell id="ph_' + p.id + '" value="' + esc('PHASE ' + p.n + ' · ' + p.name) +
      '" style="text;html=1;fontStyle=1;fontSize=13;fontColor=#1B2330;align=left;" vertex="1" parent="1"><mxGeometry x="' +
      (40 + i * 250) + '" y="20" width="220" height="26" as="geometry"/></mxCell>'
  })
  d.streams.forEach((s) => {
    const pi = pIdx[s.phaseId] || 0
    const row = rc[pi] == null ? 0 : rc[pi]
    rc[pi] = row + 1
    const x = 40 + pi * 250
    const y = 60 + row * 86
    const o = om[s.ownerId] || { color: '#888', name: '' }
    const planlike = s.status === 'plan' || s.status === 'risk'
    const fill = planlike ? '#ffffff' : mix(o.color, 0.86)
    const style =
      'rounded=1;whiteSpace=wrap;html=1;fontSize=11;fillColor=' + fill + ';strokeColor=' + o.color + ';' +
      (planlike ? 'dashed=1;' : '') + 'verticalAlign=top;spacingTop=4;'
    const id = 'n_' + s.id
    nByCode[s.code] = id
    const val =
      esc(s.code + '  ' + s.name) + '&#10;' + esc('[' + (s.workType || 'Epic') + ' · ' + (o.name || '') + ' · ' + s.status + ']')
    cells +=
      '<mxCell id="' + id + '" value="' + val + '" style="' + style +
      '" vertex="1" parent="1"><mxGeometry x="' + x + '" y="' + y + '" width="220" height="64" as="geometry"/></mxCell>'
  })
  d.streams.forEach((s) => {
    ;(s.deps || []).forEach((c) => {
      const src = nByCode[c],
        tgt = nByCode[s.code]
      if (src && tgt)
        cells +=
          '<mxCell id="e_' + s.id + '_' + esc(c) +
          '" style="endArrow=block;html=1;rounded=1;strokeColor=#A8553F;strokeWidth=1.5;" edge="1" parent="1" source="' +
          src + '" target="' + tgt + '"><mxGeometry relative="1" as="geometry"/></mxCell>'
    })
  })
  return (
    '<mxGraphModel dx="1200" dy="800" grid="1" gridSize="10" guides="1" tooltips="1" connect="1" arrows="1" fold="1" page="1" pageScale="1" pageWidth="1700" pageHeight="1100" math="0" shadow="0"><root><mxCell id="0"/><mxCell id="1" parent="0"/>' +
    cells +
    '</root></mxGraphModel>'
  )
}

export function downloadDrawio(d: PmoData) {
  try {
    const xml = buildDrawio(d)
    const blob = new Blob([xml], { type: 'application/xml' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'amdg-pmo.drawio'
    a.click()
    setTimeout(() => URL.revokeObjectURL(url), 1500)
    window.open('https://app.diagrams.net/', '_blank', 'noopener')
  } catch {
    /* ignore */
  }
}
