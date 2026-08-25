import { useCallback, useState } from 'react'

export function useAsyncAction(action) {
  const [status, setStatus] = useState('idle')
  const [error, setError] = useState(null)

  const run = useCallback(
    async (...args) => {
      setStatus('pending')
      setError(null)
      try {
        const result = await action(...args)
        setStatus('success')
        return result
      } catch (err) {
        setStatus('error')
        setError(err)
        throw err
      }
    },
    [action],
  )

  const reset = useCallback(() => {
    setStatus('idle')
    setError(null)
  }, [])

  return { status, error, run, reset }
}
