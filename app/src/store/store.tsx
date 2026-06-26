import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import type { PmoData } from '../data/types'
import { getDefaults } from '../data/defaults'
import { migrate, normalize } from '../data/normalize'

const KEY = 'amdg_pmo_v1'

function clone<T>(v: T): T {
  return JSON.parse(JSON.stringify(v))
}

interface StoreCtx {
  data: PmoData
  /** Mutate a deep clone of the data, then persist. Mirrors the prototype's setData. */
  setData: (mut: (d: PmoData) => void) => void
  /** Replace the whole dataset (import / reset). */
  replaceData: (d: PmoData) => void
}

const Ctx = createContext<StoreCtx | null>(null)

export function StoreProvider({ children }: { children: ReactNode }) {
  const [data, setDataState] = useState<PmoData>(() => normalize(getDefaults()))
  const hydrated = useRef(false)

  // Hydrate from localStorage once on mount (matches componentDidMount).
  useEffect(() => {
    if (hydrated.current) return
    hydrated.current = true
    try {
      const r = localStorage.getItem(KEY)
      if (r) setDataState(migrate(JSON.parse(r)))
    } catch {
      /* ignore */
    }
  }, [])

  const persist = (d: PmoData) => {
    try {
      localStorage.setItem(KEY, JSON.stringify(d))
    } catch {
      /* ignore */
    }
  }

  const setData = useCallback((mut: (d: PmoData) => void) => {
    setDataState((prev) => {
      const d = clone(prev)
      mut(d)
      persist(d)
      return d
    })
  }, [])

  const replaceData = useCallback((d: PmoData) => {
    persist(d)
    setDataState(d)
  }, [])

  return <Ctx.Provider value={{ data, setData, replaceData }}>{children}</Ctx.Provider>
}

export function useStore(): StoreCtx {
  const v = useContext(Ctx)
  if (!v) throw new Error('useStore must be used within StoreProvider')
  return v
}

export { KEY }
