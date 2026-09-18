import { useCallback, useEffect, useRef, useState } from 'react'

export default function useAsyncData(loader, deps = []) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState(null)
  const [refreshKey, setRefreshKey] = useState(0)
  const hasDataRef = useRef(false)

  const refresh = useCallback(() => setRefreshKey((value) => value + 1), [])

  useEffect(() => {
    let active = true
    const isRefresh = hasDataRef.current

    if (isRefresh) setRefreshing(true)
    else setLoading(true)
    setError(null)

    Promise.resolve()
      .then(loader)
      .then((value) => {
        if (!active) return
        setData(value)
        hasDataRef.current = value !== null && value !== undefined
      })
      .catch((err) => {
        if (active) setError(err)
      })
      .finally(() => {
        if (!active) return
        setLoading(false)
        setRefreshing(false)
      })

    return () => {
      active = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, refreshKey])

  return { data, loading, refreshing, error, refresh }
}
