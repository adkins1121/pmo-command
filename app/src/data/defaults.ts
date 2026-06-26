import type {
  Objective,
  PlaneConfig,
  PmoData,
  Todo,
  InboxMsg,
  Decision,
  Blocker,
  Label,
} from './types'

const HOUR = 3600 * 1000
const DAY = 86400000

export function getObjectiveDefaults(): Objective[] {
  return [
    {
      id: 'obj1',
      code: 'O1',
      name: 'Trusted financial system of record — QBO retired',
      outcome:
        'ERPNext books reconcile to the penny, ABES signs off, QuickBooks decommissioned.',
      color: '#4A6491',
      planeInitiativeId: '',
    },
    {
      id: 'obj2',
      code: 'O2',
      name: 'Finance runs itself (true replacement)',
      outcome:
        'Bank/receipt intake automated, journal entries auto-posted with exception review, leadership reporting live.',
      color: '#3E7C6A',
      planeInitiativeId: '',
    },
    {
      id: 'obj3',
      code: 'O3',
      name: 'Secure, AMDG-owned platform for repeatable innovation',
      outcome:
        'Infrastructure, engineering governance and security posture let each new capability ship safely.',
      color: '#5B5391',
      planeInitiativeId: '',
    },
    {
      id: 'obj4',
      code: 'O4',
      name: 'The organization adopts the platform',
      outcome: 'Geneva & Sycamore operate in ERPNext; the change plan is executed.',
      color: '#B07D3C',
      planeInitiativeId: '',
    },
    {
      id: 'obj5',
      code: 'O5',
      name: 'Clinical operations on-platform under HIPAA',
      outcome:
        'RethinkBH data migrated, HIPAA controls active, PHI contained in the no-WAN zone.',
      color: '#A8553F',
      planeInitiativeId: '',
    },
    {
      id: 'obj6',
      code: 'O6',
      name: 'Operational tooling runs the clinics',
      outcome: 'Scheduling and talent intake live for day-to-day operations.',
      color: '#5A6473',
      planeInitiativeId: '',
    },
  ]
}

export function planeDefaults(): PlaneConfig {
  return {
    workspaceSlug: '',
    baseUrl: 'https://app.plane.so',
    structure: 'B',
    stateMap: {
      done: 'Completed',
      wip: 'In Progress',
      mixed: 'In Progress',
      plan: 'Backlog',
      risk: 'In Progress',
    },
  }
}

export function defaultTodos(): Todo[] {
  return [
    {
      id: 'td1',
      text: 'Confirm GFI managed-services scope (hosting, firewalls, backups, monitoring)',
      source: 'manual',
      priority: 'high',
      done: false,
    },
    {
      id: 'td2',
      text: 'Approve chart-of-accounts structure with Cissy',
      source: 'plane',
      priority: 'high',
      done: false,
    },
    {
      id: 'td3',
      text: 'Reply to ABES on the go-live sign-off checklist',
      source: 'email',
      priority: 'high',
      done: false,
    },
    {
      id: 'td4',
      text: 'Schedule Geneva on-site readiness walkthrough',
      source: 'teams',
      priority: 'med',
      done: false,
    },
    {
      id: 'td5',
      text: 'Review Nexera migration reconcile output',
      source: 'plane',
      priority: 'med',
      done: false,
    },
    {
      id: 'td6',
      text: 'Send vendor label list to Plane workspace admin',
      source: 'manual',
      priority: 'low',
      done: true,
      committed: true,
      completedAt: Date.now() - 3 * DAY,
    },
    {
      id: 'td7',
      text: 'Stood up practice + live ERPNext instances',
      source: 'plane',
      priority: 'high',
      done: true,
      committed: true,
      completedAt: Date.now() - 12 * HOUR,
    },
    {
      id: 'td8',
      text: 'Completed chart-of-accounts mapping & transaction extract',
      source: 'plane',
      priority: 'high',
      done: true,
      committed: true,
      completedAt: Date.now() - 2 * HOUR,
    },
  ]
}

