import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAppStore } from '../../store/useAppStore'
import MapView from '../../components/MapView'
import PrimaryButton from '../../components/PrimaryButton'

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
      <MapView className="h-56 shrink-0" />

      <div className="flex-1 bg-white -mt-6 rounded-t-3xl px-5 py-6 flex flex-col gap-4">
        <p className="text-center text-xs text-gray-400 uppercase">Nouvelle demande</p>

        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-gray-400">TU GAGNES</p>
            <p className="font-bold text-3xl">{new Intl.NumberFormat('fr-FR').format(ride.driverEarning)} F</p>
          </div>
          <div className="w-14 h-14 rounded-full border-4 border-taga-mango flex items-center justify-center font-bold text-taga-navy">{countdown}</div>
        </div>

        <div className="grid grid-cols-3 gap-2 text-center text-xs bg-gray-50 rounded-xl p-3">
          <div><p className="font-bold">{ride.distanceKm} km</p><p className="text-gray-400">DISTANCE</p></div>
          <div><p className="font-bold">~{ride.durationMin} min</p><p className="text-gray-400">DURÉE</p></div>
          <div><p className="font-bold">4.96 ★</p><p className="text-gray-400">NOTE CLIENT</p></div>
        </div>

        <div className="text-sm text-gray-600 flex flex-col gap-1">
          <p><span className="text-taga-green font-semibold">●</span> Pickup — {ride.pickupLabel}</p>
          <p><span className="text-taga-navy font-semibold">■</span> Destination — {ride.dropoffLabel}</p>
        </div>

        <div className="mt-auto flex gap-3">
          <button type="button" onClick={() => navigate('/driver/online')} className="flex-1 border border-gray-200 rounded-xl py-4 font-semibold text-gray-600">Refuser</button>
          <div className="flex-1"><PrimaryButton variant="green" onClick={handleAccept}>Accepter</PrimaryButton></div>
        </div>
      </div>
    </div>
  )
}
