# AMDG PMO — ERPNext / ABES Program tool

A React + TypeScript + Vite implementation of the AMDG PMO tool (ported from the
Claude Design prototype). One editable dataset drives every view; everything
persists to the browser (`localStorage`, key `amdg_pmo_v1`) and round-trips
through JSON export/import.

## Run it

```bash
cd app
npm install
npm run dev        # http://localhost:5173
# or a production build:
npm run build && npm run preview
```

No API keys or backend required — the LLM-backed features (Insights, AI
assistant, Take-Action drafts) run against a **mock Claude client**
(`src/lib/mockClaude.ts`) that synthesizes grounded output from the plan data.
Swap that module for a real Claude / MCP call to go live. Connector
authentication and Plane MCP are mocked the same way.

## The views (left ☰ menu)

| View | What it shows |
|------|----------------|
| **Dashboard** | KPI tiles, Initiatives (objectives→Plane), phase progress, status mix, vendor workload, needs-attention. Every tile drills in. |
| **My Focus** | Your work items, ad-hoc to-dos (add/check/prioritize), hot inbox threads. |
| **Daily Standup** | Two windows (since last report / 7 days) × committed-completed / carryover / blockers / open decisions. Filters + Copy-for-Teams. |
| **Activity Feed** | Chronological, typed feed (Plan update / Decision / Insight / Blocker / Task / Comment) with a type filter. **Every entry is source-linked.** |
| **Objectives** | The six outcomes (O1–O6), each a Plane Initiative with stream chips + sync state. |
| **Board** | Work streams by phase, colored by vendor, treatment = status. |
| **Timeline** | Each stream as a lane across sprints/phases, with gates + milestones. |
| **Dependencies** | Drag-and-drop canvas, 3 lenses (Functional / Logical / Delivery), critical path, zoom/snap/grid, sticky notes. |
| **Environment** | Freeform topology — drag containers/cards/firewalls, **2D resize (8 handles)**, drag-to-reparent, **lockable firewalls**, **plan-coverage badges + AI association**. |
| **Insights** | Reconciliation engine: WHAT/EVIDENCE/WHY/MOVE findings, source-linked, with generative **Take Action** (to-do / meeting / email / update plan). |
| **Integrations** | Connectors incl. **Claude (Anthropic · MCP)**, Microsoft 365 sweep, Outlook, Teams, Plane, Gmail, Fireflies, Box, GitHub. |
| **Admin** | Manage features, matching rules, coverage thresholds, governance and sync. Search-as-you-type, draft/dirty-state, validation, Pull/Push/Resolve + import/export. |

## Next-iteration features

- **2D resizing** — every box-like element (Container, Firewall, sticky Note,
  service card, panels) exposes N/S/E/W + corner handles. Resize is zoom-aware and
  snaps to the grid; firewalls widen without getting taller, containers grow
  taller without getting wider. Minimums + a per-element `lockSize` are honoured.
  Geometry persists in `environment.canvasSize`/`canvasPos`. Math lives in
  `src/lib/resize.ts` (unit-tested).
- **AI plan association** — *Analyze plan coverage* (Environment TOOLS panel)
  links every service card to Objectives / Streams / Phases / Vendors / DataPlane
  using a deterministic heuristic matcher (`src/lib/matcher.ts`) with a confidence
  score, stored rationale, and an LLM hook behind `MatchProvider`. Manual links
  (set in the service modal) always override AI and are never silently discarded.
- **Coverage indicators** — each card shows a Covered / Partial / Needs-review /
  Missing chip; toolbar counters + an "Only show uncovered" filter make gaps
  one click away. Logic in `src/lib/coverage.ts`.
- **Sync** — `SyncAdapter` interface with a bundled `LocalSyncAdapter`
  (`src/lib/sync.ts`); Pull / Push / Resolve-conflicts, last-synced + pending
  status, JSON payload import/export. Manual-mapping conflicts are reviewable,
  low-risk settings are last-write-wins.

```bash
npm test           # vitest — resize math, AI scoring, coverage, sync + conflicts,
                   #          persistence adapter, server optimistic-concurrency store
```

## Shared persistence (Railway + Supabase)

By default the app is local-only (`localStorage`). For durable, shared state the
Railway server (`app/server.mjs`) exposes a thin, auth-gated persistence API and
the client auto-syncs to it:

- **Storage** — the whole `PmoData` document lives as one `jsonb` row per
  workspace in Supabase `public.pmo_state`, guarded by an integer `rev`
  (optimistic concurrency). The browser never talks to Supabase directly — only
  the server holds the **service-role** key. The table has RLS enabled with no
  policies (service-role-only).
- **Sync** — on load the client hydrates from the server (falling back to
  `localStorage` when offline); edits debounce-save back. A stale write returns
  `409` with the current copy and the user picks *Keep mine* / *Load theirs*
  (manual plan-links are protected). A status pill shows Synced / Saving /
  Offline / Conflict.
- **Endpoints** (behind Basic Auth, except `/healthz`):
  `GET /api/config` → `{ persistence }`, `GET /api/state` → `{ data, rev }`,
  `PUT /api/state` `{ data, baseRev }` → `200 { ok, rev }` | `409 { conflict }`.

Enable it by setting these Railway service variables (without them the app runs
fine, just local-only):

| Variable | Value |
|----------|-------|
| `SUPABASE_URL` | `https://mpkbzrzfbfviiferujbc.supabase.co` |
| `SUPABASE_SERVICE_KEY` | the project's **service_role** secret (Supabase → Project Settings → API) |
| `BASIC_AUTH_USER` / `BASIC_AUTH_PASS` | the shared team login |
| `PMO_WORKSPACE` *(optional)* | document key, defaults to `default` |


Cross-cutting: global search, global filters (header), the **Edit** drawer
(fly-in, edit/add/reorder everything), **Ask AI** flyout, ⋯ menu (PDF / draw.io
/ Export / Import / Reset). **Double-click any card** to open the editable item
modal.

## Suggested 5-minute demo flow

1. **Dashboard** — set the scene; click a phase bar → Board.
2. **Board** → double-click a stream → edit status/labels in the modal.
3. **Dependencies** → toggle Logical/Delivery lenses; drag a card (it stays put).
4. **Environment** → lock the HIPAA firewall, drag a service between zones.
5. **Insights** → *Generate findings* → *Take action → Send email* (generative).
6. **Edit → Plane sync → Push all structure to Plane** → go to **Objectives**:
   they now read "synced"; open a stream → **View in Plane** is live.
7. **Activity Feed** — show the typed, source-linked history; filter by Insight.
8. **Ask AI** — ask "what's blocking the data migration?" (searches connectors).

## Notes on scope

- Plane is positioned as the system of record: structure pushes from the tool,
  status reads back. The push is mocked (assigns the ids the MCP calls would
  return); wire `src/lib/plane.ts` + `mockClaude.ts` to the live Plane MCP to
  make it real.
- Generated insights and tasks carry a `sourceRef` (provenance) and surface a
  clickable source chip everywhere they appear.
