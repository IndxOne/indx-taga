import { useNavigate } from 'react-router-dom'
import MapView from '../../components/MapView'
import BottomNavBar from '../../components/BottomNavBar'
import Icon from '../../components/Icon'

const FAVORITES = [
  { icon: 'home', label: 'Maison', sub: 'Cocody · Riviera 3', accent: 'bg-indigo-50' },
  { icon: 'briefcase', label: 'Bureau', sub: 'Plateau · Tour CAISTAB', accent: 'bg-emerald-50' },
  { icon: 'route', label: 'Aéroport FHB', sub: 'Port-Bouët · 23 km', accent: 'bg-violet-50' },
]

export default function Home() {
  const navigate = useNavigate()

  return (
    <div className="flex-1 flex flex-col">
      <MapView className="h-64 shrink-0" aria-label="Carte de votre position actuelle">
        <div className="absolute left-4 right-4 top-4 z-10 flex items-center gap-2 rounded-xl bg-white/95 px-3 py-2 shadow-md">
          <span className="h-2 w-2 rounded-full bg-taga-green shadow-[0_0_0_4px_rgba(0,168,120,0.15)]" />
          <div>
            <p className="text-[9px] font-semibold uppercase tracking-wide text-gray-400">Position actuelle</p>
            <p className="text-xs font-semibold text-taga-navy">Cocody, Riviera 3</p>
          </div>
        </div>
        <svg className="pointer-events-none absolute inset-0 h-full w-full" viewBox="0 0 430 320" preserveAspectRatio="none" aria-hidden="true">
          <path d="M176 320 L176 204 L300 204 L300 92" fill="none" stroke="#ffffff" strokeWidth="11" strokeLinecap="round" />
          <path d="M176 320 L176 204 L300 204 L300 92" fill="none" stroke="#0005d6" strokeWidth="4" strokeLinecap="round" />
          <circle cx="176" cy="320" r="7" fill="#0005d6" stroke="#ffffff" strokeWidth="4" />
          <circle cx="300" cy="92" r="7" fill="#00a878" stroke="#ffffff" strokeWidth="4" />
        </svg>
      </MapView>

      <div className="flex-1 bg-white -mt-6 rounded-t-3xl px-5 py-6 flex flex-col gap-5">
        <div className="mx-auto -mt-2 h-1 w-10 rounded-full bg-gray-200" aria-hidden="true" />
        <div>
          <h1 className="text-xl font-bold">Bonjour Akissi</h1>
          <p className="text-gray-500 text-sm">Où on va aujourd'hui ?</p>
        </div>

        <button
          type="button"
          onClick={() => navigate('/client/estimate')}
          className="border border-gray-200 rounded-xl px-4 py-3 text-left text-gray-400 flex items-center justify-between"
        >
          <span>Saisir une destination...</span>
          <span className="rounded-lg bg-taga-blue/10 px-2 py-1 text-xs font-semibold text-taga-blue">Tap →</span>
        </button>

        <div className="flex flex-col gap-3">
          {FAVORITES.map((favorite) => (
            <button
              key={favorite.label}
              type="button"
              onClick={() => navigate('/client/estimate')}
              aria-label={`Commander une course vers ${favorite.label}`}
              className="flex items-center gap-3 rounded-xl px-1 py-1 text-left transition-colors hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-taga-blue/30"
            >
              <span className={`flex h-10 w-10 items-center justify-center rounded-xl ${favorite.accent}`}><Icon name={favorite.icon} size={19} /></span>
              <span className="flex-1">
                <span className="block font-semibold text-sm">{favorite.label}</span>
                <span className="block text-xs text-gray-400">{favorite.sub}</span>
              </span>
              <span className="pr-1 text-lg text-gray-300" aria-hidden="true">›</span>
            </button>
          ))}
        </div>
      </div>

      <BottomNavBar />
    </div>
  )
}
