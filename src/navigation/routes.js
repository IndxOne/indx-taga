export const ROUTES = {
  splash: '/',
  roleChoice: '/role-choice',
  onboarding: '/onboarding',
  otp: '/otp',
  profile: '/profile',
  rideHistory: '/ride-history',
  paymentMethods: '/payment-methods',
  clientHome: '/client/home',
  clientEstimate: '/client/estimate',
  clientActiveRide: '/client/active-ride',
  clientRideEnd: '/client/ride-end',
  driverOnline: '/driver/online',
  driverIncomingRequest: '/driver/incoming-request',
  driverNavigation: '/driver/navigation',
  driverRideInProgress: '/driver/ride-in-progress',
  driverPayoutRecap: '/driver/payout-recap',
}

export const CLIENT_NAV_ITEMS = [
  { icon: '🏠', label: 'Accueil', path: ROUTES.clientHome },
  { icon: '🧾', label: 'Trajets', path: ROUTES.rideHistory },
  { icon: '💳', label: 'Paiements', path: ROUTES.paymentMethods },
  { icon: '👤', label: 'Profil', path: ROUTES.profile },
]

export const DRIVER_NAV_ITEMS = [
  { icon: '🚗', label: 'Travail', path: ROUTES.driverOnline },
  { icon: '💰', label: 'Gains', path: ROUTES.paymentMethods },
  { icon: '🧾', label: 'Courses', path: ROUTES.rideHistory },
  { icon: '👤', label: 'Profil', path: ROUTES.profile },
]
