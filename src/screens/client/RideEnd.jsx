import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAppStore } from '../../store/useAppStore'
import AmountTile from '../../components/AmountTile'
import RatingStars from '../../components/RatingStars'
import PrimaryButton from '../../components/PrimaryButton'

const TAGS = ['Conduite 🚗', 'À l\'heure 🕒', 'Voiture propre ✨']

export default function RideEnd() {
  const navigate = useNavigate()
  const ride = useAppStore((state) => state.ride)
  const driver = useAppStore((state) => state.driver)
  const rating = useAppStore((state) => state.rating)
  const setRating = useAppStore((state) => state.setRating)
  const setRideStatus = useAppStore((state) => state.setRideStatus)
  const [selectedTags, setSelectedTags] = useState([])

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
    <div className="flex-1 px-5 py-8 flex flex-col gap-5">
      <div className="text-center">
        <div className="w-16 h-16 mx-auto rounded-2xl bg-taga-green text-white flex items-center justify-center text-3xl">✓</div>
        <h1 className="font-bold text-xl mt-3">Arrivé à bon port ✨</h1>
      </div>

      <div className="bg-gray-50 rounded-2xl p-4 flex flex-col gap-2">
        <AmountTile label="Total payé" amount={ride.price} size="xl" />
        <div className="text-sm text-gray-500 flex justify-between"><span>Course de base</span><span>{format(ride.baseFare)} F</span></div>
        <div className="text-sm text-gray-500 flex justify-between"><span>Distance · {ride.distanceKm} km</span><span>{format(ride.distanceFee)} F</span></div>
        <div className="text-sm text-gray-500 flex justify-between"><span>Frais de service</span><span>{format(ride.serviceFee)} F</span></div>
      </div>

      <div>
        <p className="text-sm text-gray-500 mb-2">Comment s'est passée la course avec {driver.name} ?</p>
        <RatingStars value={rating} onChange={setRating} />
        <div className="flex flex-wrap gap-2 mt-3">
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

      <div className="mt-auto flex flex-col gap-3">
        <button type="button" className="text-taga-navy text-sm font-semibold border border-gray-200 rounded-xl py-3">Reçu PDF</button>
        <PrimaryButton onClick={handleFinish} disabled={rating === 0}>Envoyer & terminer</PrimaryButton>
      </div>
    </div>
  )
}
