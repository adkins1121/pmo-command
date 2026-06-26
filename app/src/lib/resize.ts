// Pure 2D resize math shared by the canvas and its tests. Given a starting
// rect, a handle direction, and the pointer delta in *screen* pixels, it returns
// the new rect in *world* coordinates — honouring zoom, snap-to-grid, minimum
// dimensions and the per-axis resizability of the element.

export type ResizeDir = 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw'

export interface Rect {
  x: number
  y: number
  w: number
  h: number
}

export interface ResizeOpts {
  zoom: number
  snap: boolean
  grid: number
  minW: number
  minH: number
  /** Whether the element resizes horizontally (e/w edges). */
  canW: boolean
  /** Whether the element resizes vertically (n/s edges). */
  canH: boolean
}

const snapTo = (v: number, grid: number) => Math.round(v / grid) * grid

/**
 * Compute a resized rect. `dxScreen`/`dyScreen` are raw pointer deltas; they are
 * divided by `zoom` so a drag tracks the cursor at any zoom level. West/north
 * handles move the origin so the opposite edge stays pinned. Dimensions never go
 * below the minimums and can never be negative.
 */
export function computeResize(start: Rect, dir: ResizeDir, dxScreen: number, dyScreen: number, opts: ResizeOpts): Rect {
  const { zoom, snap, grid, minW, minH, canW, canH } = opts
  const dxW = dxScreen / zoom
  const dyW = dyScreen / zoom

  let w = start.w
  let h = start.h
  if (canW && dir.includes('e')) w = start.w + dxW
  if (canW && dir.includes('w')) w = start.w - dxW
  if (canH && dir.includes('s')) h = start.h + dyW
  if (canH && dir.includes('n')) h = start.h - dyW

  if (snap && grid > 0) {
    if (canW) w = snapTo(w, grid)
    if (canH) h = snapTo(h, grid)
  }

  // Clamp to minimums (also guarantees non-negative).
  w = Math.max(minW, w)
  h = Math.max(minH, h)

  // Reposition the origin when dragging the west/north edges, using the final
  // (clamped/snapped) size so the far edge stays put.
  let x = start.x
  let y = start.y
  if (canW && dir.includes('w')) x = start.x + (start.w - w)
  if (canH && dir.includes('n')) y = start.y + (start.h - h)

  return { x: Math.round(x), y: Math.round(y), w: Math.round(w), h: Math.round(h) }
}

/** Which handle directions an element exposes, given its axis capabilities. */
export function handleDirs(canW: boolean, canH: boolean): ResizeDir[] {
  if (canW && canH) return ['n', 's', 'e', 'w', 'ne', 'nw', 'se', 'sw']
  if (canW) return ['e', 'w']
  if (canH) return ['n', 's']
  return []
}
