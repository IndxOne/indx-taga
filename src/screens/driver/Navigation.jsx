import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAppStore } from '../../store/useAppStore'
import MapProvider from '../../components/MapProvider'
import PrimaryButton from '../../components/PrimaryButton'
import BackButton from '../../components/BackButton'
import { ROUTES } from '../../navigation/routes'
import DriverRideMap from '../../components/DriverRideMap'
import Icon from '../../components/Icon'
import DriverLocationTracker from '../../components/DriverLocationTracker'
import { driverRouteForStatus, useDriverRide } from '../../hooks/useDriverRide'
import { isDemoMode } from '../../services/runtimeConfig'

// Prochaine transition serveur selon le statut serveur courant.
const REAL_ACTIONS = {
  assigned: { to: 'arriving', label: 'Je pars vers le passager' },
  arriving: { to: 'arrived', label: 'Je suis arrivé' },
  arrived: { to: 'in_progress', label: 'Démarrer la course' },
}

export default function Navigation() {
  const navigate = useNavigate()
  const ride = useAppStore((state) => state.ride)
  const rideStatus = useAppStore((state) => state.rideStatus)
  const setRideStatus = useAppStore((state) => state.setRideStatus)
  const driverRide = useDriverRide()
  const isArrived = rideStatus === 'arrived'
  const [contactNotice, setContactNotice] = useState('')
  const { isRestoring, hasActiveRide } = driverRide
  const realAction = REAL_ACTIONS[rideStatus]

  useEffect(() => {
    if (isDemoMode || isRestoring || driverRide.error) return
    if (!hasActiveRide) navigate(ROUTES.driverOnline, { replace: true })
    else if (rideStatus === 'in_progress') navigate(driverRouteForStatus(rideStatus), { replace: true })
  }, [driverRide.error, hasActiveRide, isRestoring, navigate, rideStatus])

  const handleAction = async () => {
    if (isDemoMode) {
      if (!isArrived) {
        setRideStatus('arrived')
        return
      }
      setRideStatus('in_progress')
      navigate('/driver/ride-in-progress')
      return
    }
    if (!realAction) return
    const updated = await driverRide.advance(realAction.to)
    if (updated?.status === 'in_progress') navigate(ROUTES.driverRideInProgress)
  }

  if (!isDemoMode && isRestoring) {
    return (
      <div className="flex min-h-full items-center justify-center bg-white px-5 py-10 text-center text-sm text-gray-600" role="status">
        Récupération de ta course…
      </div>
    )
  }

  return (
    <div className="flex-1 flex flex-col">
      <div className="bg-taga-navy text-white px-4 py-3 flex items-center gap-3">
        <BackButton to={ROUTES.driverOnline} />
        <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-taga-mango"><Icon name="arrowUp" size={18} /></span>
        {isDemoMode
          ? <div><p className="font-bold">200 m</p><p className="text-xs text-white/60">Tout droit sur Bd Latrille</p></div>
          : <div><p className="font-bold">Vers le passager</p><p className="text-xs text-white/60">Guidage non disponible dans cette version</p></div>}
      </div>
      <MapProvider className="flex-1" aria-label="Navigation vers le passager">
        <DriverRideMap phase="navigation" />
      </MapProvider>
      <div className="bg-white px-5 py-5 flex flex-col gap-3">
        <DriverLocationTracker rideId={ride.id} rideStatus={rideStatus} />
        {isDemoMode ? (
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-taga-mango text-sm font-bold text-white">AK</div>
            <div className="flex-1 text-sm">
              <p className="font-semibold text-taga-navy">Akissi K.</p>
              <p className="text-xs text-gray-400">★ 4.96 · cliente régulière</p>
            </div>
            <button type="button" onClick={() => setContactNotice('Message simulé envoyé à Akissi.')} aria-label="Message à la cliente" className="flex h-11 w-11 items-center justify-center rounded-lg bg-gray-100"><Icon name="message" size={18} /></button>
            <button type="button" onClick={() => setContactNotice('Appel simulé vers Akissi.')} aria-label="Appeler la cliente" className="flex h-11 w-11 items-center justify-center rounded-lg bg-taga-green text-white"><Icon name="phone" size={18} /></button>
          </div>
        ) : (
          <p className="text-xs text-gray-400">Le contact avec le passager n’est pas encore disponible dans cette version.</p>
        )}
        <div className="rounded-xl bg-gray-50 px-3 py-2 text-xs">
          <p className="font-bold uppercase tracking-wide text-taga-blue">Pickup</p>
          <p className="font-semibold text-taga-navy">{ride.pickupLabel}</p>
          {isDemoMode && <p className="text-gray-400">Rue M38, vers la station Total</p>}
        </div>
        {contactNotice && <p role="status" className="text-center text-[10px] text-taga-blue">{contactNotice}</p>}
        {driverRide.error && <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-center text-xs text-red-600">{driverRide.error}</p>}
        {isDemoMode ? (
          <PrimaryButton onClick={handleAction}>{isArrived ? 'Démarrer course' : 'Je suis arrivé · démarrer course'}</PrimaryButton>
        ) : (
          realAction && (
            <PrimaryButton onClick={handleAction} disabled={driverRide.isAdvancing}>
              {driverRide.isAdvancing ? 'Mise à jour…' : realAction.label}
            </PrimaryButton>
          )
        )}
      </div>
    </div>
  )
}
