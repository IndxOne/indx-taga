import { useNavigate } from 'react-router-dom'
import { useAppStore } from '../../store/useAppStore'
import Icon from '../Icon'
import PrimaryButton from '../PrimaryButton'
import { ROUTES } from '../../navigation/routes'

export default function SessionExpiredOverlay() {
  const navigate = useNavigate()
  const logout = useAppStore((state) => state.logout)

  const handleReconnect = () => {
    logout()
    navigate(ROUTES.onboarding, { replace: true })
  }

  return (
    <div className="absolute inset-0 z-50 flex flex-col items-center justify-center gap-3 bg-white px-8 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-taga-mango/10 text-taga-mango">
        <Icon name="clock" size={24} />
      </div>
      <p className="font-semibold text-gray-700">Session expirée</p>
      <p className="text-sm text-gray-400">Pour ta sécurité, reconnecte-toi pour continuer.</p>
      <div className="mt-2 w-full">
        <PrimaryButton onClick={handleReconnect}>Se reconnecter</PrimaryButton>
      </div>
    </div>
  )
}
