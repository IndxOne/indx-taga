import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAppStore } from '../../store/useAppStore'
import MapView from '../../components/MapView'
import DriverInfoCard from '../../components/DriverInfoCard'
import PrimaryButton from '../../components/PrimaryButton'
import ClientRideMap from '../../components/ClientRideMap'
import { getDispatchService } from '../../services/dispatchService'
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

export default function ActiveRide() {
  const navigate = useNavigate()
  const ride = useAppStore((state) => state.ride)
  const driver = useAppStore((state) => state.driver)
  const rideStatus = useAppStore((state) => state.rideStatus)
  const setRide = useAppStore((state) => state.setRide)
  const setRideStatus = useAppStore((state) => state.setRideStatus)
  const [contactNotice, setContactNotice] = useState('')
  const [dispatchError, setDispatchError] = useState('')
  const showDriverDetails = isDemoMode

  useEffect(() => {
    if (isDemoMode || !ride?.id || rideStatus !== 'requested') return undefined

    let cancelled = false
    getDispatchService().requestRideDispatch(ride.id)
      .then((dispatchedRide) => {
        if (cancelled) return
        setRide({
          ...ride,
          id: dispatchedRide.id,
          status: dispatchedRide.status,
          driverId: dispatchedRide.driverId,
        })
        setRideStatus(dispatchedRide.status)
      })
      .catch((error) => {
        if (!cancelled) setDispatchError(error.message || 'La recherche d’un chauffeur n’a pas pu démarrer.')
      })

    return () => {
      cancelled = true
    }
  }, [ride, rideStatus, setRide, setRideStatus])

  const advance = () => {
    const next = NEXT_STATUS[rideStatus]
    if (!next) return
    setRideStatus(next)
    if (next === 'in_progress') navigate('/client/ride-end')
  }

  return (
    <div className="flex-1 flex flex-col">
      <MapView className="h-72 shrink-0" aria-label="Carte de la course active">
        <ClientRideMap phase="active" />
        <div className="absolute bottom-4 left-4 right-4 z-[2] rounded-xl bg-taga-green px-3 py-2 text-center text-sm font-semibold text-white shadow-md">
          ● {STATUS_LABEL[rideStatus] ?? STATUS_LABEL.searching}
        </div>
      </MapView>

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
            Votre demande est enregistrée. Recherche d’un chauffeur en cours.
          </div>
        )}

        {dispatchError && <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-center text-xs text-red-600">{dispatchError}</p>}

        {isDemoMode && <div className="mt-auto">
          <PrimaryButton variant="green" onClick={advance}>
            Simuler arrivée →
          </PrimaryButton>
        </div>}
      </div>
    </div>
  )
}
