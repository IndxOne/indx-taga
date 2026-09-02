import { useEffect, useState } from 'react'
import { getDriverLocationService } from '../services/driverLocationService'
import { isDemoMode } from '../services/runtimeConfig'

const ACTIVE_STATUSES = new Set(['assigned', 'arriving', 'arrived', 'in_progress'])

export default function DriverLocationTracker({ rideId, rideStatus }) {
  const [state, setState] = useState({ status: 'idle', message: '' })
  const trackable = !isDemoMode && Boolean(rideId) && ACTIVE_STATUSES.has(rideStatus)

  useEffect(() => {
    if (!trackable) return undefined

    let stopped = false
    let stop
    const reportState = (nextState) => {
      void Promise.resolve().then(() => {
        if (!stopped) setState(nextState)
      })
    }
    try {
      stop = getDriverLocationService().watchAndPublish({
        rideId,
        onLocation: () => {
          reportState({ status: 'tracking', message: 'Position GPS synchronisée.' })
        },
        onPublished: () => {
          reportState({ status: 'tracking', message: 'Position GPS synchronisée.' })
        },
        onError: (error) => {
          reportState({ status: 'error', message: error.message || 'Le suivi GPS est indisponible.' })
        },
      })
    } catch (error) {
      reportState({ status: 'error', message: error.message || 'Le suivi GPS est indisponible.' })
    }

    return () => {
      stopped = true
      stop?.()
    }
  }, [rideId, rideStatus, trackable])

  if (!trackable || state.status === 'idle' || !state.message) return null

  return (
    <p
      role={state.status === 'error' ? 'alert' : 'status'}
      aria-live="polite"
      className={`rounded-lg px-3 py-2 text-center text-xs ${state.status === 'error' ? 'bg-red-50 text-red-600' : 'bg-taga-blue/5 text-taga-blue'}`}
    >
      {state.message}
    </p>
  )
}
