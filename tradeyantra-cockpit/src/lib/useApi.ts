import { useCallback, useEffect, useRef, useState } from 'react'
import { ApiError } from './api'

export interface PollState<T> {
  data: T | null
  error: ApiError | null
  loading: boolean
  refresh: () => void
}

// Polls `fn` every `intervalMs`, pausing while the tab is hidden (no point
// hammering the broker when nobody's looking). Keeps the last good data on
// transient errors so the UI doesn't flicker between values and error states.
export function usePoll<T>(fn: () => Promise<T>, intervalMs = 5000): PollState<T> {
  const [data, setData] = useState<T | null>(null)
  const [error, setError] = useState<ApiError | null>(null)
  const [loading, setLoading] = useState(true)
  const fnRef = useRef(fn)
  fnRef.current = fn

  const tick = useCallback(async () => {
    try {
      const d = await fnRef.current()
      setData(d)
      setError(null)
    } catch (e) {
      setError(e instanceof ApiError ? e : new ApiError('broker', String(e)))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    setLoading(true)
    tick() // always run the initial fetch, even if the tab starts hidden
    // Only the recurring interval is gated on visibility — no point polling the
    // broker while the tab is in the background; we refresh on return instead.
    const id = setInterval(() => { if (!document.hidden) tick() }, intervalMs)
    const onVisible = () => { if (!document.hidden) tick() }
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      clearInterval(id)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [tick, intervalMs])

  return { data, error, loading, refresh: tick }
}
