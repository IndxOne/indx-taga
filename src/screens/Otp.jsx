import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAppStore } from '../store/useAppStore'
import OtpInput from '../components/OtpInput'
import PrimaryButton from '../components/PrimaryButton'
import { resendOtp, verifyOtp } from '../services/otpService'
import { ROUTES } from '../navigation/routes'

export default function Otp() {
  const navigate = useNavigate()
  const role = useAppStore((state) => state.role)
  const phone = useAppStore((state) => state.phone)
  const otpChallengeId = useAppStore((state) => state.otpChallengeId)
  const otpMaskedPhone = useAppStore((state) => state.otpMaskedPhone)
  const setOtpChallenge = useAppStore((state) => state.setOtpChallenge)
  const [code, setCode] = useState('')
  const [cooldown, setCooldown] = useState(30)
  const [isVerifying, setIsVerifying] = useState(false)
  const [isResending, setIsResending] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (cooldown <= 0) return undefined
    const timer = setTimeout(() => setCooldown((c) => c - 1), 1000)
    return () => clearTimeout(timer)
  }, [cooldown])

  const isComplete = code.length === 6

  const handleVerify = async () => {
    setIsVerifying(true)
    setError('')
    try {
      await verifyOtp({ challengeId: otpChallengeId, code })
      navigate(role === 'driver' ? ROUTES.driverOnline : ROUTES.clientHome)
    } catch (verifyError) {
      setError(verifyError.message)
    } finally {
      setIsVerifying(false)
    }
  }

  const handleResend = async () => {
    setIsResending(true)
    setError('')
    try {
      const result = await resendOtp({ phone, role, challengeId: otpChallengeId })
      setOtpChallenge({ challengeId: result.challengeId, maskedPhone: result.maskedPhone || result.phone || phone })
      setCode('')
      setCooldown(30)
    } catch (resendError) {
      setError(resendError.message)
    } finally {
      setIsResending(false)
    }
  }

  const handleChangePhone = () => {
    navigate(ROUTES.onboarding)
  }

  return (
    <div className="flex-1 px-6 pt-12 pb-8 flex flex-col">
      <h1 className="text-2xl font-bold text-taga-navy">Vérifie ton numéro</h1>
      <div className="flex items-center gap-2 mt-2">
        <p className="text-sm text-gray-500">Code envoyé au {otpMaskedPhone || phone || '+225 07 07 12 34 56'}</p>
        <button type="button" onClick={handleChangePhone} className="text-xs font-semibold text-taga-blue whitespace-nowrap">
          Modifier
        </button>
      </div>

      <div className="mt-10">
        <OtpInput value={code} onChange={setCode} />
      </div>

      <button
        type="button"
        disabled={cooldown > 0 || isResending}
        onClick={handleResend}
        className="text-sm font-semibold text-taga-blue text-center mt-6 disabled:text-gray-300"
      >
        {isResending ? 'Renvoi en cours…' : cooldown > 0 ? `Renvoyer le code (${cooldown}s)` : 'Renvoyer le code'}
      </button>

      {error && <p role="alert" className="text-sm text-red-500 text-center mt-4">{error}</p>}

      <div className="mt-auto">
        <PrimaryButton onClick={handleVerify} disabled={!isComplete || isVerifying}>
          {isVerifying ? 'Vérification…' : 'Vérifier'}
        </PrimaryButton>
      </div>
    </div>
  )
}
