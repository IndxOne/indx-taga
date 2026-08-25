import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAppStore } from '../../store/useAppStore'
import AmountTile from '../../components/AmountTile'
import RatingStars from '../../components/RatingStars'
import PrimaryButton from '../../components/PrimaryButton'

const TAGS = ['Conduite', 'À l\'heure', 'Voiture propre']
const COMPLETION_META = '24 AOÛT 2026 · 18:42'

export default function RideEnd() {
  const navigate = useNavigate()
  const ride = useAppStore((state) => state.ride)
  const driver = useAppStore((state) => state.driver)
  const rating = useAppStore((state) => state.rating)
  const setRating = useAppStore((state) => state.setRating)
  const setRideStatus = useAppStore((state) => state.setRideStatus)
  const paymentMethods = useAppStore((state) => state.paymentMethods)
  const defaultPayment = paymentMethods.find((method) => method.isDefault) ?? paymentMethods[0]
  const [selectedTags, setSelectedTags] = useState([])
  const [receiptNotice, setReceiptNotice] = useState(false)

  const format = (amount) => new Intl.NumberFormat('fr-FR').format(amount)

  const toggleTag = (tag) => {
    setSelectedTags((prev) => (prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]))
  }

  const handleFinish = () => {
    setRideStatus('completed')
    setRating(0)
    setSelectedTags([])
    navigate('/client/home')
  }

  return (
    <div className="flex-1 overflow-y-auto bg-[#f4f6fa] px-5 pb-3 pt-8 flex flex-col gap-4">
      <div className="text-center">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-taga-green text-3xl text-white shadow-[0_8px_20px_rgba(54,171,82,0.25)]">✓</div>
        <h1 className="mt-3 text-xl font-bold text-taga-navy">Arrivé à bon port</h1>
        <p className="mt-1 text-[10px] font-medium uppercase tracking-wide text-gray-400">
          {COMPLETION_META} · {ride.durationMin} min · {ride.distanceKm} km
        </p>
      </div>

      <div className="rounded-2xl bg-white p-4 shadow-sm">
        <div className="flex items-start justify-between">
          <AmountTile label="Total payé" amount={ride.price} size="xl" />
          <span className="text-[10px] font-medium text-gray-400">#TGA-8421</span>
        </div>
        <div className="my-3 h-px bg-gray-100" />
        <div className="flex flex-col gap-1 text-xs text-gray-500">
          <div className="flex justify-between"><span>Course de base</span><span className="font-semibold text-taga-navy">{format(ride.baseFare)} F</span></div>
          <div className="flex justify-between"><span>Distance · {ride.distanceKm} km</span><span className="font-semibold text-taga-navy">{format(ride.distanceFee)} F</span></div>
          <div className="flex justify-between"><span>Frais de service</span><span className="font-semibold text-taga-navy">{format(ride.serviceFee)} F</span></div>
        </div>
        {defaultPayment && (
          <div className="mt-3 flex items-center gap-2 rounded-xl bg-gray-50 px-3 py-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-orange-500 text-[9px] font-bold text-white">OM</span>
            <span className="flex-1 text-xs"><strong>{defaultPayment.label}</strong><span className="block text-[10px] text-gray-400">···· {defaultPayment.maskedNumber.slice(-4)} · Payé</span></span>
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-taga-green text-xs text-white">✓</span>
          </div>
        )}
      </div>

      <div className="rounded-2xl bg-white p-4 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-taga-blue text-sm font-bold text-white">
            {driver.name.split(' ').map((part) => part[0]).join('').slice(0, 2)}
          </div>
          <p className="text-xs text-gray-500">Comment s'est passée la course avec<br /><strong className="text-taga-navy">{driver.name} ?</strong></p>
        </div>
        <div className="mt-3 flex justify-center"><RatingStars value={rating} onChange={setRating} shape="square" /></div>
        <div className="mt-3 flex flex-wrap justify-center gap-2">
          {TAGS.map((tag) => (
            <button
              key={tag}
              type="button"
              onClick={() => toggleTag(tag)}
              className={`text-xs font-semibold px-3 py-1.5 rounded-full border transition-colors ${
                selectedTags.includes(tag) ? 'bg-taga-green text-white border-taga-green' : 'bg-white text-gray-500 border-gray-200'
              }`}
            >
              {tag}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-auto grid grid-cols-2 gap-3">
        <button
          type="button"
          onClick={() => setReceiptNotice(true)}
          className="rounded-xl border border-gray-200 bg-white py-3 text-sm font-semibold text-taga-navy"
        >
          Reçu PDF
        </button>
        <PrimaryButton onClick={handleFinish} disabled={rating === 0}>Envoyer & terminer</PrimaryButton>
      </div>
      {receiptNotice && <p role="status" className="-mt-2 text-center text-[10px] text-gray-500">Le reçu PDF sera disponible après connexion au service de reçus.</p>}
    </div>
  )
}
