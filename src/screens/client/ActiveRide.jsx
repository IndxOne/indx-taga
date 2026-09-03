import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAppStore } from '../../store/useAppStore'
import MapProvider from '../../components/MapProvider'
import DriverInfoCard from '../../components/DriverInfoCard'
import PrimaryButton from '../../components/PrimaryButton'
import ClientRideMap from '../../components/ClientRideMap'
import { getDispatchService } from '../../services/dispatchService'
import { getRideService } from '../../services/rideService'
import { getDriverLocationRemainingMs, getRideRealtimeService } from '../../services/rideRealtimeService'
import { isDemoMode } from '../../services/runtimeConfig'

const STATUS_LABEL = {
  requested: 'Demande enregistrée',
  searching: "Recherche d'un chauffeur...",
  assigned: 'Chauffeur trouvé',
  arriving: 'Chauffeur en approche',
  driver_en_route: 'Chauffeur en approche · 3 min',
  arrived: 'Chauffeur arrivé',
  in_progress: 'Course en cours',
  no_driver: 'Aucun chauffeur disponible',
}

const NEXT_STATUS = {
  searching: 'driver_en_route',
  driver_en_route: 'arrived',
  arrived: 'in_progress',
}

const REAL_STATUS_COPY = {
  requested: 'Votre demande est enregistrée. La recherche va démarrer.',
  searching: 'Recherche d’un chauffeur en cours.',
  assigned: 'Un chauffeur vous a été attribué. Son approche sera synchronisée ici.',
  arriving: 'Votre chauffeur est en approche.',
  arrived: 'Votre chauffeur est arrivé au point de prise en charge.',
  in_progress: 'Votre course est en cours.',
  completed: 'Course terminée.',
  cancelled: 'Cette course a été annulée.',
  no_driver: 'Aucun chauffeur n’est disponible pour le moment.',
}

const SEARCH_STATUSES = new Set(['requested', 'searching'])
const DRIVER_ASSIGNED_STATUSES = new Set(['assigned', 'arriving', 'driver_en_route', 'arrived', 'in_progress', 'completed'])

function mapRealtimeRideToStore(backendRide) {
  return {
    id: backendRide.id,
    passengerId: backendRide.passengerId,
    driverId: backendRide.driverId,
    pickup: backendRide.pickup,
    destination: backendRide.destination,
    pickupLabel: backendRide.pickupLabel,
    dropoffLabel: backendRide.dropoffLabel,
    rideType: backendRide.rideType,
    scheduledAt: backendRide.scheduledAt,
    status: backendRide.status,
    estimatedPrice: backendRide.estimatedPrice,
    assignedAt: backendRide.assignedAt,
    dispatchDeadlineAt: backendRide.dispatchDeadlineAt,
    createdAt: backendRide.createdAt,
    updatedAt: backendRide.updatedAt,
  }
}

