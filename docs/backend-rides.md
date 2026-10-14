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

> **Mise à jour G0.4 (migration 012, non appliquée).** Les coordonnées ne sont
> plus facultatives côté serveur et `create_ride` n'est plus exécutable par les
> clients : voir la section « Verrouillage de create_ride (012) » ci-dessous.
> Le texte d'origine est conservé pour l'historique : « Les coordonnées restent
> facultatives tant que la cartographie réelle n'est pas livrée. Les libellés sont
> obligatoires. »

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

## Verrouillage de create_ride (012)

`supabase/migrations/012_create_ride_lockdown.sql` — additive, **non appliquée**.
Elle redéfinit `create_ride` (même signature, même identité `auth.uid()`, mêmes
restrictions de rôle, `SECURITY DEFINER`, `search_path` vide) avec deux protections
indépendantes :

1. **Validation serveur des points.** Libellé texte non vide (≤ 240), `lat` et `lng`
   de type JSON *numérique* (refus de l'absence, `null`, texte comme `"NaN"` ou
   `"5.3"`, booléen, objet, tableau), `-90 ≤ lat ≤ 90`, `-180 ≤ lng ≤ 180`, et le
   couple `(0,0)` est refusé. jsonb n'admet ni `NaN` ni `Infinity`. Erreur `22023`.
2. **Désactivation des commandes réelles.** `EXECUTE` est révoqué à `PUBLIC`, `anon`
   et `authenticated` (privilèges hérités compris) sur `create_ride` et sur la
   fonction interne `taga_normalize_ride_point`. Un appel direct renvoie `42501`
   (*permission denied for function create_ride*) et ne crée ni course ni historique.

**Ce que la validation ne prouve pas.** Des coordonnées complètes et bien formées ne
prouvent pas qu'une adresse est authentique : un client peut envoyer une position
plausible mais fausse. Aucun champ `source` fourni par le client n'est une preuve de
provenance (le champ `source` utilisé en React est une garde d'interface, ignorée
par le serveur). C'est pourquoi la désactivation (2) est la vraie garantie, tant
qu'aucune résolution d'adresse n'est faite côté serveur.

`service_role` (clé serveur, jamais embarquée dans un client) n'est pas modifié par
la migration. Aucun accès de contournement n'est ajouté.

### Réactivation (gate distinct, hors de ce lot)
Réversible par une migration ultérieure (013), seulement quand **toutes** les
conditions suivantes sont réunies :

1. une source d'adresse **vérifiée côté serveur** existe (par exemple une Edge
   Function ou RPC qui résout l'adresse auprès d'un fournisseur approuvé, ou un jeton
   de sélection signé par le serveur) ; aucun fournisseur n'est choisi ni implémenté ici ;
2. la migration 013 rouvre l'accès par `grant execute on function public.create_ride(...) to authenticated`
   (ou crée la nouvelle RPC et révoque l'ancienne) après revue de sécurité ;
3. la matrice de recette passe sur un Supabase isolé : `anon` refusé, chauffeur et
   compte suspendu refusés, passager actif accepté, coordonnées invalides refusées,
   RLS de lecture intacte, aucune course créée après refus ;
4. le verrou d'interface est levé (`Home`, `Estimate`, `TRUSTED_POINT_SOURCES`) ;
5. la tarification est décidée (un lot séparé : voir « Montants » dans
   [`g0-integrite-parcours.md`](./g0-integrite-parcours.md)).

Pour annuler une réactivation : rejouer le `revoke all ... from public, anon, authenticated`
(idempotent).

### Recette sans commande cliente
Pour exercer dispatch, transitions 011 et récapitulatif avant la sélection d'adresse
fiable, la course de test est injectée **par le propriétaire de la base de recette**
avec [`supabase/staging/seed_test_ride.sql`](../supabase/staging/seed_test_ride.sql).
Ce script n'est pas une migration : il ne crée aucune fonction, aucun `GRANT`, aucune
RPC joignable par `anon` ou `authenticated`, exige `confirm_isolated_staging=yes` et un
rôle superuser, et ne touche à aucun secret. Les coordonnées qu'il insère sont des
valeurs de test, pas des adresses authentifiées.

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
