import { useCallback, useEffect, useRef, useState } from 'react'
import { useAppStore } from '../store/useAppStore'
import { getDispatchService } from '../services/dispatchService'
import { getRideRealtimeService } from '../services/rideRealtimeService'
import { mapServerRideToStore } from '../services/rideMapping'
import { isDemoMode } from '../services/runtimeConfig'
import { ROUTES } from '../navigation/routes'

const ACTIVE_STATUSES = new Set(['assigned', 'arriving', 'arrived', 'in_progress'])

export function driverRouteForStatus(status) {
  if (status === 'in_progress') return ROUTES.driverRideInProgress
  if (status === 'completed') return ROUTES.driverPayoutRecap
  return ROUTES.driverNavigation
}

// Course chauffeur en mode réel : le serveur est l'unique autorité. Au montage
// la course est relue côté serveur (reprise après rechargement) ; chaque
// transition passe par la RPC et le store ne reçoit que sa réponse.
export function useDriverRide() {
  const ride = useAppStore((state) => state.ride)
  const rideId = ride.id
  const setRide = useAppStore((state) => state.setRide)
  const setRideStatus = useAppStore((state) => state.setRideStatus)
  const setDriverAvailable = useAppStore((state) => state.setDriverAvailable)
  const [isRestoring, setIsRestoring] = useState(!isDemoMode)
  const [isAdvancing, setIsAdvancing] = useState(false)
  const [error, setError] = useState('')
  const [hasActiveRide, setHasActiveRide] = useState(false)
  const inFlightRef = useRef(false)

  const applyServerRide = useCallback((serverRide) => {
    setRide(mapServerRideToStore(serverRide))
    setRideStatus(serverRide.status)
    setHasActiveRide(ACTIVE_STATUSES.has(serverRide.status))
  }, [setRide, setRideStatus])

  const restore = useCallback(async () => {
    const serverRide = await getRideRealtimeService().getActiveDriverRide()
    if (serverRide) applyServerRide(serverRide)
    else setHasActiveRide(false)
    return serverRide
  }, [applyServerRide])

  useEffect(() => {
    if (isDemoMode) return undefined
    let active = true
    const load = async () => {
      try {
        await restore()
      } catch (restoreError) {
        if (active) setError(restoreError.message || 'La course n’a pas pu être récupérée.')
      } finally {
        if (active) setIsRestoring(false)
      }
    }
    void load()
    return () => {
      active = false
    }
  }, [restore])

  const advance = useCallback(async (toStatus) => {
    if (inFlightRef.current || !rideId) return null
    inFlightRef.current = true
    setIsAdvancing(true)
    setError('')
    try {
      const serverRide = await getDispatchService().advanceRide(rideId, toStatus)
      applyServerRide(serverRide)
      // Le serveur libère le chauffeur à la fin de course (hors ligne).
      if (serverRide.status === 'completed') setDriverAvailable(false)
      return serverRide
    } catch (advanceError) {
      setError(advanceError.message || 'La course n’a pas pu avancer. Réessaie.')
      // Statut local peut-être périmé : le serveur reste la référence.
      await restore().catch(() => {})
      return null
    } finally {
      inFlightRef.current = false
      setIsAdvancing(false)
    }
  }, [applyServerRide, restore, rideId, setDriverAvailable])

  return { ride, hasActiveRide, isRestoring, isAdvancing, error, advance }
}
