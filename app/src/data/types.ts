// AMDG PMO data model — ported faithfully from the Claude Design prototype.

export type Status = 'done' | 'wip' | 'mixed' | 'plan' | 'risk'
export type WorkType = 'Epic' | 'Task' | 'Milestone'
export type Priority = 'high' | 'med' | 'low'
export type TodoSource = 'manual' | 'email' | 'teams' | 'plane'

export interface Owner {
  id: string
  name: string
  role: string
  color: string
}

export interface Phase {
  id: string
  n: number
  name: string
  sub: string
  phi: boolean
}

export interface Subtask {
  id: string
  text: string
  done: boolean
}

export interface Comment {
  id: string
  text: string
  at: number
}

export interface Stream {
  id: string
  code: string
  name: string
  ownerId: string
  status: Status
  phaseId: string
  group: string
  start: number
  span: number
  deps: string[]
  blurb: string
  objectiveId?: string
  planeProjectId?: string
  mine?: boolean
  committed?: boolean
  completedAt?: number | null
  workType?: WorkType
  labelIds?: string[]
  subtasks?: Subtask[]
  comments?: Comment[]
  /** per-lens saved positions on the dependency canvas */
  depPos?: Record<string, { x: number; y: number }>
  scheduledDate?: string
  estTime?: string
}

export interface Objective {
  id: string
  code: string
  name: string
  outcome: string
  color: string
  planeInitiativeId: string
}

/** Provenance for anything generated from a connected source. */
export interface SourceRef {
  /** Human label of the originating source, e.g. "Fireflies", "Outlook", "Claude". */
  label: string
  /** Deep link back to the originating artifact (thread, transcript, Plane item…). */
  url?: string
  /** Short descriptor of the specific artifact, e.g. "Re: QBO export". */
  ref?: string
}

export interface Todo {
  id: string
  text: string
  source: TodoSource
  priority: Priority
  done: boolean
  committed?: boolean
  completedAt?: number | null
  createdAt?: number
  desc?: string
  phaseId?: string
  objectiveId?: string
  ownerId?: string
  workType?: WorkType
  /** Where this task came from (required for generated/connector-fed tasks). */
  sourceRef?: SourceRef
}

export interface InboxMsg {
  id: string
  subject: string
  from: string
  snippet: string
  priority: Priority
  unread: boolean
  age: string
  link?: string
}

export interface Decision {
  id: string
  text: string
  owner: string
  status: 'open' | 'resolved'
  since: string
}

export interface Blocker {
  id: string
  text: string
  owner: string
  streamCode: string
  active: boolean
}

export interface Label {
  id: string
  name: string
  color: string
}

export interface Gate {
  id: string
  label: string
  note: string
}

export interface Constraint {
  id: string
  text: string
}

export interface Connection {
  connected: boolean
  account: string
}

export interface PlaneConfig {
  workspaceSlug: string
  baseUrl: string
  structure: string
  stateMap: Record<string, string>
}

export interface SvcType {
  id: string
  label: string
  short: string
  desc: string
  color: string
}

export interface Service {
  id: string
  name: string
  type: string
  note: string
}

export interface Zone {
  id: string
  name: string
  badge: string
  fwAbove: string
  services: Service[]
}

export interface Entity {
  id: string
  name: string
  role: string
  color: string
}

export interface EnvNote {
  id: string
  text: string
  color: string
  style: 'solid' | 'striped'
}

export interface ExtraFw {
  id: string
  label: string
}

export interface Environment {
  perimeterTop: string
  perimeterRight: string
  wanFw: string
  hosting: string
  trustedFooter: string
  abesApps: string[]
  svcTypes: SvcType[]
  entities: Entity[]
  extCloud: { title: string; services: Service[] }
  zones: Zone[]
  canvasPos?: Record<string, { x: number; y: number }>
  canvasSize?: Record<string, { w: number; h?: number }>
  fwLocked?: Record<string, boolean>
  /** Per-element size lock — when set, the resize handles are disabled for that id. */
  lockSize?: Record<string, boolean>
  notes?: EnvNote[]
  extraFw?: ExtraFw[]
}

/* ------------------------------------------------------------------ *
 * Plan ↔ environment association (AI coverage)
 * ------------------------------------------------------------------ */

/** A normalized, matchable view of any dataset entity the plan is built from. */
export interface PlanItem {
  id: string
  kind: 'objective' | 'stream' | 'phase' | 'vendor' | 'environment' | 'sync'
  title: string
  description?: string
  tags?: string[]
  vendor?: string
  phase?: string
  metadata?: Record<string, unknown>
}

