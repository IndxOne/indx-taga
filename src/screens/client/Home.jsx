import { useNavigate } from 'react-router-dom'
import MapView from '../../components/MapView'

const FAVORITES = [
  { icon: '🏠', label: 'Maison', sub: 'Cocody · Riviera 3' },
  { icon: '💼', label: 'Bureau', sub: 'Plateau · Tour CAISTAB' },
  { icon: '✈️', label: 'Aéroport FHB', sub: 'Port-Bouët · 23 km' },
]

export default function Home() {
  const navigate = useNavigate()

  return (
    <div className="flex-1 flex flex-col">
      <MapView className="h-64 shrink-0" />

      <div className="flex-1 bg-white -mt-6 rounded-t-3xl px-5 py-6 flex flex-col gap-5">
        <div>
          <h1 className="text-xl font-bold">Bonjour Akissi 👋</h1>
          <p className="text-gray-500 text-sm">Où on va aujourd'hui ?</p>
        </div>

        <button
          type="button"
          onClick={() => navigate('/client/estimate')}
          className="border border-gray-200 rounded-xl px-4 py-3 text-left text-gray-400 flex items-center justify-between"
        >
          <span>Saisir une destination...</span>
          <span className="text-taga-blue text-sm font-semibold">Tap →</span>
        </button>

        <div className="flex flex-col gap-3">
          {FAVORITES.map((favorite) => (
            <button
              key={favorite.label}
              type="button"
              onClick={() => navigate('/client/estimate')}
              className="flex items-center gap-3 text-left"
            >
              <span className="w-9 h-9 rounded-lg bg-gray-100 flex items-center justify-center">{favorite.icon}</span>
              <span>
                <span className="block font-semibold text-sm">{favorite.label}</span>
                <span className="block text-xs text-gray-400">{favorite.sub}</span>
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
