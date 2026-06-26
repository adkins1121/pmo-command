// Server-side Plane connector. Pulls the workspace's projects (+ their issues
// and states) from the Plane REST API and normalizes them so the client can
// merge them into the program's work streams.
//
// Structure B (matching the app's push brief): a Plane *Project* ↔ a work
// *stream*. A stream's status is derived from the completion of the project's
// issues (by Plane state group).
//
// The Plane API key lives only here (env PLANE_API_TOKEN); the browser never
// sees it. fetch + env are injectable for tests.

function apiRoot(baseUrl) {
  const b = (baseUrl || 'https://api.plane.so').replace(/\/+$/, '')
  return /\/api\/v\d+$/.test(b) ? b : b + '/api/v1'
}

/** Derive an app status from issue-state-group tallies. Pure + tested. */
export function deriveStatus(counts) {
  const total = counts.total || 0
  if (total === 0) return 'plan'
  if (counts.completed === total) return 'done'
  if (counts.completed > 0) return 'mixed'
  if (counts.started > 0) return 'wip'
  if (counts.cancelled === total) return 'plan'
  return 'plan'
}

export function tallyIssues(issues, stateGroupById) {
  const counts = { total: 0, backlog: 0, unstarted: 0, started: 0, completed: 0, cancelled: 0 }
  for (const it of issues) {
    const group = stateGroupById[it.state] || it.state_group || 'backlog'
    counts.total++
    if (counts[group] == null) counts[group] = 0
    counts[group]++
  }
  return counts
}

export function createPlane({
  baseUrl = process.env.PLANE_BASE_URL,
  apiToken = process.env.PLANE_API_TOKEN,
  workspace = process.env.PLANE_WORKSPACE,
  webBase = process.env.PLANE_WEB_BASE || 'https://app.plane.so',
  fetchImpl = globalThis.fetch,
  maxProjects = 50,
} = {}) {
  const enabled = Boolean(apiToken && workspace && fetchImpl)
  const root = apiRoot(baseUrl)
  const headers = { 'X-API-Key': apiToken, 'Content-Type': 'application/json' }

  async function getList(path) {
    const res = await fetchImpl(root + path, { headers })
    if (!res.ok) throw new Error('plane ' + path + ' → ' + res.status)
    const body = await res.json()
    if (Array.isArray(body)) return body
    return Array.isArray(body.results) ? body.results : []
  }

  function status() {
    return { configured: enabled, workspace: workspace || null, baseUrl: enabled ? root : null }
  }

  async function pull() {
    if (!enabled) throw new Error('plane not configured')
    const projects = (await getList('/workspaces/' + workspace + '/projects/')).slice(0, maxProjects)
    const out = []
    for (const p of projects) {
      const pid = p.id
      let counts = { total: 0, started: 0, completed: 0, cancelled: 0 }
      try {
        const states = await getList('/workspaces/' + workspace + '/projects/' + pid + '/states/')
        const groupById = {}
        states.forEach((s) => (groupById[s.id] = s.group))
        const issues = await getList('/workspaces/' + workspace + '/projects/' + pid + '/issues/')
        counts = tallyIssues(issues, groupById)
      } catch {
        /* a project we can't read fully still appears, just without counts */
      }
      out.push({
        id: pid,
        name: p.name,
        identifier: p.identifier || '',
        description: p.description || p.description_text || '',
        status: deriveStatus(counts),
        counts,
        completion: counts.total ? Math.round(((counts.completed || 0) / counts.total) * 100) : 0,
        url: webBase.replace(/\/+$/, '') + '/' + workspace + '/projects/' + pid + '/issues/',
      })
    }
    return { ok: true, pulledAt: new Date().toISOString(), workspace, projects: out }
  }

  return { enabled, status, pull }
}
