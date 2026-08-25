import { DEV_TEST_PASSENGER_PHONE } from '../store/useAppStore'

const API_URL = import.meta.env.VITE_OTP_API_URL?.replace(/\/$/, '')
const DEMO_MODE = import.meta.env.VITE_DEMO_MODE === 'true'

function getErrorMessage(payload, fallback) {
  return payload?.message || payload?.error || fallback
}

async function request(path, body) {
  const response = await fetch(`${API_URL}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const payload = await response.json().catch(() => ({}))
  if (!response.ok) {
    throw new Error(getErrorMessage(payload, 'Le service OTP est indisponible.'))
  }
  return payload
}

export async function sendOtp({ phone, role }) {
  if (!API_URL) {
    if (!import.meta.env.DEV && !DEMO_MODE) {
      throw new Error('Le service OTP n’est pas configuré.')
    }

    return {
      challengeId: 'dev-challenge',
      phone: role === 'passenger' ? DEV_TEST_PASSENGER_PHONE : phone,
      maskedPhone: role === 'passenger' ? DEV_TEST_PASSENGER_PHONE : phone,
      expiresIn: 300,
      devSimulation: true,
    }
  }

  return request('/send-otp', { phone, role })
}

export async function verifyOtp({ challengeId, code }) {
  if (!API_URL) {
    if (!import.meta.env.DEV && !DEMO_MODE) {
      throw new Error('Le service OTP n’est pas configuré.')
    }
    if (challengeId !== 'dev-challenge' || !/^\d{6}$/.test(code)) {
      throw new Error('Code incorrect ou expiré.')
    }
    return { verified: true, devSimulation: true }
  }

  return request('/verify-otp', { challengeId, code })
}

export async function resendOtp({ phone, role, challengeId }) {
  if (!API_URL) {
    return sendOtp({ phone, role, challengeId })
  }

  return request('/resend-otp', { phone, role, challengeId })
}
