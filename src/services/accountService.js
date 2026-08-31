import { getAuthService } from './authService'

export function toAppProfile(profile) {
  if (!profile) return null
  const passenger = profile.passenger || {}
  const driver = profile.driver || {}
  const vehicle = profile.vehicle || {}

  return {
    fullName: profile.displayName || passenger.display_name || passenger.displayName || driver.display_name || driver.displayName || '',
    phone: profile.phone || '',
    email: passenger.email || '',
    vehicleModel: vehicle.model || '',
    vehiclePlate: vehicle.registration_number || vehicle.registrationNumber || '',
    ratingAvg: Number(driver.rating ?? 0),
    hasDriverProfile: profile.role === 'driver' || Boolean(profile.driver),
    driverVerificationStatus: driver.verification_status || driver.verificationStatus || 'pending',
  }
}

export function ensureCurrentProfile(input) {
  return getAuthService().ensureProfile(input)
}

export function getCurrentProfile() {
  return getAuthService().getProfile()
}

export async function updateCurrentProfile(profile) {
  const result = await getAuthService().updateProfile({
    displayName: profile.fullName,
    email: profile.email,
    vehicleModel: profile.vehicleModel,
    vehiclePlate: profile.vehiclePlate,
  })
  return toAppProfile(result)
}
