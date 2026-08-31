import { describe, expect, it, vi } from 'vitest'
import { DemoAuthService, SupabaseAuthService } from './authService'

const demoOptions = { delay: [0, 0], failRate: 0 }

describe('DemoAuthService', () => {
  it('demande un OTP pour un numéro normalisé', async () => {
    const service = new DemoAuthService({ simulateOptions: demoOptions })
    const result = await service.requestOtp('07 07 12 34 56')

    expect(result.challengeId).toBe('dev-challenge')
    expect(result.phone).toBe('+225707123456')
    expect(result.expiresIn).toBe(300)
  })

  it('refuse un OTP incorrect', async () => {
    const service = new DemoAuthService({ simulateOptions: demoOptions })
    await service.requestOtp('+2250707123456')

    await expect(service.verifyOtp('+2250707123456', '12345')).rejects.toMatchObject({ code: 'invalid_otp' })
  })

  it('refuse un OTP expiré', async () => {
    const service = new DemoAuthService({ simulateOptions: demoOptions })
    await service.requestOtp('+2250707123456')
    service.pendingOtp.expiresAt = Date.now() - 1

    await expect(service.verifyOtp('+2250707123456', '123456')).rejects.toMatchObject({ code: 'invalid_otp' })
  })

  it('crée une session valide après vérification', async () => {
    const service = new DemoAuthService({ simulateOptions: demoOptions })
    await service.requestOtp('+2250707123456')
    const result = await service.verifyOtp('+2250707123456', '123456')

    expect(result.verified).toBe(true)
    await expect(service.getSession()).resolves.toMatchObject({ user: { phone: '+2250707123456' } })
    await expect(service.getCurrentUser()).resolves.toMatchObject({ id: expect.any(String) })
  })

  it('retrouve la même session après une nouvelle lecture', async () => {
    const service = new DemoAuthService({ simulateOptions: demoOptions })
    await service.requestOtp('+2250707123456')
    await service.verifyOtp('+2250707123456', '123456')

    const firstSession = await service.getSession()
    const refreshedSession = await service.getSession()
    expect(refreshedSession).toEqual(firstSession)
  })

  it('expire une session démo et notifie les abonnés', async () => {
    const service = new DemoAuthService({ simulateOptions: demoOptions })
    const changes = []
    service.subscribeToAuthChanges((session) => changes.push(session))
    await service.requestOtp('+2250707123456')
    await service.verifyOtp('+2250707123456', '123456')
    service.session.expires_at = Math.floor(Date.now() / 1000) - 1

    await expect(service.getSession()).resolves.toBeNull()
    expect(changes.at(-1)).toBeNull()
  })

  it('invalide la session lors de la déconnexion', async () => {
    const service = new DemoAuthService({ simulateOptions: demoOptions })
    await service.requestOtp('+2250707123456')
    await service.verifyOtp('+2250707123456', '123456')
    await service.signOut()

    await expect(service.getSession()).resolves.toBeNull()
    await expect(service.getCurrentUser()).resolves.toBeNull()
  })
})

describe('SupabaseAuthService', () => {
  it('utilise le contrat Supabase Auth sans exposer le client au composant', async () => {
    const client = {
      auth: {
        signInWithOtp: vi.fn().mockResolvedValue({ error: null }),
        verifyOtp: vi.fn().mockResolvedValue({ data: { session: { id: 'session-1' }, user: { id: 'user-1' } }, error: null }),
        getSession: vi.fn().mockResolvedValue({ data: { session: { id: 'session-1' } }, error: null }),
        getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user-1' } }, error: null }),
        signOut: vi.fn().mockResolvedValue({ error: null }),
        onAuthStateChange: vi.fn((callback) => ({ data: { subscription: { unsubscribe: vi.fn() } }, callback })),
      },
    }
    const service = new SupabaseAuthService({ supabaseUrl: 'https://example.supabase.co', supabaseAnonKey: 'public-key' }, client)

    await service.requestOtp('+2250707123456')
    await service.verifyOtp('+2250707123456', '123456')
    await service.getSession()
    await service.getCurrentUser()
    await service.signOut()

    expect(client.auth.signInWithOtp).toHaveBeenCalledWith({ phone: '+2250707123456' })
    expect(client.auth.verifyOtp).toHaveBeenCalledWith({ phone: '+2250707123456', token: '123456', type: 'sms' })
    expect(client.auth.getSession).toHaveBeenCalled()
    expect(client.auth.getUser).toHaveBeenCalled()
    expect(client.auth.signOut).toHaveBeenCalled()
  })
})
