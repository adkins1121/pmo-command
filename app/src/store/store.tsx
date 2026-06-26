import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import type { PmoData } from '../data/types'
import { getDefaults } from '../data/defaults'
import { migrate, normalize } from '../data/normalize'
import { RemotePersistence } from '../lib/persistence'
import type { PersistenceAdapter, RemoteState } from '../lib/persistence'

const KEY = 'amdg_pmo_v1'
const SAVE_DEBOUNCE = 1200

function clone<T>(v: T): T {
  return JSON.parse(JSON.stringify(v))
}

export type SyncStatus = 'off' | 'idle' | 'saving' | 'offline' | 'conflict'

export interface SyncApi {
  /** 'off' = no remote backend; otherwise live state of the autosync. */
  status: SyncStatus
  lastSyncAt: number | null
  conflictRemote: RemoteState | null
  /** Resolve a save conflict: keep my in-flight copy, or load theirs. */
  resolveConflict: (keep: 'mine' | 'theirs') => void
  /** Force an immediate push (skips the debounce). */
  pushNow: () => void
}

interface StoreCtx {
  data: PmoData
  /** Mutate a deep clone of the data, then persist (local + remote). */
  setData: (mut: (d: PmoData) => void) => void
  /** Replace the whole dataset (import / reset). */
  replaceData: (d: PmoData) => void
  sync: SyncApi
}

const Ctx = createContext<StoreCtx | null>(null)

export function StoreProvider({ children, adapter }: { children: ReactNode; adapter?: PersistenceAdapter }) {
  const [data, setDataState] = useState<PmoData>(() => normalize(getDefaults()))
  const hydrated = useRef(false)

  const persistence = useMemo<PersistenceAdapter>(() => adapter || new RemotePersistence(), [adapter])

  // Refs read inside async callbacks (avoid stale closures + extra renders).
  const enabledRef = useRef(false)
  const remoteRevRef = useRef(0)
  const latestRef = useRef<PmoData>(data)
  const savingRef = useRef(false)
  const conflictRef = useRef<RemoteState | null>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const [status, setStatus] = useState<SyncStatus>('off')
  const [lastSyncAt, setLastSyncAt] = useState<number | null>(null)
  const [conflictRemote, setConflictRemote] = useState<RemoteState | null>(null)

  const persistLocal = (d: PmoData) => {
    try {
      localStorage.setItem(KEY, JSON.stringify(d))
    } catch {
      /* ignore quota / privacy mode */
    }
  }
  const setConflict = (c: RemoteState | null) => {
    conflictRef.current = c
    setConflictRemote(c)
  }
  const adopt = (remote: RemoteState) => {
    const merged = migrate(remote.data)
    remoteRevRef.current = remote.rev
    latestRef.current = merged
    setDataState(merged)
    persistLocal(merged)
    setLastSyncAt(Date.now())
    return merged
  }

  // Push the latest snapshot to the remote (optimistic concurrency).
  const flush = useCallback(async () => {
    if (!enabledRef.current || savingRef.current || conflictRef.current) return
    savingRef.current = true
    setStatus('saving')
    try {
      const res = await persistence.save(latestRef.current, remoteRevRef.current)
      if (res.ok) {
        remoteRevRef.current = res.rev
        setStatus('idle')
        setLastSyncAt(Date.now())
      } else {
        setConflict(res.conflict)
        setStatus('conflict')
      }
    } catch {
      setStatus('offline')
    } finally {
      savingRef.current = false
    }
  }, [persistence])

  const scheduleSave = useCallback(() => {
    if (!enabledRef.current) return
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => void flush(), SAVE_DEBOUNCE)
  }, [flush])

  const setData = useCallback(
    (mut: (d: PmoData) => void) => {
      setDataState((prev) => {
        const d = clone(prev)
        mut(d)
        if (!d.syncState) d.syncState = { pendingChanges: 0, rev: 0 }
        d.syncState.rev = (d.syncState.rev || 0) + 1
        d.syncState.pendingChanges = Math.max(0, d.syncState.rev - (d.syncState.syncedRev || 0))
        persistLocal(d)
        latestRef.current = d
        return d
      })
      scheduleSave()
    },
    [scheduleSave],
  )

  const replaceData = useCallback(
    (d: PmoData) => {
      persistLocal(d)
      latestRef.current = d
      setDataState(d)
      scheduleSave()
    },
    [scheduleSave],
  )

  const resolveConflict = useCallback(
    (keep: 'mine' | 'theirs') => {
      const remote = conflictRef.current
      if (!remote) return
      setConflict(null)
      if (keep === 'theirs') {
        adopt(remote)
        setStatus('idle')
      } else {
        // Keep mine: re-base on the remote rev so the next save matches + wins.
        remoteRevRef.current = remote.rev
        setStatus('idle')
        if (timerRef.current) clearTimeout(timerRef.current)
        void flush()
      }
    },
    [flush],
  )

  const pushNow = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current)
    void flush()
  }, [flush])

  // Hydrate: localStorage first (instant), then reconcile with the remote.
  useEffect(() => {
    if (hydrated.current) return
    hydrated.current = true
    try {
      const r = localStorage.getItem(KEY)
      if (r) {
        const local = migrate(JSON.parse(r))
        setDataState(local)
        latestRef.current = local
      }
    } catch {
      /* ignore */
    }
    ;(async () => {
      let available = false
      try {
        available = await persistence.available()
      } catch {
        available = false
      }
      if (!available) {
        setStatus('off')
        return
      }
      enabledRef.current = true
      try {
        const remote = await persistence.load()
        if (remote && remote.data != null) {
          adopt(remote)
          setStatus('idle')
        } else {
          // Remote is empty — seed it with whatever we have locally.
          const res = await persistence.save(latestRef.current, 0)
          if (res.ok) {
            remoteRevRef.current = res.rev
            setLastSyncAt(Date.now())
            setStatus('idle')
          } else if (res.conflict) {
            adopt(res.conflict)
            setStatus('idle')
          }
        }
      } catch {
        setStatus('offline')
      }
    })()
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [persistence])

  const sync = useMemo<SyncApi>(
    () => ({ status, lastSyncAt, conflictRemote, resolveConflict, pushNow }),
    [status, lastSyncAt, conflictRemote, resolveConflict, pushNow],
  )

  const value = useMemo<StoreCtx>(() => ({ data, setData, replaceData, sync }), [data, setData, replaceData, sync])

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useStore(): StoreCtx {
  const v = useContext(Ctx)
  if (!v) throw new Error('useStore must be used within StoreProvider')
  return v
}

export function useSync(): SyncApi {
  return useStore().sync
}

/** Live brand colors from admin settings, with safe defaults. */
export function useTheme(): { primary: string; accent: string } {
  const t = useStore().data.adminSettings?.theme
  return { primary: t?.primary || '#4A6491', accent: t?.accent || '#1B9C8E' }
}

export { KEY }
