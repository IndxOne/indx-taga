import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAppStore } from '../store/useAppStore'
import OtpInput from '../components/OtpInput'
import PrimaryButton from '../components/PrimaryButton'

export default function Otp() {
  const navigate = useNavigate()
  const role = useAppStore((state) => state.role)
  const [code, setCode] = useState('')
  const [cooldown, setCooldown] = useState(30)

  useEffect(() => {
    if (cooldown <= 0) return undefined
    const timer = setTimeout(() => setCooldown((c) => c - 1), 1000)
    return () => clearTimeout(timer)
  }, [cooldown])

  const isComplete = code.length === 6

  const handleVerify = () => {
    navigate(role === 'driver' ? '/driver/online' : '/client/home')
  }

  return (
    <div className="flex-1 px-6 pt-12 pb-8 flex flex-col">
      <h1 className="text-2xl font-bold text-taga-navy">Vérifie ton numéro</h1>
      <p className="text-sm text-gray-500 mt-2">Code envoyé au +225 07 07 12 34 56</p>

      <div className="mt-10">
        <OtpInput value={code} onChange={setCode} />
      </div>

      <button
        type="button"
        disabled={cooldown > 0}
        onClick={() => setCooldown(30)}
        className="text-sm font-semibold text-taga-blue text-center mt-6 disabled:text-gray-300"
      >
        {cooldown > 0 ? `Renvoyer le code (${cooldown}s)` : 'Renvoyer le code'}
      </button>

      <div className="mt-auto">
        <PrimaryButton onClick={handleVerify} disabled={!isComplete}>
          Vérifier
        </PrimaryButton>
      </div>
    </div>
  )
}
