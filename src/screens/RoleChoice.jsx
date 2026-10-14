import { useNavigate } from 'react-router-dom'
import { useAppStore } from '../store/useAppStore'
import RoleCard from '../components/RoleCard'
import Logo from '../components/Logo'
import Icon from '../components/Icon'
import { isDemoMode } from '../services/runtimeConfig'

export default function RoleChoice() {
  const navigate = useNavigate()
  const setRole = useAppStore((state) => state.setRole)

  const selectRole = (role) => {
    setRole(role)
    navigate('/onboarding')
  }

  return (
    <div className="flex-1 bg-taga-navy px-5 py-7 flex flex-col">
      <div className="mb-8 text-center">
        <div className="mx-auto mb-3 flex justify-center"><Logo tone="light" /></div>
        <p className="text-xs tracking-[0.25em] text-white/50">ABIDJAN</p>
        <h1 className="mt-7 text-3xl font-extrabold leading-tight text-white">Bienvenue.</h1>
        <p className="text-3xl font-extrabold leading-tight text-taga-mango">Tu es ici pour quoi ?</p>
      </div>

      <div className="flex flex-col gap-3">
        <RoleCard
          icon={<Icon name="taxi" size={24} />}
          badge="PASSAGER"
          badgeColor="bg-taga-mango"
          iconBg="bg-taga-mango"
          title="Je commande une course"
          subtitle="Trouve un VTC ou rejoins un covoiturage"
          onSelect={() => selectRole('passenger')}
        />
        <RoleCard
          icon={<Icon name="car" size={24} />}
          badge="CHAUFFEUR"
          badgeColor="bg-taga-green"
          iconBg="bg-taga-green"
          title="Je suis chauffeur"
          subtitle={isDemoMode ? '85% net · Retrait instantané' : 'Reçois et réalise des courses'}
          onSelect={() => selectRole('driver')}
        />
      </div>

      <p className="text-white/40 text-xs text-center mt-auto pt-8">Tu peux changer plus tard dans ton profil.</p>
    </div>
  )
}
