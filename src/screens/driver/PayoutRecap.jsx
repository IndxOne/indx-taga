import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAppStore } from '../../store/useAppStore'
import AmountTile from '../../components/AmountTile'
import PrimaryButton from '../../components/PrimaryButton'
import { getRidePricing } from '../../services/rideFare'
import { isDemoMode } from '../../services/runtimeConfig'
import { ROUTES } from '../../navigation/routes'

export default function PayoutRecap() {
  const navigate = useNavigate()
  const driverWalletBalance = useAppStore((state) => state.driverWalletBalance)
  const ride = useAppStore((state) => state.ride)
  const resetRide = useAppStore((state) => state.resetRide)
  const paymentMethods = useAppStore((state) => state.paymentMethods)
  const [withdrawalState, setWithdrawalState] = useState('idle')
  const [selectedPayout, setSelectedPayout] = useState('orange_money')

  const resumeOnline = () => {
    if (!isDemoMode) resetRide()
    navigate(ROUTES.driverOnline)
  }

  if (!isDemoMode) {
    // Mode réel : ni solde, ni retrait, ni gain tant que le lot paiement n'existe pas.
    const hasRide = Boolean(ride.id)
    return (
      <div className="flex-1 overflow-y-auto bg-[#f4f6fa] px-5 py-7 text-taga-navy flex flex-col gap-4">
        <div>
          <p className="text-taga-green text-xs font-semibold">● COURSE TERMINÉE</p>
          <h1 className="text-2xl font-bold mt-2">Course terminée.</h1>
          {hasRide && <p className="text-gray-500 text-sm">{ride.pickupLabel} → {ride.dropoffLabel}</p>}
        </div>
        <div className="rounded-2xl bg-white p-4 text-sm text-gray-600 shadow-sm" role="status">
          <p className="font-semibold text-taga-navy">Gains et retraits</p>
          <p className="mt-1 text-xs leading-5">
            Le calcul des gains et les retraits mobile money ne sont pas encore activés. Aucun montant n’est affiché tant que le service de paiement n’est pas en place.
          </p>
        </div>
        <button type="button" onClick={resumeOnline} className="mt-auto rounded-xl border border-taga-navy py-3 font-semibold">Retour à l’espace chauffeur</button>
      </div>
    )
  }

  const driverEarning = Number.isFinite(ride.driverEarning)
    ? ride.driverEarning
    : getRidePricing(ride.estimatedPrice ?? ride.price, ride.rideType).driverEarning

  const handleWithdrawal = () => {
    setWithdrawalState('requested')
  }

  return (
    <div className="flex-1 overflow-y-auto bg-[#f4f6fa] px-5 py-7 text-taga-navy flex flex-col gap-4">
      <div><p className="text-taga-green text-xs font-semibold">● COURSE TERMINÉE · 10:42</p><h1 className="text-2xl font-bold mt-2">Bien joué chef.</h1><p className="text-gray-500 text-sm">Akissi t'a mis 5★.</p></div>
      <div className="rounded-2xl bg-gradient-to-br from-taga-green via-taga-navy to-[#6a4d4d] p-4 text-white shadow-sm"><div className="flex items-start justify-between"><p className="text-xs text-white/60">SOLDE DISPONIBLE</p><p className="text-[10px] text-white/60">SAM. 24 AVR. · 19H32</p></div><AmountTile amount={driverWalletBalance} size="xl" tone="light" /><p className="mt-2 text-[10px] text-white/70">Aujourd'hui · 10 courses &nbsp; Heures · 6h12</p></div>
      <div className="rounded-2xl bg-white p-4 flex items-center justify-between text-sm shadow-sm"><div><p className="text-gray-400 text-[10px]">DERNIÈRE COURSE</p><p className="font-semibold">{ride.pickupLabel.split(',')[0]} → {ride.dropoffLabel.split(',')[0]}</p><p className="text-[10px] text-gray-400">{ride.distanceKm} km · {ride.durationMin} min · ★ 5.0</p></div><p className="text-taga-green font-bold">+{new Intl.NumberFormat('fr-FR').format(driverEarning)} F</p></div>
      <div>
        <p className="text-xs text-gray-400 mb-2">RETRAIT MOBILE MONEY</p>
        <div className="rounded-2xl bg-white p-3 shadow-sm">
          <p className="text-sm font-semibold">Retire tes gains, sans frais</p>
          <div className="mt-3 grid grid-cols-2 gap-2">
            {paymentMethods.map((method) => (
              <button key={method.id} type="button" onClick={() => setSelectedPayout(method.provider)} className={`rounded-xl border p-3 text-left ${selectedPayout === method.provider ? 'border-taga-blue bg-taga-blue/5' : 'border-gray-100 bg-gray-50'}`}>
                <span className={`flex h-6 w-6 items-center justify-center rounded-md text-[8px] font-bold text-white ${method.provider === 'orange_money' ? 'bg-orange-500' : 'bg-sky-500'}`}>{method.provider === 'orange_money' ? 'OM' : 'WV'}</span>
                <span className="mt-2 block text-[10px] font-semibold">{method.label}</span>
                <span className="block text-[9px] text-gray-400">{method.maskedNumber}</span>
              </button>
            ))}
          </div>
        </div>
        {withdrawalState === 'requested' ? (
          <div role="status" className="mt-3 rounded-xl bg-taga-green/10 px-4 py-3 text-sm text-taga-green">
            Retrait simulé (démo) : aucune opération réelle n’a été effectuée.
          </div>
        ) : (
          <div className="mt-3"><PrimaryButton variant="mango" onClick={handleWithdrawal}>
            Retirer {new Intl.NumberFormat('fr-FR').format(driverWalletBalance)} F sur {selectedPayout === 'wave' ? 'Wave' : 'Orange Money'} →
          </PrimaryButton>
          </div>
        )}
      </div>
      <button type="button" onClick={resumeOnline} className="mt-auto rounded-xl border border-taga-navy py-3 font-semibold">Reprendre en ligne</button>
    </div>
  )
}