export default function ActiveRide() {
  const navigate = useNavigate()
  const ride = useAppStore((state) => state.ride)
  const driver = useAppStore((state) => state.driver)
  const rideStatus = useAppStore((state) => state.rideStatus)
  const updateRide = useAppStore((state) => state.updateRide)
  const setRideStatus = useAppStore((state) => state.setRideStatus)
  const [contactNotice, setContactNotice] = useState('')
  const [dispatchError, setDispatchError] = useState('')
  const [actionError, setActionError] = useState('')
  const [isCancelling, setIsCancelling] = useState(false)
  const [isRetrying, setIsRetrying] = useState(false)
  const [realtimeError, setRealtimeError] = useState('')
  const [driverLocation, setDriverLocation] = useState(null)
  const [isRestoringRide, setIsRestoringRide] = useState(!isDemoMode)
  const dispatchStartedRideIdRef = useRef(null)
  const retryingRideIdRef = useRef(null)
  const displayedRideStatus = isDemoMode ? rideStatus : ride?.status ?? rideStatus
  const showDriverDetails = isDemoMode && DRIVER_ASSIGNED_STATUSES.has(displayedRideStatus)

  useEffect(() => {
    if (!driverLocation) return undefined
    const expiryTimer = setTimeout(() => setDriverLocation(null), getDriverLocationRemainingMs(driverLocation) + 1)
    return () => clearTimeout(expiryTimer)
  }, [driverLocation])

  useEffect(() => {
    if (isDemoMode || !ride?.id || rideStatus !== 'requested') return undefined
    if (dispatchStartedRideIdRef.current === ride.id) return undefined

    let cancelled = false
    dispatchStartedRideIdRef.current = ride.id
    getDispatchService().requestRideDispatch(ride.id)
      .then((dispatchedRide) => {
        if (cancelled) return
        updateRide({
          id: dispatchedRide.id,
          status: dispatchedRide.status,
          driverId: dispatchedRide.driverId,
          dispatchDeadlineAt: dispatchedRide.dispatchDeadlineAt,
          assignedAt: dispatchedRide.assignedAt,
        })
        setRideStatus(dispatchedRide.status)
      })
      .catch((error) => {
        dispatchStartedRideIdRef.current = null
        if (!cancelled) setDispatchError(error.message || 'La recherche d’un chauffeur n’a pas pu démarrer.')
      })

    return () => {
      cancelled = true
    }
  }, [ride, rideStatus, setRideStatus, updateRide])

  useEffect(() => {
    if (isDemoMode || rideStatus !== 'searching' || !ride?.id || !ride.dispatchDeadlineAt) return undefined

    let cancelled = false
    const remaining = Math.max(0, Date.parse(ride.dispatchDeadlineAt) - Date.now())
    const timer = setTimeout(async () => {
      try {
        const expiredRide = await getDispatchService().requestRideDispatch(ride.id)
        if (cancelled) return
        updateRide({
          id: expiredRide.id,
          status: expiredRide.status,
          driverId: expiredRide.driverId,
          dispatchDeadlineAt: expiredRide.dispatchDeadlineAt,
          assignedAt: expiredRide.assignedAt,
        })
        setRideStatus(expiredRide.status)
      } catch (error) {
        if (!cancelled) setDispatchError(error.message || 'La recherche n’a pas pu être actualisée.')
      }
    }, remaining + 1)

    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [ride?.dispatchDeadlineAt, ride?.id, rideStatus, setRideStatus, updateRide])

  useEffect(() => {
    if (isDemoMode) return undefined

    let cancelled = false
    let unsubscribe
    const realtime = getRideRealtimeService()
    const applyRide = (serverRide) => {
      if (cancelled || !serverRide) return
      updateRide(mapRealtimeRideToStore(serverRide))
      setRideStatus(serverRide.status)
    }

    const restoreActiveRide = async () => {
      try {
        const activeRide = await realtime.getActiveRide()
        if (cancelled) return

        if (!activeRide) {
          setIsRestoringRide(false)
          navigate('/client/home', { replace: true })
          return
        }

        applyRide(activeRide)
        const location = await realtime.getDriverLocation(activeRide.id)
        if (cancelled) return
        setDriverLocation(location)

        unsubscribe = realtime.subscribeToRide(activeRide.id, {
          onRideChange: applyRide,
          onDriverLocationChange: (nextLocation) => {
            if (!cancelled) setDriverLocation(nextLocation || null)
          },
          onError: (error) => {
            if (!cancelled) setRealtimeError(error.message || 'La synchronisation temps réel est indisponible.')
          },
        })
      } catch (error) {
        if (!cancelled) setRealtimeError(error.message || 'La course n’a pas pu être synchronisée.')
      } finally {
        if (!cancelled) setIsRestoringRide(false)
      }
    }

    void restoreActiveRide()
    return () => {
      cancelled = true
      unsubscribe?.()
    }
  }, [navigate, setRideStatus, updateRide])

  const advance = () => {
    const next = NEXT_STATUS[rideStatus]
    if (!next) return
    setRideStatus(next)
    if (next === 'in_progress') navigate('/client/ride-end')
  }

  const cancelSearch = async () => {
    if (!ride?.id || isCancelling) return
    setIsCancelling(true)
    setActionError('')
    try {
      const cancelledRide = await getRideService().cancelRideSearch(ride.id)
      updateRide({ id: cancelledRide.id, status: cancelledRide.status, dispatchDeadlineAt: null })
      setRideStatus(cancelledRide.status)
      navigate('/client/home', { replace: true })
    } catch (error) {
      setActionError(error.message || 'La recherche n’a pas pu être annulée.')
    } finally {
      setIsCancelling(false)
    }
  }

  const retrySearch = async () => {
    if (!ride?.id || isRetrying || retryingRideIdRef.current === ride.id) return
    const rideId = ride.id
    retryingRideIdRef.current = rideId
    setIsRetrying(true)
    setActionError('')
    updateRide({ id: rideId, status: 'searching', driverId: null, dispatchDeadlineAt: null })
    setRideStatus('searching')
    let searchReset = false
    try {
      const retriedRide = await getRideService().retryRideSearch(rideId)
      searchReset = true
      const searchingRide = await getDispatchService().requestRideDispatch(retriedRide.id)
      updateRide({
        id: searchingRide.id,
        status: searchingRide.status,
        driverId: searchingRide.driverId,
        dispatchDeadlineAt: searchingRide.dispatchDeadlineAt,
        assignedAt: searchingRide.assignedAt,
      })
      setRideStatus(searchingRide.status)
    } catch (error) {
      const fallbackStatus = searchReset ? 'requested' : 'no_driver'
      updateRide({ id: rideId, status: fallbackStatus, driverId: null, dispatchDeadlineAt: null })
      setRideStatus(fallbackStatus)
      setActionError(error.message || 'La recherche n’a pas pu être relancée.')
    } finally {
      retryingRideIdRef.current = null
      setIsRetrying(false)
    }
  }

  if (!isDemoMode && isRestoringRide) {
    return (
      <div className="flex min-h-full items-center justify-center bg-white px-5 py-10 text-center text-sm text-gray-600" role="status">
        Récupération de votre course…
      </div>
    )
  }

  if (!isDemoMode && !ride?.id && realtimeError) {
    return (
      <div className="flex min-h-full flex-col items-center justify-center gap-4 bg-white px-5 py-10 text-center">
        <p className="max-w-sm text-sm leading-5 text-red-600" role="alert">{realtimeError}</p>
        <PrimaryButton variant="navy" onClick={() => navigate('/client/home', { replace: true })}>
          Retour à l’accueil
        </PrimaryButton>
      </div>
    )
  }

  return (
    <div className="flex-1 flex flex-col">
      <MapProvider className="h-72 shrink-0" aria-label="Carte de la course active">
        <ClientRideMap phase="active" showDriver={showDriverDetails} />
        <div className="absolute bottom-4 left-4 right-4 z-[2] rounded-xl bg-taga-green px-3 py-2 text-center text-sm font-semibold text-white shadow-md">
          ● {STATUS_LABEL[displayedRideStatus] ?? STATUS_LABEL.searching}
        </div>
      </MapProvider>

      <div className="flex-1 bg-white -mt-6 rounded-t-3xl px-5 py-6 flex flex-col gap-4">
        {showDriverDetails && (
          <DriverInfoCard
            driver={driver}
            onMessage={() => setContactNotice('Message simulé envoyé au chauffeur.')}
            onCall={() => setContactNotice('Appel simulé vers le chauffeur.')}
          />
        )}

        {contactNotice && <p role="status" className="rounded-lg bg-taga-blue/5 px-3 py-2 text-center text-xs text-taga-blue">{contactNotice}</p>}

        {isDemoMode ? (
          showDriverDetails ? (
            <div className="text-sm text-gray-600 flex flex-col gap-1">
              <p><span className="text-taga-green font-semibold">●</span> Commande acceptée · {ride.pickupLabel}</p>
              <p className="text-xs text-gray-400">En approche · 3 min · {ride.pickupDetail}</p>
              <p><span className="text-taga-navy font-semibold">■</span> Dépose · {ride.dropoffLabel}</p>
            </div>
          ) : (
            <div className="rounded-xl bg-taga-blue/5 px-4 py-3 text-sm text-gray-600" role="status">
              Recherche d’un chauffeur en cours.
            </div>
          )
        ) : (
          <div className="rounded-xl bg-taga-blue/5 px-4 py-3 text-sm leading-5 text-gray-600" role="status">
            <p>{REAL_STATUS_COPY[displayedRideStatus] ?? 'Synchronisation de votre course en cours.'}</p>
            {driverLocation && (
              <p className="mt-1 text-xs text-taga-blue">
                Position chauffeur mise à jour{driverLocation.recordedAt ? ` · ${new Date(driverLocation.recordedAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}` : ''}.
              </p>
            )}
          </div>
        )}

        {dispatchError && <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-center text-xs text-red-600">{dispatchError}</p>}
        {actionError && <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-center text-xs text-red-600">{actionError}</p>}
        {realtimeError && <p role="alert" className="rounded-lg bg-amber-50 px-3 py-2 text-center text-xs text-amber-700">{realtimeError}</p>}

        {!isRetrying && SEARCH_STATUSES.has(displayedRideStatus) && (
          <button
            type="button"
            onClick={cancelSearch}
            disabled={isCancelling}
            className="mt-auto min-h-11 rounded-xl border border-gray-200 px-4 py-3 text-sm font-semibold text-gray-600 disabled:opacity-60"
          >
            {isCancelling ? 'Annulation…' : 'Annuler la recherche'}
          </button>
        )}

        {!isDemoMode && (displayedRideStatus === 'no_driver' || isRetrying) && <div className="mt-auto">
          <PrimaryButton variant="green" onClick={retrySearch} disabled={isRetrying}>
            {isRetrying ? 'Relance en cours…' : 'Réessayer'}
          </PrimaryButton>
        </div>}

        {isDemoMode && <div className="mt-auto">
          <PrimaryButton variant="green" onClick={advance}>
            Simuler arrivée →
          </PrimaryButton>
        </div>}
      </div>
    </div>
  )
}
