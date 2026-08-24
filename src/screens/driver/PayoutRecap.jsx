import { useNavigate } from 'react-router-dom'
import { useAppStore } from '../../store/useAppStore'
import AmountTile from '../../components/AmountTile'
import PrimaryButton from '../../components/PrimaryButton'

export default function PayoutRecap() {
  const navigate = useNavigate()
  const driverWalletBalance = useAppStore((state) => state.driverWalletBalance)
  const ride = useAppStore((state) => state.ride)

  return (
    <div className="flex-1 bg-taga-navy text-white px-5 py-8 flex flex-col gap-5">
      <div><p className="text-taga-green text-xs font-semibold">● COURSE TERMINÉE</p><h1 className="text-xl font-bold mt-2">Bien joué chef.</h1><p className="text-white/70 text-sm">Akissi t'a mis 5★.</p></div>
      <div className="bg-white/10 rounded-2xl p-4"><p className="text-xs text-white/50">SOLDE DISPONIBLE</p><AmountTile amount={driverWalletBalance} size="xl" tone="light" /></div>
      <div className="bg-white/10 rounded-2xl p-4 flex items-center justify-between text-sm"><div><p className="text-white/50 text-xs">DERNIÈRE COURSE</p><p className="font-semibold">{ride.pickupLabel.split(',')[0]} → {ride.dropoffLabel.split(',')[0]}</p></div><p className="text-taga-green font-bold">+{new Intl.NumberFormat('fr-FR').format(ride.driverEarning)} F</p></div>
      <div><p className="text-xs text-white/50 mb-2">RETRAIT MOBILE MONEY</p><div className="bg-white/10 rounded-xl px-4 py-3 flex items-center justify-between text-sm mb-3"><span>Orange Money · 07 •••• 1284</span></div><PrimaryButton variant="mango" onClick={() => {}}>Retirer {new Intl.NumberFormat('fr-FR').format(driverWalletBalance)} F sur Orange Money →</PrimaryButton></div>
      <button type="button" onClick={() => navigate('/driver/online')} className="mt-auto border border-white/30 rounded-xl py-3 font-semibold">Reprendre en ligne</button>
    </div>
  )
}
