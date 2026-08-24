import { useNavigate } from 'react-router-dom'
import { useAppStore } from '../store/useAppStore'
import RoleCard from '../components/RoleCard'

export default function RoleChoice() {
  const navigate = useNavigate()
  const setRole = useAppStore((state) => state.setRole)

  const selectRole = (role) => {
    setRole(role)
    navigate('/onboarding')
  }

  return (
    <div className="flex-1 bg-taga-navy px-5 py-8 flex flex-col">
      <div className="text-center mb-8">
        <div className="w-10 h-10 mx-auto rounded-lg bg-white/10 text-white flex items-center justify-center font-bold mb-3">
          T
        </div>
        <p className="text-white/60 text-xs">ABIDJAN</p>
        <h1 className="text-white text-2xl font-bold mt-3">Bienvenue.</h1>
        <p className="text-taga-mango text-2xl font-bold">Tu es ici pour quoi ?</p>
      </div>

      <div className="flex flex-col gap-4">
        <RoleCard
          icon="🚕"
          badge="PASSAGER"
          badgeColor="bg-taga-mango"
          title="Je commande une course"
          subtitle="Trouve un VTC ou rejoins un covoiturage"
          onSelect={() => selectRole('passenger')}
        />
        <RoleCard
          icon="🚗"
          badge="CHAUFFEUR"
          badgeColor="bg-taga-green"
          title="Je suis chauffeur"
          subtitle="85% net · Retrait instantané"
          onSelect={() => selectRole('driver')}
        />
      </div>

      <p className="text-white/40 text-xs text-center mt-auto pt-8">Tu peux changer plus tard dans ton profil.</p>
    </div>
  )
}
