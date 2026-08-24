import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAppStore } from '../../store/useAppStore'
import MapView from '../../components/MapView'
import PrimaryButton from '../../components/PrimaryButton'
import DriverRideMap from '../../components/DriverRideMap'

export default function RideInProgress() {
  const navigate = useNavigate()
  const ride = useAppStore((state) => state.ride)
  const setRideStatus = useAppStore((state) => state.setRideStatus)
  const creditRideEarning = useAppStore((state) => state.creditRideEarning)
  const [showEmergency, setShowEmergency] = useState(false)

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
      <MapView className="flex-1" aria-label="Carte de la course en cours">
        <DriverRideMap phase="in-progress" />
        <div className="absolute right-4 top-5 z-[3] rounded-xl border-2 border-taga-mango bg-white px-3 py-2 text-right shadow-md">
          <p className="text-[9px] uppercase text-gray-400">Ton gain</p>
          <p className="font-bold text-taga-navy">{new Intl.NumberFormat('fr-FR').format(ride.driverEarning)} F</p>
        </div>
      </MapView>
      <div className="bg-white px-5 py-5 flex flex-col gap-4">
        <div className="flex items-center justify-between text-[10px] font-semibold text-gray-500">
          <span className="uppercase tracking-wide">Vers Plateau</span>
          <span>9,6 / {ride.distanceKm} km</span>
        </div>
        <div className="h-1.5 overflow-hidden rounded-full bg-gray-100"><div className="h-full w-[68%] rounded-full bg-gradient-to-r from-taga-green to-taga-mango" /></div>
        <div className="grid grid-cols-3 gap-2 text-center text-xs bg-gray-50 rounded-xl p-3">
          <div><p className="font-bold">~8 min</p><p className="text-gray-400">RESTANT</p></div>
          <div><p className="font-bold">42 km/h</p><p className="text-gray-400">VITESSE</p></div>
          <div><p className="font-bold">Fluide</p><p className="text-gray-400">TRAFIC</p></div>
        </div>
        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => setShowEmergency((visible) => !visible)}
            aria-expanded={showEmergency}
            className="flex-1 border border-gray-200 rounded-xl py-4 font-semibold text-gray-600"
          >
            Urgence
          </button>
          <div className="flex-1"><PrimaryButton onClick={handleComplete}>Terminer la course →</PrimaryButton></div>
        </div>
        {showEmergency && (
          <div role="alert" className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">
            <p className="font-semibold">Assistance d’urgence</p>
            <p className="mt-1 text-xs">Le bouton d’appel sera activé avec le service d’assistance réel.</p>
            <button type="button" onClick={() => setShowEmergency(false)} className="mt-2 text-xs font-semibold underline">
              Fermer
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