export function defaultInbox(): InboxMsg[] {
  return [
    {
      id: 'em1',
      subject: 'Re: QBO export — final balances',
      from: 'Cissy (ABES)',
      snippet: 'Attached the December trial balance for reconcile…',
      priority: 'high',
      unread: true,
      age: '2h',
    },
    {
      id: 'em2',
      subject: 'HIPAA controls sign-off',
      from: 'Veronica (ABES)',
      snippet: 'Can we review the access policy before Phase 3 kicks off…',
      priority: 'high',
      unread: true,
      age: '5h',
    },
    {
      id: 'em3',
      subject: 'Nexera sprint demo — Friday',
      from: 'Nexera Digital',
      snippet: 'Agenda: migration load + automation preview…',
      priority: 'med',
      unread: false,
      age: '1d',
    },
    {
      id: 'em4',
      subject: 'Change Shepherd — Geneva readiness',
      from: 'Change Shepherd',
      snippet: 'Proposed on-site dates and stakeholder list…',
      priority: 'med',
      unread: true,
      age: '1d',
    },
    {
      id: 'em5',
      subject: 'Paperless integration scope',
      from: 'Nexera Digital',
      snippet: 'Two-way sync fields to confirm before build…',
      priority: 'low',
      unread: false,
      age: '2d',
    },
  ]
}

export function defaultDecisions(): Decision[] {
  return [
    {
      id: 'dc1',
      text: 'Reporting: native ERPNext reports vs an external BI tool',
      owner: 'Change Shepherd',
      status: 'open',
      since: 'Phase 1',
    },
    {
      id: 'dc2',
      text: 'Infrastructure monitoring / observability tooling selection',
      owner: 'AMDG',
      status: 'open',
      since: 'Phase 1',
    },
    {
      id: 'dc3',
      text: 'Hosting target: on-prem (MSI / Hyper-V) vs Hetzner vs Azure BAA',
      owner: 'AMDG',
      status: 'open',
      since: 'Phase 1',
    },
    {
      id: 'dc4',
      text: 'GFI exact responsibility split (hosting / network / security ops)',
      owner: 'AltusKC',
      status: 'open',
      since: 'Now',
    },
  ]
}

export function defaultBlockers(): Blocker[] {
  return [
    {
      id: 'bk1',
      text: 'Awaiting final QuickBooks export (December balances) from ABES',
      owner: 'Cissy (ABES)',
      streamCode: '11.5',
      active: true,
    },
    {
      id: 'bk2',
      text: 'GFI managed-services scope unconfirmed — blocks infra handoff',
      owner: 'AltusKC',
      streamCode: '11.1',
      active: true,
    },
  ]
}

export function defaultLabels(): Label[] {
  return [
    { id: 'lab_meeting', name: 'meeting', color: '#1E8A8A' },
    { id: 'lab_urgent', name: 'urgent', color: '#E03B2E' },
    { id: 'lab_review', name: 'review', color: '#2D6FE0' },
  ]
}

export function insightsPromptDefault(): string {
  return `You are a reconciliation engine running against live connected sources. You are not a summarizer. Your job is to surface where the PLAN and the reality in the COMMS have come apart — worst first. A recap is a failure. If an item is on track and being handled, it does not appear in your output.

SOURCES
- PLAN OF RECORD: the committed workstreams, owners, dates, altitude/criticality.
- COMMS: Fathom transcripts, Slack, Gmail, Calendar.
- SCOPE: last 14 days unless an item's plan date falls outside it.

METHOD (the order is the method)
1. ENUMERATE THE PLAN FIRST — list every committed item: name, owner, date, altitude.
2. CHECK EACH ITEM OUTWARD INTO THE COMMS — an item with no traffic is the highest-value finding (blocked, abandoned, waiting, never started). State the search you ran; no search = no silence claim.
3. SWEEP THE COMMS for commitments/decisions/dates/scope that never reached the plan.
4. DIFF FOR DRIFT — dates slipped in conversation but not the plan; owner changes; abandoned approaches the plan still assumes.
5. OPEN LOOPS — unanswered direct questions; blockers mentioned more than once; decisions raised and never landed.
6. OVERLAY — tone shifts (hedging, "circling back", frustration); single-threading (one person as dependency on multiple critical items).

RANKING — order findings by plan-criticality (altitude), never by how much it was discussed. A silent critical-path item outranks a loud peripheral one.

OUTPUT — findings only, no preamble. Per finding: WHAT (one sentence), EVIDENCE (plan item + specific comm with source, or "no traffic found via [search]"), WHY IT MATTERS, MOVE (single next action + owner). Cap at the ~6 highest findings.`
}

