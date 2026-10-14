# TAGA — disponibilité et dispatch (Lot 3)

## Périmètre

Le Lot 3 prépare le premier dispatch serveur sans introduire de cartographie,
de paiement ni de suivi temps réel. La production reste en mode démo ; le
contrat a été décrit pour la migration `003_dispatch.sql` (historique). Toute application
ou tout rejeu d'une migration sur un projet Supabase suit [`staging-recette.md`](./staging-recette.md) :
inventaire préalable, autorisation explicite.

## Disponibilité chauffeur

Un chauffeur peut passer `available` uniquement si :

- sa session est authentifiée ;
- son profil `profiles` est `driver` et `active` ;
- son profil chauffeur est `verified` ;
- un véhicule `active` lui est rattaché.

Un chauffeur peut repasser `offline` tant qu’il n’est pas `on_ride`. La
disponibilité et `available_since` sont modifiés exclusivement par la RPC
`set_driver_availability(boolean)`. Une mise à jour directe de
`driver_profiles` reste refusée par le trigger serveur.

## Règles de matching provisoires

Avant la cartographie réelle, le matching ne compare pas la distance. Il
retient le premier chauffeur qui respecte toutes les conditions suivantes :

- profil actif et vérifié ;
- véhicule actif ;
- disponibilité `available` ;
- aucune offre `offered` en cours ;
- aucune course `assigned`, `arriving`, `arrived` ou `in_progress`.

L’ordre est stable : `available_since ASC`, puis `user_id ASC`. Cette règle
sera remplacée par une sélection géographique au lot cartographie, sans changer
le contrat d’acceptation.

## Offre et délais

Une demande passe de `requested` à `searching` via
`request_ride_dispatch(uuid)`. La recherche est ouverte pendant 120 secondes.
Chaque offre chauffeur est unique pour la course et pour le chauffeur et
expire au bout de 30 secondes.

```text
Ride.status       requested → searching → assigned
Offer.status      offered → accepted | rejected | expired
```

Une seule offre active peut exister pour une course et un chauffeur à la fois.
Les index uniques partiels garantissent cette règle même sous appels
concurrents.

## Concurrence et acteurs

- Le passager authentifié peut lancer le dispatch uniquement pour sa course.
- Le chauffeur authentifié peut accepter, refuser ou expirer uniquement ses
  propres offres.
- L’acceptation verrouille la course dans PostgreSQL ; le premier appel valide
  gagne et les réponses concurrentes deviennent idempotentes.
- Une acceptation attribue la course, passe le chauffeur à `on_ride` et écrit
  l’historique `assigned` dans la même transaction.
- Un refus ou une expiration libère l’offre et tente le chauffeur suivant.
- Si la date limite de 120 secondes est dépassée, la course passe à
  `no_driver` avec son entrée d’historique.

## Opérations exposées

| Opération | Acteur | Résultat |
| --- | --- | --- |
| `set_driver_availability(p_available)` | chauffeur | disponibilité serveur |
| `request_ride_dispatch(p_ride_id)` | passager propriétaire | `searching` et offre éventuelle |
| `respond_to_ride_offer(p_offer_id, p_decision)` | chauffeur destinataire | attribution atomique ou refus |
| `expire_ride_dispatch_offer(p_offer_id)` | chauffeur destinataire | expiration serveur |

`create_next_ride_dispatch_offer` est interne et n’est pas exécutable par le
client. Aucune transition de course ne doit être écrite depuis Zustand ou
directement depuis React.

## Hors périmètre

La position GPS, l’autocomplete, le rayon de recherche, le realtime, la
notification push, le paiement et les transitions `arriving` à `completed`
restent réservés aux lots suivants.
