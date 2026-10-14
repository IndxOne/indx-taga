import { create } from 'zustand'
import { RIDE_FARES } from '../services/rideFare'
import { isDemoMode } from '../services/runtimeConfig'

export const MOCK_DRIVER = {
  name: 'Mamadou Ndour',
  rating: 4.93,
  yearsExperience: 3,
  vehicle: { plate: 'TAGA-001', model: 'Ford Kia Rio', color: 'Blanc' },
}

export const MOCK_RIDE = {
  pickupLabel: 'Cocody, Riviera 3',
  pickupDetail: 'Rue M38, vers la station Total',
  dropoffLabel: 'Plateau, Imm. CAISTAB',
  distanceKm: 14.2,
  durationMin: 24,
  price: RIDE_FARES.go,
  baseFare: 2600,
  distanceFee: 500,
  serviceFee: 100,
  driverEarning: 2720,
}

export const RIDE_OPTIONS = [
  { id: 'go', name: 'TAGA Go', badge: 'POPULAIRE', description: 'Standard · 4 pers. Corolla, Yaris...', price: RIDE_FARES.go, originalPrice: 3800 },
  { id: 'partage', name: 'TAGA Partage', badge: '-40%', description: 'Covoiturage · 5 min d\'attente', price: RIDE_FARES.partage },
  { id: 'family', name: 'TAGA Family', badge: null, description: 'Jusqu\'à 6 pers. Monospace', price: RIDE_FARES.family },
  { id: 'confort', name: 'TAGA Confort', badge: null, description: 'Premium · clim. Camry, Accord...', price: RIDE_FARES.confort },
]

export const MOCK_PROFILE = {
  fullName: 'Akissi Koffi',
  phone: '+225 07 07 12 34 56',
  email: '',
  vehicleModel: 'Ford Kia Rio',
  vehiclePlate: 'TAGA-001',
  ratingAvg: 4.9,
  hasDriverProfile: true,
  driverVerificationStatus: 'verified', // pending | verified | rejected
}

export const MOCK_RIDE_HISTORY = [
  { id: 'r1', date: '22 août', pickupLabel: 'Cocody, Riviera 3', dropoffLabel: 'Plateau, Imm. CAISTAB', amount: 3200, driverAmount: 2720 },
  { id: 'r2', date: '20 août', pickupLabel: 'Marcory, Zone 4', dropoffLabel: 'Cocody, Riviera 3', amount: 2400, driverAmount: 2040 },
  { id: 'r3', date: '17 août', pickupLabel: 'Plateau, Tour CAISTAB', dropoffLabel: 'Port-Bouët, Aéroport FHB', amount: 6800, driverAmount: 5780 },
]

export const MOCK_PAYMENT_METHODS = [
  { id: 'pm1', provider: 'orange_money', label: 'Orange Money', maskedNumber: '07 •••• 1284', isDefault: true },
  { id: 'pm2', provider: 'wave', label: 'Wave', maskedNumber: '01 •••• 9921', isDefault: false },
]

// Mode réel : aucune donnée fictive. Le store n'est qu'un cache d'affichage des
// réponses serveur. Départ et destination démarrent vides : ils ne peuvent être
// renseignés que par une source fiable (voir ridePoints.js).
export const REAL_RIDE = {
  id: null,
  pickup: null,
  destination: null,
  pickupLabel: '',
  dropoffLabel: '',
  distanceKm: null,
  durationMin: null,
  estimatedPrice: null,
  price: null,
  driverEarning: null,
}

export const REAL_PROFILE = {
  fullName: '',
  phone: '',
  email: '',
  vehicleModel: '',
  vehiclePlate: '',
  ratingAvg: 0,
  hasDriverProfile: false,
  driverVerificationStatus: 'pending',
}

const initialRide = isDemoMode ? MOCK_RIDE : REAL_RIDE

export const useAppStore = create((set) => ({
  role: null, // 'passenger' | 'driver'
  setRole: (role) => set({ role }),

  authStatus: 'unknown', // unknown | loading | authenticated | unauthenticated
  authUser: null,
  setAuthState: ({ status, user = null, role = null, phone = '' } = {}) => set({
    authStatus: status,
    authUser: user,
    role,
    phone,
  }),

  phone: '',
  setPhone: (phone) => set({ phone }),
  otpChallengeId: '',
  otpMaskedPhone: '',
  otpExpiresAt: 0,
  setOtpChallenge: ({ challengeId, maskedPhone, expiresIn = 300 }) => set({
    otpChallengeId: challengeId,
    otpMaskedPhone: maskedPhone,
    otpExpiresAt: Date.now() + (expiresIn * 1000),
  }),
  clearOtpChallenge: () => set({ otpChallengeId: '', otpMaskedPhone: '', otpExpiresAt: 0 }),

  ride: initialRide,
  resetRide: () => set({ ride: initialRide, rideStatus: 'idle' }),
  setRide: (ride) => set({ ride }),
  updateRide: (patch) => set((state) => ({
    ride: {
      ...state.ride,
      ...(typeof patch === 'function' ? patch(state.ride) : patch),
    },
  })),
  driver: isDemoMode ? MOCK_DRIVER : null,

  selectedRideOptionId: 'go',
  setSelectedRideOptionId: (id) => set({ selectedRideOptionId: id }),

  rideStatus: 'idle', // idle | searching | driver_en_route | arrived | in_progress | completed
  setRideStatus: (rideStatus) => set({ rideStatus }),

  driverAvailable: false,
  setDriverAvailable: (driverAvailable) => set({ driverAvailable }),

  // Revenus, courses du jour et solde : démo uniquement (null = non disponible).
  driverEarningsToday: isDemoMode ? 22400 : null,
  driverRidesToday: isDemoMode ? 9 : null,
  driverHoursOnline: isDemoMode ? '5h24' : null,

  driverWalletBalance: isDemoMode ? 25120 : null,
  creditRideEarning: (amount) =>
    set((state) => ({ driverWalletBalance: (state.driverWalletBalance ?? 0) + amount })),

  rating: 0,
  setRating: (rating) => set({ rating }),

  profile: isDemoMode ? MOCK_PROFILE : REAL_PROFILE,
  updateProfile: (profile) => set((state) => ({ profile: { ...state.profile, ...profile } })),
  rideHistory: isDemoMode ? MOCK_RIDE_HISTORY : [],

  paymentMethods: isDemoMode ? MOCK_PAYMENT_METHODS : [],
  addPaymentMethod: (method) =>
    set((state) => ({ paymentMethods: [...state.paymentMethods, method] })),
  removePaymentMethod: (id) =>
    set((state) => ({ paymentMethods: state.paymentMethods.filter((m) => m.id !== id) })),
  setDefaultPaymentMethod: (id) =>
    set((state) => ({
      paymentMethods: state.paymentMethods.map((m) => ({ ...m, isDefault: m.id === id })),
    })),

  logout: () => set({
    role: null,
    authStatus: 'unauthenticated',
    authUser: null,
    phone: '',
    otpChallengeId: '',
    otpMaskedPhone: '',
    otpExpiresAt: 0,
    ride: initialRide,
    rideStatus: 'idle',
    driverAvailable: false,
  }),
}))
