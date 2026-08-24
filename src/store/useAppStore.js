import { create } from 'zustand'

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

export const useAppStore = create((set) => ({
  role: null, // 'passenger' | 'driver'
  setRole: (role) => set({ role }),

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
}))
