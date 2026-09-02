import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAppStore } from '../../store/useAppStore'
import MapProvider from '../../components/MapProvider'
import DriverInfoCard from '../../components/DriverInfoCard'
import PrimaryButton from '../../components/PrimaryButton'
import ClientRideMap from '../../components/ClientRideMap'
import { getDispatchService } from '../../services/dispatchService'
import { getRideRealtimeService } from '../../services/rideRealtimeService'
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
  const [realtimeError, setRealtimeError] = useState('')
  const [driverLocation, setDriverLocation] = useState(null)
  const showDriverDetails = isDemoMode

  useEffect(() => {
    if (isDemoMode || !ride?.id || rideStatus !== 'requested') return undefined

    let cancelled = false
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
        if (!cancelled) setDispatchError(error.message || 'La recherche d’un chauffeur n’a pas pu démarrer.')
      })

    return () => {
      cancelled = true
    }
  }, [ride, rideStatus, setRideStatus, updateRide])

  useEffect(() => {
    if (isDemoMode || !ride?.id) return undefined

    let cancelled = false
    const realtime = getRideRealtimeService()
    const applyRide = (serverRide) => {
      if (cancelled || !serverRide) return
      updateRide(mapRealtimeRideToStore(serverRide))
      setRideStatus(serverRide.status)
    }

    realtime.getRide(ride.id)
      .then(applyRide)
      .catch((error) => {
        if (!cancelled) setRealtimeError(error.message || 'La course n’a pas pu être synchronisée.')
      })

    realtime.getDriverLocation(ride.id)
      .then((location) => {
        if (!cancelled && location) setDriverLocation(location)
      })
      .catch((error) => {
        if (!cancelled) setRealtimeError(error.message || 'La position du chauffeur n’a pas pu être chargée.')
      })

    const unsubscribe = realtime.subscribeToRide(ride.id, {
      onRideChange: applyRide,
      onDriverLocationChange: (location) => {
        if (!cancelled) setDriverLocation(location)
      },
      onError: (error) => {
        if (!cancelled) setRealtimeError(error.message || 'La synchronisation temps réel est indisponible.')
      },
    })

    return () => {
      cancelled = true
      unsubscribe?.()
    }
  }, [ride?.id, setRideStatus, updateRide])

  const advance = () => {
    const next = NEXT_STATUS[rideStatus]
    if (!next) return
    setRideStatus(next)
    if (next === 'in_progress') navigate('/client/ride-end')
  }

  return (
    <div className="flex-1 flex flex-col">
      <MapProvider className="h-72 shrink-0" aria-label="Carte de la course active">
        <ClientRideMap phase="active" />
        <div className="absolute bottom-4 left-4 right-4 z-[2] rounded-xl bg-taga-green px-3 py-2 text-center text-sm font-semibold text-white shadow-md">
          ● {STATUS_LABEL[rideStatus] ?? STATUS_LABEL.searching}
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
          <div className="text-sm text-gray-600 flex flex-col gap-1">
            <p><span className="text-taga-green font-semibold">●</span> Commande acceptée · {ride.pickupLabel}</p>
            <p className="text-xs text-gray-400">En approche · 3 min · {ride.pickupDetail}</p>
            <p><span className="text-taga-navy font-semibold">■</span> Dépose · {ride.dropoffLabel}</p>
          </div>
        ) : (
          <div className="rounded-xl bg-taga-blue/5 px-4 py-3 text-sm leading-5 text-gray-600" role="status">
            <p>{REAL_STATUS_COPY[rideStatus] ?? 'Synchronisation de votre course en cours.'}</p>
            {driverLocation && (
              <p className="mt-1 text-xs text-taga-blue">
                Position chauffeur mise à jour{driverLocation.recordedAt ? ` · ${new Date(driverLocation.recordedAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}` : ''}.
              </p>
            )}
          </div>
        )}

        {dispatchError && <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-center text-xs text-red-600">{dispatchError}</p>}
        {realtimeError && <p role="alert" className="rounded-lg bg-amber-50 px-3 py-2 text-center text-xs text-amber-700">{realtimeError}</p>}

        {isDemoMode && <div className="mt-auto">
          <PrimaryButton variant="green" onClick={advance}>
            Simuler arrivée →
          </PrimaryButton>
        </div>}
      </div>
    </div>
  )
}
