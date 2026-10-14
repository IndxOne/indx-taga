import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAppStore } from '../../store/useAppStore'
import MapProvider from '../../components/MapProvider'
import PrimaryButton from '../../components/PrimaryButton'
import BackButton from '../../components/BackButton'
import DriverRideMap from '../../components/DriverRideMap'
import { getDispatchService } from '../../services/dispatchService'
import { getRideRealtimeService } from '../../services/rideRealtimeService'
import { mapServerRideToStore } from '../../services/rideMapping'
import { isDemoMode } from '../../services/runtimeConfig'
import { ROUTES } from '../../navigation/routes'

function formatAmount(amount, fallback = 'Montant à confirmer') {
  return !Number.isFinite(amount) ? fallback : `${new Intl.NumberFormat('fr-FR').format(amount)} F`
}

export default function IncomingRequest() {
  const navigate = useNavigate()
  const storeRide = useAppStore((state) => state.ride)
  const setRide = useAppStore((state) => state.setRide)
  const updateRide = useAppStore((state) => state.updateRide)
  const setRideStatus = useAppStore((state) => state.setRideStatus)
  const [offer, setOffer] = useState(null)
  const [countdown, setCountdown] = useState(isDemoMode ? 9 : 0)
  const [isLoading, setIsLoading] = useState(!isDemoMode)
  const [responseState, setResponseState] = useState('')
  const [actionError, setActionError] = useState('')
  const [offerError, setOfferError] = useState('')
  const activeOfferRef = useRef(null)
  const respondingRef = useRef(false)
  const realtimeRef = useRef(null)

  useEffect(() => {
    if (isDemoMode) return undefined

    let active = true
    let ready = false
    const realtime = getRideRealtimeService()
    realtimeRef.current = realtime
    const applyOffer = (nextOffer) => {
      if (!active) return
      if (!nextOffer) {
        activeOfferRef.current = null
        setOffer(null)
        if (ready) navigate(ROUTES.driverOnline, { replace: true })
        return
      }
      activeOfferRef.current = nextOffer
      setOffer(nextOffer)
      setOfferError('')
      setIsLoading(false)
    }

    const unsubscribe = realtime.subscribeToDriverOffers({
      onOfferChange: applyOffer,
      onError: (error) => {
        if (active) setOfferError(error.message || 'La réception de cette demande est indisponible.')
      },
    })

    const restoreOffer = async () => {
      try {
        const currentOffer = await realtime.getActiveDriverOffer()
        if (!active) return
        if (currentOffer) {
          applyOffer(currentOffer)
        } else if (!activeOfferRef.current) {
          navigate(ROUTES.driverOnline, { replace: true })
        }
      } catch (error) {
        if (active) setOfferError(error.message || 'La demande n’a pas pu être chargée.')
      } finally {
        ready = true
        if (active) setIsLoading(false)
      }
    }

    void restoreOffer()
    return () => {
      active = false
      ready = false
      realtimeRef.current = null
      unsubscribe?.()
    }
  }, [navigate])

  useEffect(() => {
    if (!isDemoMode) return undefined
    if (countdown <= 0) {
      navigate(ROUTES.driverOnline)
      return undefined
    }
    const timer = setTimeout(() => setCountdown((current) => current - 1), 1000)
    return () => clearTimeout(timer)
  }, [countdown, navigate])

  useEffect(() => {
    if (isDemoMode || !offer?.expiresAt) return undefined
    const updateCountdown = () => {
      const remaining = Math.ceil((Date.parse(offer.expiresAt) - Date.now()) / 1000)
      setCountdown(Math.max(0, remaining))
    }
    updateCountdown()
    const timer = setInterval(updateCountdown, 1000)
    return () => clearInterval(timer)
  }, [offer?.expiresAt])

  const expireCurrentOffer = useCallback(async (offerId) => {
    if (respondingRef.current || activeOfferRef.current?.id !== offerId) return
    respondingRef.current = true
    setResponseState('expire')
    try {
      await getDispatchService().expireOffer(offerId)
      const nextOffer = await (realtimeRef.current || getRideRealtimeService()).getActiveDriverOffer()
      if (nextOffer) {
        activeOfferRef.current = nextOffer
        setOffer(nextOffer)
      } else {
        navigate(ROUTES.driverOnline, { replace: true })
      }
    } catch (error) {
      setOfferError(error.message || 'La demande a expiré, mais la liste des courses n’a pas pu être actualisée.')
    } finally {
      respondingRef.current = false
      setResponseState('')
    }
  }, [navigate])

  useEffect(() => {
    if (isDemoMode || !offer?.id || !offer.expiresAt) return undefined
    const remainingMs = Math.max(0, Date.parse(offer.expiresAt) - Date.now())
    const timer = setTimeout(() => void expireCurrentOffer(offer.id), remainingMs + 1)
    return () => clearTimeout(timer)
  }, [expireCurrentOffer, offer?.expiresAt, offer?.id])

  const respondToOffer = useCallback(async (decision) => {
    const currentOffer = activeOfferRef.current || offer
    if (!currentOffer || respondingRef.current) return
    respondingRef.current = true
    setResponseState(decision)
    setActionError('')
    try {
      const responseRide = await getDispatchService().respondToOffer(currentOffer.id, decision)
      if (decision === 'accept') {
        const nextRide = mapServerRideToStore(responseRide)
        setRide(nextRide)
        updateRide(nextRide)
        setRideStatus(responseRide.status)
        navigate(ROUTES.driverNavigation, { replace: true })
        return
      }

      const nextOffer = await (realtimeRef.current || getRideRealtimeService()).getActiveDriverOffer()
      if (nextOffer) {
        activeOfferRef.current = nextOffer
        setOffer(nextOffer)
      } else {
        navigate(ROUTES.driverOnline, { replace: true })
      }
    } catch (error) {
      setActionError(error.message || 'La réponse n’a pas pu être envoyée. Réessaie.')
    } finally {
      respondingRef.current = false
      setResponseState('')
    }
  }, [navigate, offer, setRide, setRideStatus, updateRide])

  const handleAccept = () => {
    if (isDemoMode) {
      setRideStatus('driver_en_route')
      navigate(ROUTES.driverNavigation)
      return
    }
    void respondToOffer('accept')
  }

  const handleDecline = () => {
    if (isDemoMode) {
      navigate(ROUTES.driverOnline)
      return
    }
    void respondToOffer('reject')
  }

  if (!isDemoMode && isLoading) {
    return (
      <div className="flex min-h-full items-center justify-center bg-white px-5 py-10 text-center text-sm text-gray-600" role="status">
        Chargement de la demande chauffeur…
      </div>
    )
  }

  if (!isDemoMode && !offer) {
    return (
      <div className="flex min-h-full flex-col items-center justify-center gap-4 bg-white px-5 py-10 text-center">
        <p className="max-w-sm text-sm leading-5 text-gray-600" role={offerError ? 'alert' : 'status'}>
          {offerError || 'Aucune demande chauffeur active.'}
        </p>
        <PrimaryButton variant="navy" onClick={() => navigate(ROUTES.driverOnline, { replace: true })}>
          Retour à l’espace chauffeur
        </PrimaryButton>
      </div>
    )
  }

  const ride = isDemoMode ? storeRide : offer.ride
  // Réel : montants serveur uniquement (null tant que le prix n'est pas fixé).
  const totalAmount = ride.price
  const driverAmount = ride.driverEarning
  const pickupLabel = ride.pickupLabel || ride.pickup?.label || 'Prise en charge'
  const destinationLabel = ride.dropoffLabel || ride.destination?.label || 'Destination'
  const isResponding = Boolean(responseState)

  return (
    <div className="flex-1 flex flex-col">
      <div className="relative">
        <MapProvider className="h-56 shrink-0" aria-label="Carte de la demande chauffeur">
          <div className="absolute inset-0 z-0 bg-taga-navy/55" />
          <p className="absolute left-0 right-0 top-5 z-[3] text-center text-[10px] font-bold tracking-[0.18em] text-white/70">NOUVELLE DEMANDE</p>
          <DriverRideMap phase="request" />
        </MapProvider>
        <div className="absolute left-4 top-4 z-10">
          <BackButton to={ROUTES.driverOnline} />
        </div>
      </div>

      <div className="flex-1 bg-white -mt-6 rounded-t-3xl px-5 py-5 flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-gray-400">TU GAGNES</p>
            <p className="font-bold text-3xl">{formatAmount(driverAmount)}</p>
            <p className="text-[10px] text-gray-400">
              Course total : {formatAmount(totalAmount)} · Net : 85%
            </p>
          </div>
          <div className="flex h-16 w-16 flex-col items-center justify-center rounded-full border-4 border-taga-mango font-bold text-taga-navy">
            <span className="text-lg leading-none">{countdown}</span><span className="text-[8px] uppercase text-gray-400">sec</span>
          </div>
        </div>

        <div className="grid grid-cols-4 gap-1 text-center text-[10px] bg-[#fff7eb] rounded-xl p-3">
          <div><p className="font-bold">{ride.distanceKm == null ? '—' : `${ride.distanceKm} km`}</p><p className="text-gray-400">DISTANCE</p></div>
          <div><p className="font-bold">{ride.durationMin == null ? '—' : `~${ride.durationMin} min`}</p><p className="text-gray-400">DURÉE</p></div>
          <div><p className="font-bold">—</p><p className="text-gray-400">NOTE CLIENT</p></div>
          <div><p className="font-bold">—</p><p className="text-gray-400">PICKUP</p></div>
        </div>

        <div className="rounded-xl border border-gray-100 px-3 py-2 text-xs text-gray-600">
          <p className="text-[9px] font-bold uppercase tracking-wide text-taga-blue">● Prise en charge</p>
          <p className="mt-1 font-semibold text-taga-navy">{pickupLabel}</p>
          <p className="text-[10px] text-gray-400">{ride.pickupDetail || 'Point transmis par le passager'}</p>
          <div className="my-1 ml-1 h-3 border-l-2 border-dashed border-taga-mango" />
          <p className="text-[9px] font-bold uppercase tracking-wide text-taga-mango">Destination</p>
          <p className="mt-1 font-semibold text-taga-navy">{destinationLabel}</p>
        </div>

        {offerError && <p role="alert" className="rounded-lg bg-amber-50 px-3 py-2 text-center text-xs text-amber-700">{offerError}</p>}
        {actionError && <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-center text-xs text-red-600">{actionError}</p>}

        <div className="mt-auto flex gap-3">
          <button
            type="button"
            onClick={handleDecline}
            disabled={isResponding}
            className="flex-1 rounded-xl border border-gray-200 py-3 font-semibold text-gray-600 disabled:opacity-40"
          >
            {responseState === 'reject' ? 'Refus…' : 'Refuser'}
          </button>
          <div className="flex-1">
            <PrimaryButton variant="green" onClick={handleAccept} disabled={isResponding}>
              {responseState === 'accept' ? 'Acceptation…' : responseState === 'expire' ? 'Mise à jour…' : `Accepter · ${formatAmount(driverAmount)}`}
            </PrimaryButton>
          </div>
        </div>
      </div>
    </div>
  )
}
