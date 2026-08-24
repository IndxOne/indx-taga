import { useNavigate } from 'react-router-dom'
import { useAppStore } from '../../store/useAppStore'
import MapView from '../../components/MapView'
import DriverInfoCard from '../../components/DriverInfoCard'
import PrimaryButton from '../../components/PrimaryButton'

const STATUS_LABEL = {
  searching: "Recherche d'un chauffeur...",
  driver_en_route: 'Chauffeur en approche · 3 min',
  arrived: 'Chauffeur arrivé',
  in_progress: 'Course en cours',
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
  const setRideStatus = useAppStore((state) => state.setRideStatus)

  const advance = () => {
    const next = NEXT_STATUS[rideStatus]
    if (!next) return
    setRideStatus(next)
    if (next === 'in_progress') navigate('/client/ride-end')
  }

  return (
    <div className="flex-1 flex flex-col">
      <div className="bg-taga-green text-white text-sm font-semibold text-center py-2">
        {STATUS_LABEL[rideStatus] ?? STATUS_LABEL.searching}
      </div>

      <MapView className="h-64 shrink-0" />

      <div className="flex-1 bg-white -mt-6 rounded-t-3xl px-5 py-6 flex flex-col gap-4">
        <DriverInfoCard driver={driver} />

        <div className="text-sm text-gray-600 flex flex-col gap-1">
          <p><span className="text-taga-green font-semibold">●</span> {ride.pickupLabel} — {ride.pickupDetail}</p>
          <p><span className="text-taga-navy font-semibold">■</span> {ride.dropoffLabel}</p>
        </div>

        <div className="mt-auto">
          <PrimaryButton variant="green" onClick={advance}>
            Simuler arrivée →
          </PrimaryButton>
        </div>
      </div>
    </div>
  )
}
