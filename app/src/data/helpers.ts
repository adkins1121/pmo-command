import type { Status } from './types'

/** Lighten a hex color toward white by fraction t (0..1). */
export function mix(hex: string, t: number): string {
  const c = parseInt(hex.slice(1), 16)
  const r = c >> 16,
    g = (c >> 8) & 255,
    b = c & 255
  const m = (v: number) => Math.round(v + (255 - v) * t)
  const h = (v: number) => v.toString(16).padStart(2, '0')
  return '#' + h(m(r)) + h(m(g)) + h(m(b))
}

export interface Pill {
  text: string
  bg: string
  color: string
}

export function pill(st: Status, color: string): Pill {
  const M: Record<string, [string, string, string]> = {
    done: ['Done', color, '#fff'],
    wip: ['In progress', mix(color, 0.82), color],
    mixed: ['Partly done', mix(color, 0.82), color],
    plan: ['Planned', '#EEF0F3', '#5A6473'],
    risk: ['At risk', '#F6EAE6', '#A8553F'],
  }
  const x = M[st] || ['—', '#eee', '#333']
  return { text: x[0], bg: x[1], color: x[2] }
}

let nidSeq = 0
export function nid(p: string): string {
  // deterministic-ish unique id; the prototype used Math.random()
  nidSeq += 1
  return p + '_' + Date.now().toString(36) + nidSeq.toString(36)
}