export type PlanLinkSource = 'ai' | 'manual'
export type PlanLinkStatus = 'linked' | 'partial' | 'unaddressed' | 'rejected'

/** A single association between an environment/service card and a plan item. */
export interface PlanLink {
  id: string
  /** Environment service id (e.g. "x1", "d1", "a1", "b1"). */
  canvasItemId: string
  planItemId: string
  source: PlanLinkSource
  confidence: number
  status: PlanLinkStatus
  rationale?: string
  createdAt: string
  updatedAt: string
}

/** Roll-up coverage state for a single environment item. */
export type CoverageStatus = 'covered' | 'partial' | 'missing' | 'review'

/* ------------------------------------------------------------------ *
 * Admin-managed configuration
 * ------------------------------------------------------------------ */

export type ConflictStrategy = 'lww' | 'review'

export interface AdminSettings {
  general: {
    programName: string
    autoAnalyze: boolean
  }
  theme: {
    /** Primary brand color — brand mark, active nav, primary buttons. */
    primary: string
    /** Accent color — AI/secondary highlights. */
    accent: string
  }
  canvas: {
    minWidth: number
    minHeight: number
    gridSize: number
    snapDefault: boolean
  }
  matcher: {
    /** Relative weights for the heuristic scorer (0..1 each). */
    weightTitle: number
    weightKeyword: number
    weightVendor: number
    weightZone: number
  }
  coverage: {
    /** Confidence at/above which an item is considered Covered (0..1). */
    coverThreshold: number
    /** Confidence at/above which a match is surfaced for review (0..1). */
    reviewThreshold: number
  }
  sync: {
    adapter: 'local' | 'remote'
    endpoint: string
    autoPush: boolean
  }
  governance: {
    /** When true, AI re-analysis never overwrites manual links. */
    lockManualLinks: boolean
    conflictStrategy: ConflictStrategy
  }
}

export interface SyncState {
  lastSyncAt?: string
  pendingChanges: number
  lastError?: string
  /** Monotonic local revision — bumped on every persisted mutation. */
  rev: number
  /** Revision at the last successful push — pending = rev − syncedRev. */
  syncedRev?: number
}

/** The serializable slice that the sync layer pulls / pushes. */
export interface AppStatePayload {
  canvasItems: import('../lib/canvasItems').CanvasItem[]
  planItems: PlanItem[]
  planLinks: PlanLink[]
  adminSettings: AdminSettings
  metadata: {
    version: number
    updatedAt: string
    source: string
  }
}

export interface TimelineData {
  buckets: string[]
  bands: { id: string; name: string; start: number; span: number }[]
  milestones: { id: string; label: string; sub: string; bucket: number }[]
}

export interface Insight {
  what: string
  evidence: string
  why: string
  move: string
  altitude: 'critical' | 'high' | 'medium'
  streamId?: string
  /** Provenance — generated insights must cite the source that produced them. */
  sourceRef?: SourceRef
}

export interface DepNote {
  id: string
  text: string
  color: string
  style: 'solid' | 'striped'
  x: number
  y: number
  w: number
  h: number
}

export interface PmoData {
  owners: Owner[]
  phases: Phase[]
  streams: Stream[]
  objectives: Objective[]
  timeline: TimelineData
  gates: Gate[]
  constraints: Constraint[]
  environment: Environment
  plane: PlaneConfig
  connections: Record<string, Connection>
  meName: string
  labels: Label[]
  todos: Todo[]
  inbox: InboxMsg[]
  decisions: Decision[]
  blockers: Blocker[]
  insightsPrompt: string
  insights: Insight[]
  insightsAt?: number
  lastReportAt: number
  depNotes?: DepNote[]
  /** AI + manually-curated associations between env items and plan items. */
  planLinks?: PlanLink[]
  /** When the last "Analyze plan coverage" run completed. */
  planAnalyzedAt?: number
  /** Admin-managed feature, rules, mapping and sync configuration. */
  adminSettings?: AdminSettings
  /** Local sync bookkeeping (last synced, pending changes…). */
  syncState?: SyncState
}

export type ViewId =
  | 'dashboard'
  | 'focus'
  | 'standup'
  | 'activity'
  | 'objectives'
  | 'board'
  | 'timeline'
  | 'deps'
  | 'env'
  | 'insights'
  | 'integrations'
  | 'admin'
