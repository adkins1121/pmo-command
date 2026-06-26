// Integration connector catalog. Connections are mocked (localStorage-backed)
// per the agreed scope. Claude was added per user request.

export interface IntMeta {
  name: string
  cat: string
  icon: string
  accent: string
  desc: string
  syncs: string[]
}

export const INT_META: Record<string, IntMeta> = {
  outlook: {
    name: 'Outlook',
    cat: 'Email · Microsoft 365',
    icon: 'O',
    accent: '#2D6FE0',
    desc: 'Pulls priority threads into your inbox queue. Turn any email into an ad-hoc task in one click.',
    syncs: ['Priority inbox threads', 'Email → task', 'Reply tracking'],
  },
  gmail: {
    name: 'Gmail',
    cat: 'Email · Google',
    icon: 'G',
    accent: '#D14836',
    desc: 'Surfaces starred and recent threads as action items, de-duplicated against Outlook.',
    syncs: ['Starred & recent threads', 'Email → task'],
  },
  teams: {
    name: 'Teams',
    cat: 'Chat · Microsoft',
    icon: 'T',
    accent: '#5B5391',
    desc: 'Captures @mentions and channel asks and routes them into your to-do queue.',
    syncs: ['@mentions → to-dos', 'Channel asks', 'Meeting chat'],
  },
  fireflies: {
    name: 'Fireflies',
    cat: 'Meetings · AI notetaker',
    icon: 'F',
    accent: '#C77D11',
    desc: 'Joins your calls, transcribes them, and turns the transcript into action items, decisions and blockers.',
    syncs: ['Transcripts → action items', 'Auto-decisions & blockers', 'Meeting summaries'],
  },
  plane: {
    name: 'Plane',
    cat: 'Project management · MCP',
    icon: 'P',
    accent: '#3E7C6A',
    desc: 'Connects over an MCP server for two-way sync of the program structure: initiatives, projects, cycles and states.',
    syncs: ['Connected via MCP', 'Initiatives ↔ Objectives', 'Projects ↔ Streams', 'States ↔ Status'],
  },
  claude: {
    name: 'Claude',
    cat: 'AI · Anthropic · MCP',
    icon: 'C',
    accent: '#C96442',
    desc: 'Anthropic Claude powers the reconciliation engine, the AI search assistant and generative Take-Action drafts. Connects over MCP.',
    syncs: ['Connected via MCP', 'Insights reconciliation engine', 'AI search assistant', 'Generative drafts & summaries'],
  },
  github: {
    name: 'GitHub',
    cat: 'Code · Repositories',
    icon: 'GH',
    accent: '#1B2330',
    desc: 'Links work streams to their repositories, pull requests and commit activity.',
    syncs: ['Repos ↔ Streams', 'PRs & commits', 'CI status'],
  },
  sharepoint: {
    name: 'SharePoint',
    cat: 'Files · Microsoft 365',
    icon: 'SP',
    accent: '#2D6FE0',
    desc: 'Document libraries and program sites — specs, policies and sign-off packets surface as linked files.',
    syncs: ['Document libraries', 'Linked files on streams'],
  },
  onedrive: {
    name: 'OneDrive',
    cat: 'Files · Microsoft 365',
    icon: 'OD',
    accent: '#1E5FB0',
    desc: 'Personal and shared working files attach straight to tasks and stay in sync.',
    syncs: ['Personal & shared files', 'Attach to tasks'],
  },
  m365: {
    name: 'Microsoft 365',
    cat: 'Suite · Microsoft',
    icon: 'M',
    accent: '#3E5C9A',
    desc: 'Single sign-on across the Microsoft suite — identities, calendar and the org directory.',
    syncs: ['SSO & identities', 'Calendar', 'Org directory'],
  },
  box: {
    name: 'Box',
    cat: 'Files · Content cloud',
    icon: 'B',
    accent: '#0061D5',
    desc: 'Secure content cloud — shared folders, signed documents and external-partner file exchange attach straight to tasks.',
    syncs: ['Shared folders ↔ Tasks', 'Box Sign packets', 'External file exchange'],
  },
}

export const INT_ORDER = [
  'm365',
  'outlook',
  'teams',
  'sharepoint',
  'onedrive',
  'box',
  'gmail',
  'fireflies',
  'claude',
  'plane',
  'github',
]

export const MS_SVCS = ['m365', 'outlook', 'teams', 'sharepoint', 'onedrive']

/** AI-assistant source name map (used when synthesizing connector results). */
export const AI_NAME_MAP: Record<string, string> = {
  outlook: 'Outlook',
  gmail: 'Gmail',
  teams: 'Teams',
  fireflies: 'Fireflies',
  claude: 'Claude',
  plane: 'Plane',
  github: 'GitHub',
  sharepoint: 'SharePoint',
  onedrive: 'OneDrive',
  m365: 'Microsoft 365',
  box: 'Box',
}
