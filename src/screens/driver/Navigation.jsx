import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAppStore } from '../../store/useAppStore'
import MapView from '../../components/MapView'
import PrimaryButton from '../../components/PrimaryButton'
import BackButton from '../../components/BackButton'
import { ROUTES } from '../../navigation/routes'
import DriverRideMap from '../../components/DriverRideMap'

export default function Navigation() {
  const navigate = useNavigate()
  const ride = useAppStore((state) => state.ride)
  const rideStatus = useAppStore((state) => state.rideStatus)
  const setRideStatus = useAppStore((state) => state.setRideStatus)
  const isArrived = rideStatus === 'arrived'
  const [contactNotice, setContactNotice] = useState('')

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
      <MapView className="flex-1" aria-label="Navigation vers le passager">
        <DriverRideMap phase="navigation" />
      </MapView>
      <div className="bg-white px-5 py-5 flex flex-col gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-taga-mango text-sm font-bold text-white">AK</div>
          <div className="flex-1 text-sm">
            <p className="font-semibold text-taga-navy">Akissi K.</p>
            <p className="text-xs text-gray-400">★ 4.96 · cliente régulière</p>
          </div>
          <button type="button" onClick={() => setContactNotice('Message simulé envoyé à Akissi.')} aria-label="Message à la cliente" className="flex h-9 w-9 items-center justify-center rounded-lg bg-gray-100">💬</button>
          <button type="button" onClick={() => setContactNotice('Appel simulé vers Akissi.')} aria-label="Appeler la cliente" className="flex h-9 w-9 items-center justify-center rounded-lg bg-taga-green text-white">📞</button>
        </div>
        <div className="rounded-xl bg-gray-50 px-3 py-2 text-xs">
          <p className="font-bold uppercase tracking-wide text-taga-blue">Pickup</p>
          <p className="font-semibold text-taga-navy">{ride.pickupLabel}</p>
          <p className="text-gray-400">Rue M38, vers la station Total</p>
        </div>
        {contactNotice && <p role="status" className="text-center text-[10px] text-taga-blue">{contactNotice}</p>}
        <PrimaryButton onClick={handleAction}>{isArrived ? 'Démarrer course' : 'Je suis arrivé · démarrer course'}</PrimaryButton>
      </div>
    </div>
  )
}
