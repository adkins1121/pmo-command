// Supabase-backed single-document store with optimistic concurrency.
//
// The whole PmoData document is persisted as one jsonb row per workspace in
// public.pmo_state. Writes use a `rev` integer guard: a PATCH only matches when
// the caller's baseRev still equals the stored rev, so a stale writer gets a
// conflict (with the current server copy) instead of clobbering newer data.
//
// Talks to Supabase via PostgREST with the *service-role* key (server-side
// only). fetch + env are injectable so the logic is unit-testable without a
// live database.

const TABLE = 'pmo_state'

export function createStore({
  url = process.env.SUPABASE_URL,
  serviceKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY,
  workspace = process.env.PMO_WORKSPACE || 'default',
  fetchImpl = globalThis.fetch,
} = {}) {
  const enabled = Boolean(url && serviceKey && fetchImpl)
  const base = enabled ? url.replace(/\/+$/, '') + '/rest/v1/' + TABLE : null
  const headers = {
    apikey: serviceKey,
    Authorization: 'Bearer ' + serviceKey,
    'Content-Type': 'application/json',
  }
  const wsFilter = 'workspace=eq.' + encodeURIComponent(workspace)

  async function load() {
    if (!enabled) return null
    const res = await fetchImpl(base + '?' + wsFilter + '&select=data,rev,updated_at', { headers })
    if (!res.ok) throw new Error('load failed: ' + res.status)
    const rows = await res.json()
    if (!Array.isArray(rows) || rows.length === 0) return null
    return { data: rows[0].data, rev: rows[0].rev, updatedAt: rows[0].updated_at }
  }

  // save → { ok:true, rev } | { ok:false, conflict:{data,rev,updatedAt}|null }
  async function save({ data, baseRev, updatedBy }) {
    if (!enabled) throw new Error('persistence not configured')
    const nowIso = new Date().toISOString()

    // First write (no baseRev) → INSERT at rev 1. A unique-violation (409) means
    // someone else created the row first → treat as a conflict.
    if (!baseRev) {
      const res = await fetchImpl(base, {
        method: 'POST',
        headers: { ...headers, Prefer: 'return=representation' },
        body: JSON.stringify({ workspace, data, rev: 1, updated_at: nowIso, updated_by: updatedBy || null }),
      })
      if (res.status === 201) {
        const rows = await res.json()
        return { ok: true, rev: rows[0].rev }
      }
      if (res.status === 409) return { ok: false, conflict: await load() }
      throw new Error('insert failed: ' + res.status)
    }

    // Optimistic update: only matches while the stored rev still equals baseRev.
    const res = await fetchImpl(base + '?' + wsFilter + '&rev=eq.' + encodeURIComponent(baseRev), {
      method: 'PATCH',
      headers: { ...headers, Prefer: 'return=representation' },
      body: JSON.stringify({ data, rev: baseRev + 1, updated_at: nowIso, updated_by: updatedBy || null }),
    })
    if (!res.ok) throw new Error('update failed: ' + res.status)
    const rows = await res.json()
    if (Array.isArray(rows) && rows.length === 1) return { ok: true, rev: rows[0].rev }
    // 0 rows matched → baseRev is stale → return the current server copy.
    return { ok: false, conflict: await load() }
  }

  return { enabled, workspace, load, save }
}