export function getDefaults(): PmoData {
  return {
    owners: [
      { id: 'o_altus', name: 'AltusKC', role: 'Transformation lead · governs every stream', color: '#4A6491' },
      { id: 'o_nexera', name: 'Nexera', role: 'Hands-on build', color: '#3E7C6A' },
      { id: 'o_csg', name: 'Change Shepherd', role: 'Advisory · discovery & design', color: '#B07D3C' },
      { id: 'o_amdg', name: 'AMDG', role: 'Platform owner · infra & decisions', color: '#5B5391' },
      { id: 'o_abes', name: 'ABES', role: 'Client · go-live sign-off', color: '#A8553F' },
      { id: 'o_gfi', name: 'GFI', role: 'Managed service provider', color: '#5A6473' },
    ],
    phases: [
      { id: 'p1', n: 1, name: 'Financial Foundation', sub: 'Discovery · QBO migration · financial automation · documents', phi: false },
      { id: 'p2', n: 2, name: 'Operational Automation', sub: 'Automation at scale · talent intake', phi: false },
      { id: 'p3', n: 3, name: 'Clinical Foundation', sub: 'RethinkBH migration · HIPAA activates', phi: true },
      { id: 'p4', n: 4, name: 'Advanced Scheduling', sub: 'Scheduling engine · UI', phi: true },
    ],
    streams: [
      { id: 's_111', code: '11.1', name: 'Infrastructure & DevOps', ownerId: 'o_amdg', status: 'wip', phaseId: 'p1', group: 'Enabling', start: 1, span: 2, deps: [], blurb: 'Servers (practice + live), private network, TLS, secret vault, backups, CI quality gate.' },
      { id: 's_112', code: '11.2', name: 'Engineering Governance & Repo', ownerId: 'o_nexera', status: 'wip', phaseId: 'p1', group: 'Enabling', start: 1, span: 2, deps: [], blurb: 'Clean 7 inherited repos into feature modules; test-first discipline; shared tooling.' },
      { id: 's_113', code: '11.3', name: 'Discovery & Data Strategy', ownerId: 'o_csg', status: 'wip', phaseId: 'p1', group: 'Design front-end', start: 1, span: 1, deps: [], blurb: 'Map source systems, profile exports, write source-to-target mapping — the spec.' },
      { id: 's_114', code: '11.4', name: 'Architecture & Data Governance', ownerId: 'o_csg', status: 'plan', phaseId: 'p1', group: 'Design front-end', start: 1, span: 1, deps: ['11.3'], blurb: 'Chart-of-accounts, cost centers, multi-entity / MSO design — the reconciliation target.' },
      { id: 's_115', code: '11.5', name: 'Data Migration · QuickBooks', ownerId: 'o_nexera', status: 'mixed', phaseId: 'p1', group: 'Build', start: 1, span: 2, deps: ['11.3', '11.4'], blurb: 'Extract → reshape → load → reconcile to the penny. CoA map & transactions done; load in sprint.' },
      { id: 's_116', code: '11.6', name: 'Financial Automation & Reconciliation', ownerId: 'o_nexera', status: 'plan', phaseId: 'p1', group: 'Build', start: 3, span: 1, deps: ['11.5'], blurb: 'Bank / receipt intake, AI receipt OCR, safe matching, automatic journal entries.' },
      { id: 's_117', code: '11.7', name: 'OCR & Document Integration', ownerId: 'o_nexera', status: 'plan', phaseId: 'p1', group: 'Build', start: 3, span: 1, deps: ['11.5'], blurb: 'Two-way ERPNext ↔ Paperless: auto-file docs, sync contacts, dedupe, activity log.' },
      { id: 's_118', code: '11.8', name: 'Organizational Change Mgmt', ownerId: 'o_csg', status: 'wip', phaseId: 'p1', group: 'Change & Reporting', start: 1, span: 2, deps: [], blurb: 'On-site readiness at Geneva & Sycamore; phased change plan; stakeholder alignment.' },
      { id: 's_119', code: '11.9', name: 'Reporting & BI Strategy', ownerId: 'o_csg', status: 'plan', phaseId: 'p1', group: 'Change & Reporting', start: 2, span: 1, deps: ['11.4'], blurb: 'Cross-clinic P&L priorities; native vs BI-tool decision; report & data-model design.' },
      { id: 's_1110', code: '11.10', name: 'AI Talent Sourcing & Email Intake', ownerId: 'o_amdg', status: 'mixed', phaseId: 'p2', group: 'Non-financial', start: 4, span: 1, deps: [], blurb: 'Resume → candidate AI core done; email-intake path planned. Lightweight, no PHI.' },
      { id: 's_3a', code: '3a', name: 'Clinical Migration · RethinkBH', ownerId: 'o_amdg', status: 'plan', phaseId: 'p3', group: 'Clinical', start: 5, span: 1, deps: ['11.5'], blurb: 'Same engine, pointed at clinical data. First PHI → HIPAA controls activate.' },
      { id: 's_5', code: '5', name: 'Security & HIPAA Compliance', ownerId: 'o_amdg', status: 'plan', phaseId: 'p3', group: 'Clinical', start: 5, span: 1, deps: ['11.1'], blurb: 'Private-only access, named-admin audit, 2FA, sealed DB. Partly live via infra.' },
      { id: 's_2', code: '2', name: 'Advanced Scheduling & UI', ownerId: 'o_nexera', status: 'plan', phaseId: 'p4', group: 'Scheduling', start: 6, span: 1, deps: ['3a'], blurb: 'Rule-aware schedule builder, plain-English requests, reminders, scheduling screens.' },
    ],
    objectives: getObjectiveDefaults(),
    timeline: {
      buckets: ['Sprint 1', 'Sprint 2', 'Sprint 2+', 'Phase 2', 'Phase 3', 'Phase 4'],
      bands: [
        { id: 'b1', name: 'Phase 1 · Financial Foundation', start: 1, span: 3 },
        { id: 'b2', name: 'Phase 2', start: 4, span: 1 },
        { id: 'b3', name: 'Phase 3 · HIPAA', start: 5, span: 1 },
        { id: 'b4', name: 'Phase 4', start: 6, span: 1 },
      ],
      milestones: [
        { id: 'm1', label: 'Reconcile to the penny', sub: 'gates migration', bucket: 3 },
        { id: 'm2', label: 'ABES sign-off', sub: 'before go-live', bucket: 3 },
        { id: 'm3', label: 'Phase 1 complete', sub: 'unlocks P2 + P3', bucket: 4 },
        { id: 'm4', label: 'HIPAA activates', sub: 'first patient data', bucket: 5 },
      ],
    },
    gates: [
      { id: 'g1', label: 'Reconcile to the penny', note: 'CoA totals + detailed balances match QuickBooks. Gates the rest of migration.' },
      { id: 'g2', label: '18-point Definition of Done', note: 'Test-first · clean & secure · structure preserved · docs in step. Every change.' },
      { id: 'g3', label: 'ABES sign-off', note: 'Veronica + Paula approve before ANY go-live. Hard external gate.' },
    ],
    constraints: [
      { id: 'c1', text: 'One-way, export-based QBO migration — no live sync' },
      { id: 'c2', text: 'No patient data in Phase 1 or 2' },
      { id: 'c3', text: 'Chart-of-accounts reconciliation is the backbone' },
      { id: 'c4', text: 'Practice + live loaded from the same export' },
      { id: 'c5', text: 'ABES sign-off required before any go-live' },
    ],
    environment: {
      perimeterTop: 'AMDG-OWNED PLATFORM · WHERE THE SERVERS LIVE',
      perimeterRight: 'OPERATED BY GFI · MANAGED SERVICES',
      wanFw: 'Data firewall · WAN edge — perimeter boundary',
      hosting:
        'Self-hosted on AMDG-owned infrastructure. Target: on-prem (MSI / Hyper-V / Unifi). Open alternatives: Hetzner (today) · Azure (BAA) · hybrid. ERPNext runs as identical practice + live copies from the same export.',
      trustedFooter: 'ABES users reach ERPNext here via Tailscale — encrypted, invite-only access',
      abesApps: ['Finance — Veronica · Paula', 'QuickBooks (legacy)', 'Rethink', 'EasyClaim', 'Timeco / OneDigital'],
      svcTypes: [
        { id: 't_amdg', label: 'AMDG service', short: 'AMDG', desc: 'Built / owned by AMDG', color: '#4A6491' },
        { id: 't_oss', label: 'Open source', short: 'OPEN SRC', desc: 'Self-hosted OSS', color: '#3E7C6A' },
        { id: 't_cloud', label: 'External cloud', short: 'EXT CLOUD', desc: 'Third-party SaaS / LLM', color: '#B07D3C' },
      ],
      entities: [
        { id: 'e_abes', name: 'ABES Inc', role: 'Client entity (separate). Consumes ERPNext; provides source data. Geneva & Sycamore clinics.', color: '#A8553F' },
        { id: 'e_amdg', name: 'AMDG', role: 'Platform owner. Owns data & decisions; drives the modernization roadmap (innovation cycles).', color: '#4A6491' },
        { id: 'e_gfi', name: 'GFI', role: 'Managed service provider. Runs hosting, network, firewalls, backups, monitoring & security ops.', color: '#3E7C6A' },
      ],
      extCloud: {
        title: 'Internet · external cloud',
        services: [
          { id: 'x1', name: 'Claude / GPT', type: 't_cloud', note: 'LLM reasoning — escalation only, de-identified' },
          { id: 'x2', name: 'Zoom Phone', type: 't_cloud', note: 'Telephony — calls, recordings, SMS' },
          { id: 'x3', name: 'Outlook / Gmail', type: 't_cloud', note: 'Email + calendar' },
          { id: 'x4', name: 'Fireflies', type: 't_cloud', note: 'Meeting transcripts' },
          { id: 'x5', name: 'QuickBooks Online', type: 't_cloud', note: 'Legacy finance — being retired' },
        ],
      },
      zones: [
        {
          id: 'z_dmz',
          name: 'DMZ · the only zone with WAN',
          badge: 'always-on edge',
          fwAbove: '',
          services: [
            { id: 'd1', name: 'Cloud-LLM proxy', type: 't_amdg', note: 'De-identifies + logs every egress' },
            { id: 'd2', name: 'NATS bridge', type: 't_oss', note: 'Sole inter-zone messaging bridge' },
            { id: 'd3', name: 'FastAPI / MS Graph connectors', type: 't_amdg', note: 'Ingest + execute fleet' },
          ],
        },
        {
          id: 'z_ai',
          name: 'AI zone · canonical substrate — NO WAN',
          badge: 'PHI LIVES HERE',
          fwAbove: 'Data firewall · HIPAA boundary — no WAN below',
          services: [
            { id: 'a1', name: 'Hermes orchestrator', type: 't_amdg', note: 'Agent brain — only service that talks to NATS' },
            { id: 'a2', name: 'OpenClaw fleet', type: 't_amdg', note: 'Execute / automation connectors' },
            { id: 'a3', name: 'Ollama (GPU)', type: 't_oss', note: 'Local 8B/14B + bge-m3 embeddings' },
            { id: 'a4', name: 'Postgres custody', type: 't_oss', note: 'Append-only, immutable record' },
            { id: 'a5', name: 'Neo4j + Graphiti', type: 't_oss', note: 'Knowledge graph' },
            { id: 'a6', name: 'Postgres + pgvector', type: 't_oss', note: 'Vector passages · bge-m3' },
            { id: 'a7', name: 'MinIO', type: 't_oss', note: 'Object store — recordings' },
          ],
        },
        {
          id: 'z_trust',
          name: 'Trusted apps · local-first',
          badge: 'human + business layer',
          fwAbove: 'Data firewall · internal segmentation',
          services: [
            { id: 'b1', name: 'ERPNext — live', type: 't_oss', note: 'System of record · self-hosted OSS, AMDG-operated' },
            { id: 'b2', name: 'ERPNext — practice', type: 't_oss', note: 'Identical test copy from same export' },
            { id: 'b3', name: 'Paperless', type: 't_oss', note: 'Financial document management' },
            { id: 'b4', name: 'AppFlowy / AFFiNE', type: 't_oss', note: 'Local-first human layer' },
            { id: 'b5', name: 'Obsidian vault', type: 't_oss', note: 'Daily work / EA context' },
          ],
        },
      ],
    },
    plane: planeDefaults(),
    connections: {
      outlook: { connected: false, account: '' },
      teams: { connected: false, account: '' },
    },
    meName: 'You — AMDG lead',
    labels: defaultLabels(),
    todos: defaultTodos(),
    inbox: defaultInbox(),
    decisions: defaultDecisions(),
    blockers: defaultBlockers(),
    insightsPrompt: insightsPromptDefault(),
    insights: [],
    lastReportAt: Date.now() - 26 * HOUR,
  }
}
