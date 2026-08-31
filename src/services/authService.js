import { DEV_TEST_PASSENGER_PHONE } from '../store/useAppStore'
import { simulate } from './simulate'
import { maskPhone, normalizePhone } from './phone'
import { runtimeConfig } from './runtimeConfig'

const DEMO_USER_ID = '00000000-0000-4000-8000-000000000001'
const DEMO_SESSION_TTL = 180_000

function authError(message, code = 'auth_error') {
  const error = new Error(message)
  error.code = code
  return error
}

function clone(value) {
  return value == null ? value : structuredClone(value)
}

function appProfile({ role, phone, displayName = 'Akissi Koffi', email = '', driver = null, vehicle = null }) {
  return {
    id: DEMO_USER_ID,
    phone,
    role,
    status: 'active',
    displayName,
    passenger: role === 'passenger' ? { displayName, email } : null,
    driver: role === 'driver'
      ? {
          displayName,
          verificationStatus: driver?.verificationStatus || 'verified',
          availabilityStatus: driver?.availabilityStatus || 'offline',
          rating: driver?.rating ?? 4.9,
        }
      : null,
    vehicle: role === 'driver' ? (vehicle || {
      make: '',
      model: 'Ford Kia Rio',
      registrationNumber: 'TAGA-001',
      color: 'Blanc',
      status: 'active',
    }) : null,
  }
}

export class DemoAuthService {
  constructor({ simulateOptions = {}, sessionTtlMs = DEMO_SESSION_TTL } = {}) {
    this.simulateOptions = simulateOptions
    this.sessionTtlMs = sessionTtlMs
    this.pendingOtp = null
    this.session = null
    this.profile = null
    this.listeners = new Set()
  }

  async requestOtp(phone) {
    const normalizedPhone = normalizePhone(phone)
    if (!normalizedPhone) throw authError('Un numéro de téléphone est requis.', 'invalid_phone')

    return simulate(
      () => {
        this.pendingOtp = {
          phone: normalizedPhone,
          expiresAt: Date.now() + 300_000,
        }
        return {
          challengeId: 'dev-challenge',
          phone: normalizedPhone,
          maskedPhone: normalizedPhone === DEV_TEST_PASSENGER_PHONE ? normalizedPhone : maskPhone(normalizedPhone),
          expiresIn: 300,
          devSimulation: true,
        }
      },
      { ...this.simulateOptions, errorMessage: 'Échec de l’envoi du code. Vérifie ta connexion.' },
    )
  }

  async verifyOtp(phone, token) {
    const normalizedPhone = normalizePhone(phone)
    await simulate(true, { ...this.simulateOptions, errorMessage: 'Échec de la vérification. Réessaie.' })

    if (
      !this.pendingOtp ||
      this.pendingOtp.phone !== normalizedPhone ||
      Date.now() > this.pendingOtp.expiresAt ||
      !/^\d{6}$/.test(token)
    ) {
      throw authError('Code incorrect ou expiré.', 'invalid_otp')
    }

    this.session = {
      access_token: 'demo-session-token',
      token_type: 'bearer',
      expires_at: Math.floor((Date.now() + this.sessionTtlMs) / 1000),
      user: { id: DEMO_USER_ID, phone: normalizedPhone },
    }
    this.pendingOtp = null
    this.emit()
    return { verified: true, session: clone(this.session), user: clone(this.session.user), devSimulation: true }
  }

  async getSession() {
    if (this.session && Date.now() >= this.session.expires_at * 1000) {
      await this.signOut()
    }
    return clone(this.session)
  }

  async getCurrentUser() {
    const session = await this.getSession()
    return clone(session?.user || null)
  }

  async signOut() {
    const hadSession = Boolean(this.session)
    this.session = null
    this.pendingOtp = null
    if (hadSession) this.emit()
  }

  subscribeToAuthChanges(callback) {
    this.listeners.add(callback)
    callback(clone(this.session))
    return () => this.listeners.delete(callback)
  }

