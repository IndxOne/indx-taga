import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAppStore } from '../store/useAppStore'
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
    <div className="flex-1 bg-gradient-to-b from-taga-blue to-taga-navy px-5 py-8 flex flex-col text-white">
      <div className="flex items-center gap-2 mb-8">
        <span className="text-taga-green text-2xl">⊤</span>
        <span className="font-bold text-lg">aga</span>
      </div>

      <h1 className="text-3xl font-bold leading-tight">Déplacez-vous en toute simplicité.</h1>
      <p className="text-white/70 mt-3 text-sm">VTC à Abidjan. Chauffeurs professionnels, prix abordables, service rapide.</p>

      <div className="mt-auto pt-8">
        <p className="text-xs text-white/60 mb-2">TON NUMÉRO</p>
        <div className="bg-white rounded-xl text-gray-900">
          <PhoneInput value={phone} onChange={setPhone} />
        </div>
        <div className="mt-4">
          <PrimaryButton variant="green" disabled={!isValid} onClick={handleContinue}>
            Recevoir le code SMS
          </PrimaryButton>
        </div>
        <p className="text-xs text-white/50 text-center mt-3">
          En continuant tu acceptes les Conditions et la Politique de confidentialité.
        </p>
      </div>
    </div>
  )
}
