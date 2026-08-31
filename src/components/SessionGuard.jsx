import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAppStore } from '../store/useAppStore'
import { getCurrentProfile, toAppProfile } from '../services/accountService'
import { getAuthService } from '../services/authService'
import { isDemoMode } from '../services/runtimeConfig'
import { canAccessRole } from '../services/accessControl'
import { ROUTES } from '../navigation/routes'
import LoadingState from './states/LoadingState'
import RetryError from './states/RetryError'

const roleLanding = {
  passenger: ROUTES.clientHome,
  driver: ROUTES.driverOnline,
}

export default function SessionGuard({ children, requiredRole }) {
  const navigate = useNavigate()
  const setAuthState = useAppStore((state) => state.setAuthState)
  const updateProfile = useAppStore((state) => state.updateProfile)
  const [attempt, setAttempt] = useState(0)
  const [state, setState] = useState({ status: 'loading', profileRole: null, error: null })

  useEffect(() => {
    let cancelled = false
    let timer

    const handleSession = async (session) => {
      if (cancelled) return
      if (!session) {
        setAuthState({ status: 'unauthenticated' })
        navigate(ROUTES.roleChoice, { replace: true })
        return
      }

      try {
        const backendProfile = await getCurrentProfile()
        if (!backendProfile) {
          throw new Error('Profil TAGA introuvable pour cette session.')
        }
        const appProfile = toAppProfile(backendProfile)
        setAuthState({
          status: 'authenticated',
          user: session.user,
          role: backendProfile.role,
          phone: backendProfile.phone || session.user.phone || '',
        })
        updateProfile(appProfile)
        if (requiredRole && !canAccessRole(requiredRole, backendProfile.role)) {
          navigate(roleLanding[backendProfile.role] || ROUTES.roleChoice, { replace: true })
          return
        }
        setState({ status: 'ready', profileRole: backendProfile.role, error: null })
      } catch (error) {
        if (cancelled) return
        setAuthState({ status: 'unauthenticated' })
        setState({ status: 'error', profileRole: null, error })
      }
    }

    const load = async () => {
      try {
        const auth = getAuthService()
        const unsubscribe = auth.subscribeToAuthChanges((session) => {
          void handleSession(session)
        })
        const session = await auth.getSession()
        await handleSession(session)
        if (isDemoMode) {
          timer = setInterval(async () => {
            const currentSession = await auth.getSession()
            await handleSession(currentSession)
          }, 5000)
        }
        return unsubscribe
      } catch (error) {
        if (!cancelled) {
          setAuthState({ status: 'unauthenticated' })
          setState({ status: 'error', profileRole: null, error })
        }
        return undefined
      }
    }

    let unsubscribe
    void load().then((cleanup) => {
      unsubscribe = cleanup
    })
    return () => {
      cancelled = true
      clearInterval(timer)
      unsubscribe?.()
    }
  }, [attempt, navigate, requiredRole, setAuthState, updateProfile])

  if (state.status === 'loading') return <LoadingState label="Vérification de la session…" />
  if (state.status === 'error') {
    return (
      <RetryError
        title="Connexion indisponible"
        subtitle={state.error?.message || 'Impossible de vérifier ta session.'}
        onRetry={() => {
          setState({ status: 'loading', profileRole: null, error: null })
          setAttempt((value) => value + 1)
        }}
      />
    )
  }

  return <div className="relative flex flex-1 flex-col">{children}</div>
}
