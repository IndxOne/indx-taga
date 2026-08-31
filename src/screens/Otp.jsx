import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAppStore } from '../store/useAppStore'
import OtpInput from '../components/OtpInput'
import PrimaryButton from '../components/PrimaryButton'
import { resendOtp, verifyOtp } from '../services/otpService'
import { ROUTES } from '../navigation/routes'
import { ensureCurrentProfile, toAppProfile } from '../services/accountService'
import { isDemoMode } from '../services/runtimeConfig'

export default function Otp() {
  const navigate = useNavigate()
  const role = useAppStore((state) => state.role)
  const phone = useAppStore((state) => state.phone)
  const otpChallengeId = useAppStore((state) => state.otpChallengeId)
  const otpMaskedPhone = useAppStore((state) => state.otpMaskedPhone)
  const otpExpiresAt = useAppStore((state) => state.otpExpiresAt)
  const setOtpChallenge = useAppStore((state) => state.setOtpChallenge)
  const setAuthState = useAppStore((state) => state.setAuthState)
  const updateProfile = useAppStore((state) => state.updateProfile)
  const [code, setCode] = useState('')
  const [cooldown, setCooldown] = useState(30)
  const [secondsLeft, setSecondsLeft] = useState(() => Math.max(0, Math.ceil((otpExpiresAt - Date.now()) / 1000)))
  const [isVerifying, setIsVerifying] = useState(false)
  const [isResending, setIsResending] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (cooldown <= 0) return undefined
    const timer = setTimeout(() => setCooldown((c) => c - 1), 1000)
    return () => clearTimeout(timer)
  }, [cooldown])

  useEffect(() => {
    if (!phone || (isDemoMode && !otpChallengeId)) {
      navigate(ROUTES.onboarding, { replace: true })
      return undefined
    }
    const timer = setInterval(() => {
      setSecondsLeft(Math.max(0, Math.ceil((otpExpiresAt - Date.now()) / 1000)))
    }, 1000)
    return () => clearInterval(timer)
  }, [navigate, otpChallengeId, otpExpiresAt, phone])

  const isComplete = code.length === 6
  const isExpired = secondsLeft === 0

  const handleVerify = async () => {
    if (isExpired) {
      setError('Ce code a expiré. Demande un nouveau code pour continuer.')
      return
    }
    setIsVerifying(true)
    setError('')
    try {
      const result = await verifyOtp({ phone, code })
      const backendProfile = await ensureCurrentProfile({ role, phone })
      const appProfile = toAppProfile(backendProfile)
      setAuthState({
        status: 'authenticated',
        user: result.user,
        role: backendProfile.role,
        phone: backendProfile.phone || phone,
      })
      updateProfile(appProfile)
      navigate(backendProfile.role === 'driver' ? ROUTES.driverOnline : ROUTES.clientHome)
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
      setOtpChallenge({
        challengeId: result.challengeId,
        maskedPhone: result.maskedPhone || result.phone || phone,
        expiresIn: result.expiresIn,
      })
      setCode('')
      setCooldown(30)
      setSecondsLeft(result.expiresIn ?? 300)
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

      <div className="mt-10" aria-busy={isVerifying || isResending}>
        <OtpInput value={code} onChange={setCode} disabled={isVerifying || isExpired} invalid={Boolean(error)} />
      </div>

      <p className={`mt-3 text-center text-xs ${isExpired ? 'font-semibold text-red-500' : 'text-gray-400'}`} role="status">
        {isExpired ? 'Code expiré' : `Le code est valable encore ${Math.floor(secondsLeft / 60)}:${String(secondsLeft % 60).padStart(2, '0')}`}
      </p>

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
        <PrimaryButton onClick={handleVerify} disabled={!isComplete || isVerifying || isExpired}>
          {isVerifying ? 'Vérification…' : 'Vérifier'}
        </PrimaryButton>
      </div>
    </div>
  )
}
