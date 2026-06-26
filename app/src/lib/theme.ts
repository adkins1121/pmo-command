// The prototype's "Accent" tweak defaults to Indigo. Kept as a single source of
// truth so the brand mark, active nav item, and Edit button stay in sync.
export const ACCENT = '#4A6491'

export const VIEWS: { id: import('../data/types').ViewId; label: string }[] = [
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'focus', label: 'My Focus' },
  { id: 'standup', label: 'Daily Standup' },
  { id: 'activity', label: 'Activity Feed' },
  { id: 'objectives', label: 'Objectives' },
  { id: 'board', label: 'Board' },
  { id: 'timeline', label: 'Timeline' },
  { id: 'deps', label: 'Dependencies' },
  { id: 'env', label: 'Environment' },
  { id: 'insights', label: 'Insights' },
  { id: 'integrations', label: 'Integrations' },
]
