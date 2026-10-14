// Copie d'affichage d'une course renvoyée par le serveur. Le store ne dérive
// jamais un statut ou un montant : il ne fait que refléter cette réponse.
export function mapServerRideToStore(ride) {
  return {
    id: ride.id,
    passengerId: ride.passengerId,
    driverId: ride.driverId,
    pickup: ride.pickup,
    destination: ride.destination,
    pickupLabel: ride.pickupLabel,
    dropoffLabel: ride.dropoffLabel,
    rideType: ride.rideType,
    scheduledAt: ride.scheduledAt,
    status: ride.status,
    estimatedPrice: ride.estimatedPrice,
    finalPrice: ride.finalPrice ?? null,
    driverEarning: ride.driverEarning ?? null,
    paymentStatus: ride.paymentStatus ?? null,
    assignedAt: ride.assignedAt,
    dispatchDeadlineAt: ride.dispatchDeadlineAt,
    createdAt: ride.createdAt,
    updatedAt: ride.updatedAt,
  }
}