  async ensureProfile({ role, phone }) {
    const user = await this.getCurrentUser()
    if (!user) throw authError('Session absente. Reconnecte-toi pour continuer.', 'no_session')
    const safeRole = role === 'driver' ? 'driver' : 'passenger'
    this.profile = appProfile({ role: safeRole, phone: user.phone || normalizePhone(phone) })
    return clone(this.profile)
  }

  async getProfile() {
    if (!(await this.getCurrentUser())) return null
    return clone(this.profile)
  }

  async updateProfile(payload) {
    if (!(await this.getCurrentUser()) || !this.profile) {
      throw authError('Profil introuvable. Reconnecte-toi pour continuer.', 'profile_missing')
    }
    this.profile = {
      ...this.profile,
      displayName: payload.displayName ?? this.profile.displayName,
      passenger: this.profile.passenger
        ? { ...this.profile.passenger, displayName: payload.displayName ?? this.profile.passenger.displayName, email: payload.email ?? this.profile.passenger.email }
        : null,
      driver: this.profile.driver
        ? { ...this.profile.driver, displayName: payload.displayName ?? this.profile.driver.displayName }
        : null,
      vehicle: this.profile.vehicle
        ? {
            ...this.profile.vehicle,
            model: payload.vehicleModel ?? this.profile.vehicle.model,
            registrationNumber: payload.vehiclePlate ?? this.profile.vehicle.registrationNumber,
          }
        : null,
    }
    return clone(this.profile)
  }

  emit() {
    const session = clone(this.session)
    this.listeners.forEach((listener) => listener(session))
  }
}

export class SupabaseAuthService {
  constructor(config, client = null) {
    this.config = config
    this.client = client
    this.clientPromise = null
  }

  async getClient() {
    if (this.client) return this.client
    if (!this.clientPromise) {
      this.clientPromise = import('@supabase/supabase-js').then(({ createClient }) => {
        this.client = createClient(this.config.supabaseUrl, this.config.supabaseAnonKey, {
          auth: {
            persistSession: true,
            autoRefreshToken: true,
            detectSessionInUrl: false,
          },
        })
        return this.client
      })
    }
    return this.clientPromise
  }

  async requestOtp(phone) {
    const normalizedPhone = normalizePhone(phone)
    const client = await this.getClient()
    const { error } = await client.auth.signInWithOtp({ phone: normalizedPhone })
    if (error) throw error
    return {
      challengeId: '',
      phone: normalizedPhone,
      maskedPhone: maskPhone(normalizedPhone),
      expiresIn: 300,
    }
  }

  async verifyOtp(phone, token) {
    const normalizedPhone = normalizePhone(phone)
    const client = await this.getClient()
    const { data, error } = await client.auth.verifyOtp({
      phone: normalizedPhone,
      token,
      type: 'sms',
    })
    if (error) throw error
    return { verified: true, session: data.session, user: data.user }
  }

  async getSession() {
    const client = await this.getClient()
    const { data, error } = await client.auth.getSession()
    if (error) throw error
    return data.session
  }

  async getCurrentUser() {
    const client = await this.getClient()
    const { data, error } = await client.auth.getUser()
    if (error) {
      if (error.name === 'AuthSessionMissingError' || error.message?.toLowerCase().includes('session missing')) return null
      throw error
    }
    return data.user
  }

  async signOut() {
    const client = await this.getClient()
    const { error } = await client.auth.signOut()
    if (error) throw error
  }

  subscribeToAuthChanges(callback) {
    let active = true
    let unsubscribe = () => {}
    this.getClient()
      .then((client) => {
        if (!active) return
        const { data } = client.auth.onAuthStateChange((_event, session) => callback(session))
        unsubscribe = () => data.subscription.unsubscribe()
      })
      .catch(() => {})
    return () => {
      active = false
      unsubscribe()
    }
  }

