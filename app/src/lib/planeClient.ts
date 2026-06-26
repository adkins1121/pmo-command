// Client wrapper for the server-proxied Plane connector. The browser only ever
// talks to the same-origin /api/plane/* endpoints (the API token lives on the
// server). fetch is injectable for tests.

import type { PlaneProject } from './planeMerge'

export interface PlaneStatus {
  configured: boolean
  workspace: string | null
  baseUrl: string | null
}

export interface PlanePull {
  ok: boolean
  pulledAt: string
  workspace: string
  projects: PlaneProject[]
}

type FetchLike = typeof fetch

export async function fetchPlaneStatus(fetchImpl: FetchLike = fetch): Promise<PlaneStatus> {
  try {
    const res = await fetchImpl('/api/plane/status', { headers: { Accept: 'application/json' } })
    if (!res.ok) return { configured: false, workspace: null, baseUrl: null }
    const body = await res.json()
    return { configured: Boolean(body.configured), workspace: body.workspace ?? null, baseUrl: body.baseUrl ?? null }
  } catch {
    return { configured: false, workspace: null, baseUrl: null }
  }
}

export async function pullPlane(fetchImpl: FetchLike = fetch): Promise<PlanePull> {
  const res = await fetchImpl('/api/plane/pull', { method: 'POST', headers: { Accept: 'application/json' } })
  if (res.status === 501) throw new Error('Plane is not configured on the server (set PLANE_API_TOKEN + PLANE_WORKSPACE).')
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error('Pull failed (' + res.status + ')' + (body && body.message ? ': ' + body.message : ''))
  }
  return (await res.json()) as PlanePull
}
