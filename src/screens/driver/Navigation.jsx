import { useNavigate } from 'react-router-dom'
import { useAppStore } from '../../store/useAppStore'
import MapView from '../../components/MapView'
import PrimaryButton from '../../components/PrimaryButton'
import BackButton from '../../components/BackButton'
import { ROUTES } from '../../navigation/routes'

export default function Navigation() {
  const navigate = useNavigate()
  const ride = useAppStore((state) => state.ride)
  const rideStatus = useAppStore((state) => state.rideStatus)
  const setRideStatus = useAppStore((state) => state.setRideStatus)
  const isArrived = rideStatus === 'arrived'

  const handleAction = () => {
    if (!isArrived) {
      setRideStatus('arrived')
      return
    }
    setRideStatus('in_progress')
    navigate('/driver/ride-in-progress')
  }

  return (
    <div className="flex-1 flex flex-col">
      <div className="bg-taga-navy text-white px-4 py-3 flex items-center gap-3">
        <BackButton to={ROUTES.driverOnline} />
        <span className="w-9 h-9 rounded-lg bg-taga-mango flex items-center justify-center">↑</span>
        <div><p className="font-bold">200 m</p><p className="text-xs text-white/60">Tout droit sur Bd Latrille</p></div>
      </div>
      <MapView className="flex-1" />
      <div className="bg-white px-5 py-5 flex flex-col gap-4">
        <div className="text-sm text-gray-600">
          <p className="font-semibold">Akissi K. · ★ 4.96 · cliente régulière</p>
          <p className="text-xs text-gray-400 mt-1">Pickup — {ride.pickupLabel}</p>
        </div>
        <PrimaryButton onClick={handleAction}>{isArrived ? 'Démarrer course' : 'Je suis arrivé · démarrer course'}</PrimaryButton>
      </div>
    </div>
  )
}
