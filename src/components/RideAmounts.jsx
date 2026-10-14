import AmountTile from './AmountTile'

// Montants d'une course en mode RÉEL. Trois notions distinctes, jamais confondues :
// estimation indicative (serveur), montant final (backend métier autoritatif) et
// paiement. Rien n'est calculé ni copié d'un champ vers un autre côté client.
// Le contrat garantit paymentStatus = null tant qu'aucune transaction confirmée
// n'existe : ce composant n'annonce donc jamais « payé » ni un débit.
export default function RideAmounts({ ride }) {
  const hasFinal = Number.isFinite(ride.finalPrice)
  const hasEstimate = Number.isFinite(ride.estimatedPrice)

  return (
    <div className="flex flex-col gap-2">
      {hasFinal && <AmountTile label="Montant final" amount={ride.finalPrice} size="xl" />}
      {!hasFinal && hasEstimate && <AmountTile label="Estimation indicative" amount={ride.estimatedPrice} size="xl" />}
      {!hasFinal && <p className="text-xs leading-5 text-gray-500">Montant final non disponible.</p>}
      <p className="text-xs leading-5 text-gray-500">Paiement : statut non disponible.</p>
    </div>
  )
}
