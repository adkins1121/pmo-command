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
| **Environment** | Freeform topology — drag containers/cards/firewalls, resize, drag-to-reparent, **lockable firewalls**. |
| **Insights** | Reconciliation engine: WHAT/EVIDENCE/WHY/MOVE findings, source-linked, with generative **Take Action** (to-do / meeting / email / update plan). |
| **Integrations** | Connectors incl. **Claude (Anthropic · MCP)**, Microsoft 365 sweep, Outlook, Teams, Plane, Gmail, Fireflies, Box, GitHub. |

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
