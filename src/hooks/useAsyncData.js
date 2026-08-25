import { useCallback, useEffect, useState } from 'react'

const DEFAULT_IS_EMPTY = () => false

export function useAsyncData(loader, { isEmpty = DEFAULT_IS_EMPTY } = {}) {
  const [status, setStatus] = useState('loading')
  const [data, setData] = useState(null)
  const [error, setError] = useState(null)

  const load = useCallback(() => {
    setStatus('loading')
    setError(null)
    return loader()
      .then((result) => {
        setData(result)
        setStatus(isEmpty(result) ? 'empty' : 'success')
      })
      .catch((err) => {
        setError(err)
        setStatus(err?.kind === 'unavailable' ? 'unavailable' : 'error')
      })
  }, [loader, isEmpty])

  useEffect(() => {
    load()
  }, [load])

  return { status, data, error, retry: load }
}
