export const ROUTES = {
  splash: '/',
  roleChoice: '/role-choice',
  onboarding: '/onboarding',
  otp: '/otp',
  profile: '/profile',
  completeProfile: '/complete-profile',
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
  { icon: 'home', label: 'Accueil', path: ROUTES.clientHome },
  { icon: 'receipt', label: 'Trajets', path: ROUTES.rideHistory },
  { icon: 'card', label: 'Paiements', path: ROUTES.paymentMethods },
  { icon: 'user', label: 'Profil', path: ROUTES.profile },
]

export const DRIVER_NAV_ITEMS = [
  { icon: 'car', label: 'Travail', path: ROUTES.driverOnline },
  { icon: 'wallet', label: 'Gains', path: ROUTES.paymentMethods },
  { icon: 'receipt', label: 'Courses', path: ROUTES.rideHistory },
  { icon: 'user', label: 'Profil', path: ROUTES.profile },
]
