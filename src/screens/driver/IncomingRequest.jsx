import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAppStore } from '../../store/useAppStore'
import MapView from '../../components/MapView'
import PrimaryButton from '../../components/PrimaryButton'
import BackButton from '../../components/BackButton'
import DriverRideMap from '../../components/DriverRideMap'
import { ROUTES } from '../../navigation/routes'

export default function IncomingRequest() {
  const navigate = useNavigate()
  const ride = useAppStore((state) => state.ride)
  const setRideStatus = useAppStore((state) => state.setRideStatus)
  const [countdown, setCountdown] = useState(9)

  useEffect(() => {
    if (countdown <= 0) {
      navigate('/driver/online')
      return undefined
    }
    const timer = setTimeout(() => setCountdown((current) => current - 1), 1000)
    return () => clearTimeout(timer)
  }, [countdown, navigate])

  const handleAccept = () => {
    setRideStatus('driver_en_route')
    navigate('/driver/navigation')
  }

  return (
    <div className="flex-1 flex flex-col">
      <div className="relative">
        <MapView className="h-56 shrink-0" aria-label="Carte de la demande chauffeur">
          <div className="absolute inset-0 z-0 bg-taga-navy/55" />
          <p className="absolute left-0 right-0 top-5 z-[3] text-center text-[10px] font-bold tracking-[0.18em] text-white/70">NOUVELLE DEMANDE</p>
          <DriverRideMap phase="request" />
        </MapView>
        <div className="absolute left-4 top-4 z-10">
          <BackButton to={ROUTES.driverOnline} />
        </div>
      </div>

      <div className="flex-1 bg-white -mt-6 rounded-t-3xl px-5 py-5 flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-gray-400">TU GAGNES</p>
            <p className="font-bold text-3xl">{new Intl.NumberFormat('fr-FR').format(ride.driverEarning)} F</p>
            <p className="text-[10px] text-gray-400">Course total : {new Intl.NumberFormat('fr-FR').format(ride.price)} F · Net : 85%</p>
          </div>
          <div className="flex h-16 w-16 flex-col items-center justify-center rounded-full border-4 border-taga-mango font-bold text-taga-navy">
            <span className="text-lg leading-none">{countdown}</span><span className="text-[8px] uppercase text-gray-400">sec</span>
          </div>
        </div>

        <div className="grid grid-cols-4 gap-1 text-center text-[10px] bg-[#fff7eb] rounded-xl p-3">
          <div><p className="font-bold">{ride.distanceKm} km</p><p className="text-gray-400">DISTANCE</p></div>
          <div><p className="font-bold">~{ride.durationMin} min</p><p className="text-gray-400">DURÉE</p></div>
          <div><p className="font-bold">4.96 ★</p><p className="text-gray-400">NOTE CLIENT</p></div>
          <div><p className="font-bold">3 min</p><p className="text-gray-400">PICKUP</p></div>
        </div>

        <div className="rounded-xl border border-gray-100 px-3 py-2 text-xs text-gray-600">
          <p className="text-[9px] font-bold uppercase tracking-wide text-taga-blue">● Pickup · 3 min</p>
          <p className="mt-1 font-semibold text-taga-navy">{ride.pickupLabel}</p>
          <p className="text-[10px] text-gray-400">{ride.pickupDetail}</p>
          <div className="my-1 ml-1 h-3 border-l-2 border-dashed border-taga-mango" />
          <p className="text-[9px] font-bold uppercase tracking-wide text-taga-mango">Destination</p>
          <p className="mt-1 font-semibold text-taga-navy">{ride.dropoffLabel}</p>
          <p className="text-[10px] text-gray-400">Centre-ville · {ride.distanceKm} km</p>
        </div>

        <div className="mt-auto flex gap-3">
          <button type="button" onClick={() => navigate('/driver/online')} className="flex-1 rounded-xl border border-gray-200 py-3 font-semibold text-gray-600">Refuser</button>
          <div className="flex-1"><PrimaryButton variant="green" onClick={handleAccept}>Accepter · {new Intl.NumberFormat('fr-FR').format(ride.driverEarning)} F</PrimaryButton></div>
        </div>
      </div>
    </div>
  )
}
