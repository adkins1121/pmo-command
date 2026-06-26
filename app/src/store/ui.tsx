import { createContext, useCallback, useContext, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import type { ViewId } from '../data/types'

export type ItemKind = 'stream' | 'todo' | 'service'

export interface LabelEdit {
  id: string | null
  name: string
  color: string
}

export interface UIState {
  view: ViewId
  navOpen: boolean
  headerMenuOpen: boolean
  searchQ: string

  // global filters
  fPhase: string
  fOwner: string
  fStatus: string
  fObjective: string
  fWorkType: string
  fGroup: string
  activeFilters: string[]
  filterOpen: boolean
  filterAddOpen: boolean

  // edit drawer
  edit: boolean
  editCollapsed: boolean
  drawerTab: string

  // item modal
  itemId: string | null
  itemKind: ItemKind
  selectedId: string | null
  labelPickerOpen: boolean
  labelEdit: LabelEdit | null

  // my-focus / standup ephemerals
  expandedTodoId: string | null
  expandedId: string | null
  fSuOwner: string
  fSuType: string
  fSuSource: string

  // AI assistant flyout
  aiOpen: boolean
  aiQuery: string
  aiLoading: boolean
  aiError: string
  aiAnswer: string
  aiResults: AiResult[] | null
}

export interface AiResult {
  source: string
  title: string
  snippet: string
  date: string
}

const initial: UIState = {
  view: 'focus',
  navOpen: false,
  headerMenuOpen: false,
  searchQ: '',
  fPhase: 'all',
  fOwner: 'all',
  fStatus: 'all',
  fObjective: 'all',
  fWorkType: 'all',
  fGroup: 'all',
  activeFilters: ['phase', 'vendor', 'status'],
  filterOpen: false,
  filterAddOpen: false,
  edit: false,
  editCollapsed: false,
  drawerTab: 'streams',
  itemId: null,
  itemKind: 'stream',
  selectedId: null,
  labelPickerOpen: false,
  labelEdit: null,
  expandedTodoId: null,
  expandedId: null,
  fSuOwner: 'mine',
  fSuType: 'all',
  fSuSource: 'all',
  aiOpen: false,
  aiQuery: '',
  aiLoading: false,
  aiError: '',
  aiAnswer: '',
  aiResults: null,
}

interface UICtx extends UIState {
  set: (patch: Partial<UIState>) => void
  update: (fn: (s: UIState) => Partial<UIState>) => void
}

const Ctx = createContext<UICtx | null>(null)

export function UIProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<UIState>(initial)
  const set = useCallback((patch: Partial<UIState>) => setState((s) => ({ ...s, ...patch })), [])
  const update = useCallback(
    (fn: (s: UIState) => Partial<UIState>) => setState((s) => ({ ...s, ...fn(s) })),
    [],
  )
  const value = useMemo(() => ({ ...state, set, update }), [state, set, update])
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useUI(): UICtx {
  const v = useContext(Ctx)
  if (!v) throw new Error('useUI must be used within UIProvider')
  return v
}
