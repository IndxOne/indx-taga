import { useEffect, useState } from 'react'
import { useAppStore } from '../store/useAppStore'
import SessionExpiredOverlay from './states/SessionExpiredOverlay'

export default function SessionGuard({ children }) {
  const sessionExpiresAt = useAppStore((state) => state.sessionExpiresAt)
  const [isExpired, setIsExpired] = useState(
    () => sessionExpiresAt > 0 && Date.now() > sessionExpiresAt,
  )

  useEffect(() => {
    if (!sessionExpiresAt) {
      setIsExpired(false)
      return undefined
    }
    setIsExpired(Date.now() > sessionExpiresAt)
    const timer = setInterval(() => {
      setIsExpired(Date.now() > sessionExpiresAt)
    }, 5000)
    return () => clearInterval(timer)
  }, [sessionExpiresAt])

  return (
    <div className="relative flex flex-1 flex-col">
      {children}
      {isExpired && <SessionExpiredOverlay />}
    </div>
  )
}
