# TAGA — contrat création de course (Lot 2)

> **État actuel (G0).** Ce document décrit le contrat d'origine (lot 2, migrations
> 001/002) **et** son verrouillage (012). Les migrations 011 et 012 ne sont **pas
> appliquées** sur un projet Supabase distant. Depuis 012, `create_ride` n'est
> exécutable ni par `anon`, ni par `authenticated`, ni par `PUBLIC` : aucun client
> (React, FlutterFlow, mobile) ne peut créer de course. Les sections « Responsabilité »,
> « Opération » et « Invariants backend » décrivent le contrat **visé** et la forme de
> la RPC, pas une procédure à exécuter. Toute intervention sur un projet Supabase suit
> [`staging-recette.md`](./staging-recette.md).

## Responsabilité

Contrat visé : le client React, FlutterFlow ou une future application mobile
appellerait le même contrat backend. Le client ne crée jamais directement une ligne
`rides` et ne transmet pas les champs d'autorité. **Aujourd'hui (012), aucun client ne
peut appeler `create_ride`** : l'accès est révoqué (voir « Verrouillage de create_ride
(012) »).

```text
Client → RideService → Supabase RPC create_ride → PostgreSQL
                                      ↘ rides + ride_status_history
```

La migration d'origine est `supabase/migrations/002_rides.sql` (étape historique,
non rejouable seule : voir « Procédure historique du lot 2 (obsolète) »). La RPC est
redéfinie par `012_create_ride_lockdown.sql`.

## Opération

Forme de la RPC et de `RideService.createRide()` (contrat visé ; **non appelable par un
client depuis 012**, l'appel renvoie `42501`) :

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

Ces invariants restent vrais pour le corps de la RPC ; ils ne rendent pas l'appel
possible (012 le désactive) :

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
**Aucune réactivation n'est recommandée ni autorisée dans ce lot.** Elle ne pourrait
résulter que d'une décision et d'une revue de sécurité séparées. Elle serait réversible
par une migration ultérieure (013), seulement quand **toutes** les
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
avec [`supabase/staging/seed_test_ride.sql`](../supabase/staging/seed_test_ride.sql)
(script `psql`, pas une migration, pas exécutable dans le SQL Editor). Il refuse sans
confirmation explicite, sans le rôle administratif `postgres`, sans privilèges réels
(pas de `rolsuper` : le `postgres` hébergé ne l'est pas) ou sans passager actif, ne crée
aucune fonction, aucun `GRANT`, aucune RPC, ne touche pas au verrou de `create_ride`, et
annule tout sauf s'il crée exactement 1 course et 2 lignes d'historique. La confirmation
ne prouve pas l'isolation de la base. Procédure validée par un humain :
[`staging-recette.md`](./staging-recette.md).

## FlutterFlow

FlutterFlow **ne peut pas appeler `create_ride`** tant que son accès reste révoqué
(012) : l'appel est refusé par PostgreSQL (`42501`), sans course ni historique. Aucune
configuration FlutterFlow ne doit contourner ce refus (pas de `service_role` embarquée,
pas de table `rides` écrite directement). Quand l'accès sera rouvert par un lot séparé
(voir « Réactivation »), la signature restera `p_pickup`, `p_destination`,
`p_ride_type` et `p_scheduled_at`, sans `passenger_id`, `status` ni `estimated_price`.

## Procédure historique du lot 2 (obsolète)

L'ancienne recette « appliquer `001_profiles_roles.sql` puis `002_rides.sql`, puis
appeler `create_ride` avec de vraies sessions `authenticated` » **n'est plus exécutable
ni à suivre** : 001/002 décrivent une étape historique, `create_ride` est révoquée aux
clients par 012, et un appel `authenticated` doit désormais être **refusé**. Ne rejouez
aucune migration sur la foi de ce document.

## Recette Supabase actuelle

Procédure opérationnelle de référence : [`staging-recette.md`](./staging-recette.md).
Elle est soumise à validation humaine et ne se fait que sur un projet de recette isolé.

1. **Inventaire d'abord.** Avant toute intervention, identifier le projet cible et
   lister les migrations **déjà appliquées** (Dashboard ou `supabase migration list`).
   N'appliquer, ne rejouer ni ne « rattraper » aucune migration sans cet inventaire.
   Les migrations 011 et 012 ne sont **pas** appliquées sur un projet distant à ce jour.
2. **Verrou conservé.** Vérifier que `create_ride` n'est exécutable ni par `anon` ni par
   `authenticated` (012 appliquée, ou refus du script de recette). Ne pas la réactiver.
3. **Courses de recette.** Elles sont injectées **uniquement** par le dispositif
   administratif isolé (`supabase/staging/seed_test_ride.sql`, `psql`, rôle `postgres`),
   jamais par un client ni par `create_ride`.
4. **Vérifications de recette** (sessions réelles) : `authenticated` et `anon` refusés
   sur `create_ride` ; un passager ne lit que ses courses et leur historique ; aucune
   écriture directe sur `rides` ou `ride_status_history` ; dispatch et transitions 011
   exercés sur la course injectée.

Les tests Vitest et SQL vérifient le contrat côté dépôt sur une base jetable ; ils ne
remplacent pas la vérification RLS/JWT/Realtime sur le projet de recette.

Le dispatch est décrit dans [`backend-dispatch.md`](./backend-dispatch.md) ; ses
migrations suivent le même principe d'inventaire préalable.

## Hors périmètre

Ce lot et son verrouillage n'incluent pas : matching, géolocalisation active,
transitions de statut côté passager, paiement, commission, notifications, historique
métier, notation et sélection d'adresse fiable côté serveur. (Les transitions chauffeur
sont traitées par la migration 011, non appliquée, et le dispatch par 003+ : voir
`backend-dispatch.md` et `g0-integrite-parcours.md`.)
