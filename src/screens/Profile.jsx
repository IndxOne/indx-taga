import { useNavigate } from 'react-router-dom'
import { useAppStore } from '../store/useAppStore'
import RatingStars from '../components/RatingStars'
import BottomNavBar from '../components/BottomNavBar'

export default function Profile() {
  const navigate = useNavigate()
  const profile = useAppStore((state) => state.profile)
  const role = useAppStore((state) => state.role)
  const setRole = useAppStore((state) => state.setRole)
  const logout = useAppStore((state) => state.logout)

  const initials = profile.fullName
    .split(' ')
    .map((part) => part[0])
    .join('')
    .slice(0, 2)

  const switchRole = () => {
    const nextRole = role === 'driver' ? 'passenger' : 'driver'
    setRole(nextRole)
    navigate(nextRole === 'driver' ? '/driver/online' : '/client/home')
  }

  const handleLogout = () => {
    logout()
    navigate('/role-choice')
  }

  return (
    <div className="flex-1 flex flex-col">
      <div className="px-6 pt-8 pb-6 flex flex-col items-center text-center border-b border-gray-100">
        <div className="w-16 h-16 rounded-full bg-taga-blue text-white flex items-center justify-center text-xl font-bold">
          {initials}
        </div>
        <p className="font-bold text-lg mt-3">{profile.fullName}</p>
        <p className="text-sm text-gray-400">{profile.phone}</p>
        <div className="mt-2">
          <RatingStars value={Math.round(profile.ratingAvg)} readOnly />
        </div>
      </div>

      {profile.hasDriverProfile && profile.driverVerificationStatus !== 'verified' && (
        <div className="mx-6 mt-4 bg-taga-mango/10 text-taga-mango text-xs font-semibold rounded-lg px-3 py-2">
          Vérification chauffeur {profile.driverVerificationStatus === 'pending' ? 'en cours' : 'refusée'}.
        </div>
      )}

      {!profile.fullName || !profile.email ? (
        <button
          type="button"
          onClick={() => navigate('/complete-profile')}
          className="mx-6 mt-4 flex items-center justify-between rounded-xl border border-taga-mango/30 bg-taga-mango/10 px-4 py-3 text-left"
        >
          <span>
            <strong className="block text-sm text-taga-navy">Profil à compléter</strong>
            <span className="text-xs text-gray-500">Ajoutez vos informations pour continuer.</span>
          </span>
          <span className="text-taga-mango" aria-hidden="true">→</span>
        </button>
      ) : (
        <div className="mx-6 mt-4 flex items-center gap-2 rounded-xl bg-taga-green/10 px-4 py-3 text-xs font-semibold text-taga-green" role="status">
          <span aria-hidden="true">✓</span>
          Profil complété
        </div>
      )}

      <div className="flex-1 px-6 py-4 flex flex-col gap-1">
        <button
          type="button"
          onClick={() => navigate('/complete-profile')}
          className="flex items-center justify-between py-3 border-b border-gray-100 text-left"
        >
          <span className="text-sm font-medium">Modifier mon profil</span>
          <span className="text-gray-300">→</span>
        </button>
        <button
          type="button"
          onClick={() => navigate('/payment-methods')}
          className="flex items-center justify-between py-3 border-b border-gray-100 text-left"
        >
          <span className="text-sm font-medium">Moyens de paiement</span>
          <span className="text-gray-300">→</span>
        </button>
        <button
          type="button"
          onClick={() => navigate('/ride-history')}
          className="flex items-center justify-between py-3 border-b border-gray-100 text-left"
        >
          <span className="text-sm font-medium">Historique des courses</span>
          <span className="text-gray-300">→</span>
        </button>

        {profile.hasDriverProfile && (
          <button
            type="button"
            onClick={switchRole}
            className="flex items-center justify-between py-3 border-b border-gray-100 text-left"
          >
            <span className="text-sm font-medium">
              Basculer en mode {role === 'driver' ? 'passager' : 'chauffeur'}
            </span>
            <span className="text-gray-300">→</span>
          </button>
        )}

        <button type="button" onClick={handleLogout} className="flex items-center py-3 text-left text-red-500">
          <span className="text-sm font-medium">Déconnexion</span>
        </button>
      </div>

      <BottomNavBar />
    </div>
  )
}
