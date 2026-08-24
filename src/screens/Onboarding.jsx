import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Logo from '../components/Logo'
import PhoneInput from '../components/PhoneInput'
import PrimaryButton from '../components/PrimaryButton'
import { DEV_TEST_PASSENGER_PHONE, useAppStore } from '../store/useAppStore'
import { sendOtp } from '../services/otpService'

export default function Onboarding() {
  const navigate = useNavigate()
  const role = useAppStore((state) => state.role)
  const savePhone = useAppStore((state) => state.setPhone)
  const setOtpChallenge = useAppStore((state) => state.setOtpChallenge)
  const [phone, setPhone] = useState('')
  const [isSending, setIsSending] = useState(false)
  const [error, setError] = useState('')
  const usesTestPassengerPhone = import.meta.env.DEV && role === 'passenger'

  const isValid = usesTestPassengerPhone
    ? phone.trim().length > 0
    : phone.replace(/\D/g, '').length >= 10

  const handleContinue = async () => {
    setIsSending(true)
    setError('')
    const targetPhone = usesTestPassengerPhone ? DEV_TEST_PASSENGER_PHONE : phone
    try {
      const result = await sendOtp({ phone: targetPhone, role })
      savePhone(result.phone || targetPhone)
      setOtpChallenge({ challengeId: result.challengeId, maskedPhone: result.maskedPhone || result.phone || targetPhone })
      navigate('/otp')
    } catch (sendError) {
      setError(sendError.message)
    } finally {
      setIsSending(false)
    }
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
        {usesTestPassengerPhone && (
          <p className="text-xs text-white/55 mt-2 text-center">
            Mode test actif : le code sera envoyé au numéro de test configuré.
          </p>
        )}
        <div className="mt-4">
          <PrimaryButton variant="green" disabled={!isValid || isSending} onClick={handleContinue}>
            {isSending ? 'Envoi en cours…' : 'Recevoir le code SMS'}
          </PrimaryButton>
        </div>
        {error && <p role="alert" className="text-xs text-red-200 text-center mt-3">{error}</p>}
        <p className="text-xs text-white/50 text-center mt-3 leading-relaxed">
          En continuant tu acceptes les Conditions et la Politique de confidentialité.
        </p>
      </div>
    </div>
  )
}
