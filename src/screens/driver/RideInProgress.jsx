import { useNavigate } from 'react-router-dom'
import { useAppStore } from '../../store/useAppStore'
import MapView from '../../components/MapView'
import PrimaryButton from '../../components/PrimaryButton'

export default function RideInProgress() {
  const navigate = useNavigate()
  const ride = useAppStore((state) => state.ride)
  const setRideStatus = useAppStore((state) => state.setRideStatus)
  const creditRideEarning = useAppStore((state) => state.creditRideEarning)

  const handleComplete = () => {
    setRideStatus('completed')
    creditRideEarning(ride.driverEarning)
    navigate('/driver/payout-recap')
  }

  return (
    <div className="flex-1 flex flex-col">
      <div className="bg-taga-green text-white text-sm font-semibold text-center py-2">Course en cours · Akissi à bord</div>
      <div className="bg-taga-navy text-white px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3"><span className="w-9 h-9 rounded-lg bg-taga-mango flex items-center justify-center">→</span><div><p className="font-bold">1.4 km</p><p className="text-xs text-white/60">Tourner à droite — Bd VGE</p></div></div>
        <div className="text-right"><p className="text-xs text-white/60">TON GAIN</p><p className="font-bold">{new Intl.NumberFormat('fr-FR').format(ride.driverEarning)} F</p></div>
      </div>
      <MapView className="flex-1" />
      <div className="bg-white px-5 py-5 flex flex-col gap-4">
        <div className="grid grid-cols-3 gap-2 text-center text-xs bg-gray-50 rounded-xl p-3">
          <div><p className="font-bold">~8 min</p><p className="text-gray-400">RESTANT</p></div>
          <div><p className="font-bold">42 km/h</p><p className="text-gray-400">VITESSE</p></div>
          <div><p className="font-bold">Fluide</p><p className="text-gray-400">TRAFIC</p></div>
        </div>
        <div className="flex gap-3"><button type="button" className="flex-1 border border-gray-200 rounded-xl py-4 font-semibold text-gray-600">Urgence</button><div className="flex-1"><PrimaryButton onClick={handleComplete}>Terminer la course →</PrimaryButton></div></div>
      </div>
    </div>
  )
}
