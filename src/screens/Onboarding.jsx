import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAppStore } from '../store/useAppStore'
import Logo from '../components/Logo'
import PhoneInput from '../components/PhoneInput'
import PrimaryButton from '../components/PrimaryButton'

export default function Onboarding() {
  const navigate = useNavigate()
  const role = useAppStore((state) => state.role)
  const [phone, setPhone] = useState('')

  const isValid = phone.replace(/\D/g, '').length >= 10

  const handleContinue = () => {
    navigate(role === 'driver' ? '/driver/online' : '/client/home')
  }

  return (
    <div
      className="flex-1 px-6 pt-10 pb-8 flex flex-col text-white"
      style={{ background: 'radial-gradient(120% 90% at 15% 0%, #0005D6 0%, #0a1128 65%)' }}
    >
      <Logo tone="light" />

      <h1 className="text-4xl font-bold leading-[1.1] mt-10">Déplacez-vous en toute simplicité.</h1>
      <p className="text-white/70 mt-4 text-sm leading-relaxed max-w-[280px]">
        VTC à Abidjan. Chauffeurs professionnels, prix abordables, service rapide.
      </p>

      <div className="mt-auto pt-10">
        <p className="text-xs font-semibold text-white/50 tracking-wider mb-2">TON NUMÉRO</p>
        <div className="bg-white rounded-xl text-gray-900">
          <PhoneInput value={phone} onChange={setPhone} />
        </div>
        <div className="mt-4">
          <PrimaryButton variant="green" disabled={!isValid} onClick={handleContinue}>
            Recevoir le code SMS
          </PrimaryButton>
        </div>
        <p className="text-xs text-white/50 text-center mt-3 leading-relaxed">
          En continuant tu acceptes les Conditions et la Politique de confidentialité.
        </p>
      </div>
    </div>
  )
}
