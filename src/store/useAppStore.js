import { create } from 'zustand'

export const DEV_TEST_PASSENGER_PHONE = '+330775679067'

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
  price: 3200,
  baseFare: 2600,
  distanceFee: 500,
  serviceFee: 100,
  driverEarning: 2720,
}

export const RIDE_OPTIONS = [
  { id: 'go', name: 'TAGA Go', badge: 'POPULAIRE', description: 'Standard · 4 pers. Corolla, Yaris...', price: 3200, originalPrice: 3800 },
  { id: 'partage', name: 'TAGA Partage', badge: '-40%', description: 'Covoiturage · 5 min d\'attente', price: 1900 },
  { id: 'family', name: 'TAGA Family', badge: null, description: 'Jusqu\'à 6 pers. Monospace', price: 4500 },
  { id: 'confort', name: 'TAGA Confort', badge: null, description: 'Premium · clim. Camry, Accord...', price: 4200 },
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

export const useAppStore = create((set) => ({
  role: null, // 'passenger' | 'driver'
  setRole: (role) => set({ role }),

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

  ride: MOCK_RIDE,
  driver: MOCK_DRIVER,

  selectedRideOptionId: 'go',
  setSelectedRideOptionId: (id) => set({ selectedRideOptionId: id }),

  rideStatus: 'idle', // idle | searching | driver_en_route | arrived | in_progress | completed
  setRideStatus: (rideStatus) => set({ rideStatus }),

  driverAvailable: false,
  setDriverAvailable: (driverAvailable) => set({ driverAvailable }),

  driverEarningsToday: 22400,
  driverRidesToday: 9,
  driverHoursOnline: '5h24',

  driverWalletBalance: 25120,
  creditRideEarning: (amount) =>
    set((state) => ({ driverWalletBalance: state.driverWalletBalance + amount })),

  rating: 0,
  setRating: (rating) => set({ rating }),

  profile: MOCK_PROFILE,
  updateProfile: (profile) => set((state) => ({ profile: { ...state.profile, ...profile } })),
  rideHistory: MOCK_RIDE_HISTORY,

  paymentMethods: MOCK_PAYMENT_METHODS,
  addPaymentMethod: (method) =>
    set((state) => ({ paymentMethods: [...state.paymentMethods, method] })),
  removePaymentMethod: (id) =>
    set((state) => ({ paymentMethods: state.paymentMethods.filter((m) => m.id !== id) })),
  setDefaultPaymentMethod: (id) =>
    set((state) => ({
      paymentMethods: state.paymentMethods.map((m) => ({ ...m, isDefault: m.id === id })),
    })),

  logout: () => set({ role: null, phone: '', otpChallengeId: '', otpMaskedPhone: '', otpExpiresAt: 0, rideStatus: 'idle', driverAvailable: false }),
}))
