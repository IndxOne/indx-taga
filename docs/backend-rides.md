# TAGA — contrat création de course (Lot 2)

## Responsabilité

Le client React, FlutterFlow ou une future application mobile appelle le même
contrat backend. Le client ne crée jamais directement une ligne `rides` et ne
transmet pas les champs d'autorité.

```text
Client → RideService → Supabase RPC create_ride → PostgreSQL
                                      ↘ rides + ride_status_history
```

La migration correspondante est `supabase/migrations/002_rides.sql`.

## Opération

`RideService.createRide()` accepte :

```ts
createRide({
  pickup: { label: string, lat?: number, lng?: number },
  destination: { label: string, lat?: number, lng?: number },
  ride_type: 'go' | 'partage' | 'family' | 'confort',
  scheduled_at?: string | null,
})
```

Les coordonnées restent facultatives tant que la cartographie réelle n'est pas
livrée. Les libellés sont obligatoires.

Réponse :

```ts
{
  id,
  passengerId,
  pickup,
  destination,
  rideType,
  scheduledAt,
  status: 'requested',
  estimatedPrice: null,
  createdAt,
  updatedAt,
}
```

## Invariants backend

- l'identité vient de `auth.uid()` ; aucun `passenger_id` n'est accepté dans la
  RPC ;
- seul un profil `passenger` actif peut créer une course ;
- le statut initial est écrit par PostgreSQL à `requested` ;
- `estimated_price` est serveur et reste `null` jusqu'au lot tarification ;
- les écritures directes sur `rides` et `ride_status_history` sont retirées au
  rôle `authenticated` ;
- un passager ne lit que ses propres courses et leur historique ;
- aucune transition de statut n'est exposée dans ce lot.

## FlutterFlow

FlutterFlow appellera la même RPC Supabase avec les paramètres `p_pickup`,
`p_destination`, `p_ride_type` et `p_scheduled_at`. Il ne doit pas ajouter
`passenger_id`, `status` ou `estimated_price` à l'appel.

## Recette Supabase requise avant le lot suivant

Appliquer d'abord `001_profiles_roles.sql`, puis `002_rides.sql` dans le projet
Supabase de recette. Avec de vraies sessions :

- un passager actif peut appeler `create_ride` et obtient une course
  `requested` ainsi qu'une ligne d'historique `requested` ;
- un appel sans session est refusé ;
- un chauffeur, un compte suspendu ou tout autre rôle est refusé ;
- la ligne créée porte toujours l'identifiant de la session courante ;
- une tentative d'écriture directe sur `rides` ou `ride_status_history` est
  refusée ;
- chaque passager ne lit que ses propres courses et leur historique.

Cette recette doit être exécutée avant d'autoriser le matching ou une transition
de statut. Les tests Vitest vérifient le contrat côté dépôt ; ils ne remplacent
pas cette vérification RLS sur le PostgreSQL de recette.

Le dispatch du lot suivant est décrit dans [`backend-dispatch.md`](./backend-dispatch.md)
et dépend de l'application de `supabase/migrations/003_dispatch.sql` après ces
migrations.

## Hors périmètre

Matching, géolocalisation active, transitions, paiement, commission,
notifications, historique métier et notation sont réservés aux lots suivants.
