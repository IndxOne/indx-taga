import { getAuthService } from './authService'

export async function sendOtp({ phone }) {
  return getAuthService().requestOtp(phone)
}

export async function verifyOtp({ phone, code }) {
  return getAuthService().verifyOtp(phone, code)
}

export async function resendOtp({ phone }) {
  return getAuthService().requestOtp(phone)
}
