import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAppStore } from '../store/useAppStore'
import Logo from '../components/Logo'

export default function Splash() {
  const navigate = useNavigate()
  const role = useAppStore((state) => state.role)

  useEffect(() => {
    const timer = setTimeout(() => {
      if (role === 'driver') {
        navigate('/driver/online', { replace: true })
      } else if (role === 'passenger') {
        navigate('/client/home', { replace: true })
      } else {
        navigate('/role-choice', { replace: true })
      }
    }, 900)
    return () => clearTimeout(timer)
  }, [role, navigate])

  return (
    <div className="flex-1 bg-taga-navy flex items-center justify-center">
      <Logo tone="light" size="lg" />
    </div>
  )
}