  async getProfile() {
    const client = await this.getClient()
    const user = await this.getCurrentUser()
    if (!user) return null

    const { data: profile, error: profileError } = await client
      .from('profiles')
      .select('id, phone, role, status, created_at, updated_at')
      .eq('id', user.id)
      .maybeSingle()
    if (profileError) throw profileError
    if (!profile) return null

    const result = { ...profile, passenger: null, driver: null, vehicle: null }
    if (profile.role === 'passenger') {
      const { data, error } = await client
        .from('passenger_profiles')
        .select('user_id, display_name, email, created_at, updated_at')
        .eq('user_id', user.id)
        .maybeSingle()
      if (error) throw error
      result.passenger = data
    }
    if (profile.role === 'driver') {
      const { data: driver, error: driverError } = await client
        .from('driver_profiles')
        .select('user_id, display_name, verification_status, availability_status, rating, created_at, updated_at')
        .eq('user_id', user.id)
        .maybeSingle()
      if (driverError) throw driverError
      result.driver = driver

      const { data: vehicle, error: vehicleError } = await client
        .from('vehicles')
        .select('id, driver_id, make, model, registration_number, color, status, created_at, updated_at')
        .eq('driver_id', user.id)
        .maybeSingle()
      if (vehicleError) throw vehicleError
      result.vehicle = vehicle
    }
    return result
  }

  async ensureProfile({ role, phone }) {
    const client = await this.getClient()
    const user = await this.getCurrentUser()
    if (!user) throw authError('Session absente. Reconnecte-toi pour continuer.', 'no_session')
    const existing = await this.getProfile()
    if (existing) return existing

    const safeRole = role === 'driver' ? 'driver' : 'passenger'
    const displayName = user.user_metadata?.full_name || ''
    const { error: profileError } = await client.from('profiles').insert({
      id: user.id,
      phone: user.phone || normalizePhone(phone),
      role: safeRole,
      status: 'active',
    })
    if (profileError && profileError.code !== '23505') throw profileError

    if (safeRole === 'passenger') {
      const { error } = await client.from('passenger_profiles').insert({
        user_id: user.id,
        display_name: displayName,
      })
      if (error && error.code !== '23505') throw error
    } else {
      const { error } = await client.from('driver_profiles').insert({
        user_id: user.id,
        display_name: displayName,
      })
      if (error && error.code !== '23505') throw error
    }
    return this.getProfile()
  }

  async updateProfile(payload) {
    const client = await this.getClient()
    const profile = await this.getProfile()
    const user = await this.getCurrentUser()
    if (!profile || !user) throw authError('Profil introuvable. Reconnecte-toi pour continuer.', 'profile_missing')

    if (profile.role === 'passenger') {
      const { error } = await client
        .from('passenger_profiles')
        .update({ display_name: payload.displayName, email: payload.email || null })
        .eq('user_id', user.id)
      if (error) throw error
    } else {
      const { error: driverError } = await client
        .from('driver_profiles')
        .update({ display_name: payload.displayName })
        .eq('user_id', user.id)
      if (driverError) throw driverError

      if (payload.vehicleModel || payload.vehiclePlate) {
        const vehiclePayload = {
          driver_id: user.id,
          make: '',
          model: payload.vehicleModel || profile.vehicle?.model || '',
          registration_number: payload.vehiclePlate || profile.vehicle?.registration_number || '',
          color: profile.vehicle?.color || '',
          status: profile.vehicle?.status || 'pending',
        }
        const { error: vehicleError } = await client
          .from('vehicles')
          .upsert(vehiclePayload, { onConflict: 'driver_id' })
        if (vehicleError) throw vehicleError
      }
    }
    return this.getProfile()
  }
}

class MisconfiguredAuthService {
  constructor(message) {
    this.message = message
  }

  fail() {
    throw authError(this.message, 'configuration_missing')
  }

  requestOtp() { return this.fail() }
  verifyOtp() { return this.fail() }
  getSession() { return this.fail() }
  getCurrentUser() { return this.fail() }
  signOut() { return this.fail() }
  getProfile() { return this.fail() }
  ensureProfile() { return this.fail() }
  updateProfile() { return this.fail() }
  subscribeToAuthChanges() { this.fail() }
}

let service

export function getAuthService() {
  if (!service) {
    if (runtimeConfig.mode === 'demo') {
      service = new DemoAuthService()
    } else if (runtimeConfig.valid) {
      service = new SupabaseAuthService(runtimeConfig)
    } else {
      service = new MisconfiguredAuthService(runtimeConfig.error)
    }
  }
  return service
}

export function resetAuthServiceForTests() {
  service = undefined
}
