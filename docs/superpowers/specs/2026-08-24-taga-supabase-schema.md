# TAGA — Schéma Supabase (data model, RLS, matching temps réel)

Date : 2026-08-24 (v2 — corrections suite revue technique)
Statut : approuvé (design), à implémenter via migrations SQL.

## Portée

Ce document décrit le modèle de données Supabase qui alimente l'app TAGA
construite dans FlutterFlow (voir `2026-08-24-taga-flutterflow-screens.md`
pour la spec écran par écran qui référence ces tables). Il couvre : schéma
complet (tables/colonnes/types), politiques RLS, l'architecture de matching
chauffeur/passager en temps réel, et la sécurisation des flux financiers.

**v2 — changements suite revue** : statuts de course simplifiés
(`accepted` supprimé, fusionné dans `driver_en_route`), ajout de
`ride_offers` (traçabilité du matching), ajout de `rides.payment_method_id`,
vue `active_driver_public` corrigée (filtre explicite + `security_invoker`),
RLS `payments` corrigée (plus de colonne inexistante), `driver_locations`
RLS étendue à `in_progress`, refonte complète du wallet/retrait
(`driver_wallets`, `payouts`, idempotence, verrou serveur), ajout
`saved_places`. Voir section **Changelog** en fin de document pour le détail
mappé à chaque point de la revue.

## Tables

### `profiles`
Étend `auth.users`. Créé **après** l'étape "Compléter le profil" (écran
3bis, spec écrans) — jamais directement à la vérification OTP, pour garantir
`full_name` renseigné.

```sql
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  phone text unique not null,
  avatar_url text,
  active_role text not null default 'passenger' check (active_role in ('passenger','driver')),
  has_driver_profile boolean not null default false,
  rating_avg numeric(2,1) not null default 5.0,
  rating_count integer not null default 0,
  created_at timestamptz not null default now()
);
```

### `driver_profiles`

```sql
create table driver_profiles (
  id uuid primary key references profiles(id) on delete cascade,
  verification_status text not null default 'pending'
    check (verification_status in ('pending','verified','rejected')),
  is_available boolean not null default false,
  default_payout_method_id uuid, -- FK ajoutée après création de payment_methods
  years_experience integer,
  created_at timestamptz not null default now()
);
```

### `vehicles`

```sql
create table vehicles (
  id uuid primary key default gen_random_uuid(),
  driver_id uuid not null references driver_profiles(id) on delete cascade,
  plate text not null,
  model text not null,
  color text,
  category text not null check (category in ('go','partage','family','confort')),
  created_at timestamptz not null default now()
);
```

### `driver_locations`
Position live du chauffeur, une ligne par chauffeur (upsert continu).

```sql
create extension if not exists postgis;

create table driver_locations (
  driver_id uuid primary key references driver_profiles(id) on delete cascade,
  position geography(point, 4326) not null,
  updated_at timestamptz not null default now()
);
create index driver_locations_position_idx on driver_locations using gist(position);
```

### `saved_places`
Destinations favorites du passager (écran Accueil).

```sql
create table saved_places (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references profiles(id) on delete cascade,
  label text not null,        -- "Maison", "Bureau"...
  address text not null,
  position geography(point,4326) not null,
  created_at timestamptz not null default now()
);
```

### `rides`
Une ligne par course, de la demande à la fin (ou annulation).

**Statuts simplifiés (v2)** : `accepted` supprimé — l'acceptation d'une
offre par un chauffeur fait passer la course directement à
`driver_en_route` (voir section Matching). `offered` supprimé du niveau
`rides` : la notion d'offre par chauffeur vit maintenant dans
`ride_offers`, `rides.status` reste `searching` tant qu'aucun chauffeur n'a
été assigné.

```sql
create table rides (
  id uuid primary key default gen_random_uuid(),
  passenger_id uuid not null references profiles(id),
  driver_id uuid references driver_profiles(id),
  payment_method_id uuid references payment_methods(id), -- FK ajoutée après création de payment_methods
  category text not null check (category in ('go','partage','family','confort')),
  status text not null default 'searching'
    check (status in ('searching','driver_en_route',
                       'arrived','in_progress','completed','cancelled','expired')),
  pickup_address text not null,
  pickup_position geography(point,4326) not null,
  dropoff_address text not null,
  dropoff_position geography(point,4326) not null,
  distance_km numeric(6,2),
  duration_min integer,
  base_fare integer,
  distance_fee integer,
  service_fee integer,
  total_fare integer,
  requested_at timestamptz not null default now(),
  accepted_at timestamptz,
  started_at timestamptz,
  completed_at timestamptz,
  cancelled_at timestamptz
);
create index rides_status_idx on rides(status);
create index rides_passenger_idx on rides(passenger_id);
create index rides_driver_idx on rides(driver_id);
```

### `ride_offers` *(nouveau — v2)*
Trace chaque sollicitation individuelle envoyée à un chauffeur pendant le
matching : qui a été sollicité, quand, avec quelle expiration, et sa
réponse. Nécessaire pour un matching réel (relance si refus/expiration,
audit, anti-double-acceptation).

```sql
create table ride_offers (
  id uuid primary key default gen_random_uuid(),
  ride_id uuid not null references rides(id) on delete cascade,
  driver_id uuid not null references driver_profiles(id) on delete cascade,
  status text not null default 'sent'
    check (status in ('sent','accepted','refused','expired')),
  sent_at timestamptz not null default now(),
  responded_at timestamptz,
  expires_at timestamptz not null default (now() + interval '9 seconds'),
  unique (ride_id, driver_id)
);
create index ride_offers_ride_idx on ride_offers(ride_id);
create index ride_offers_driver_idx on ride_offers(driver_id) where status = 'sent';
```

### `payment_methods`
Moyens de paiement (côté passager) / de retrait (côté chauffeur) — même
table, usage distingué par le contexte d'affichage (voir spec écrans).

```sql
create table payment_methods (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references profiles(id) on delete cascade,
  provider text not null check (provider in ('orange_money','wave')),
  masked_number text not null,
  is_default boolean not null default false,
  created_at timestamptz not null default now()
);

alter table driver_profiles
  add constraint driver_profiles_default_payout_fk
  foreign key (default_payout_method_id) references payment_methods(id);

alter table rides
  add constraint rides_payment_method_fk
  foreign key (payment_method_id) references payment_methods(id);
```

### `payments`
Une ligne par tentative de paiement d'une course. **Pas de `profile_id`** —
l'accès se contrôle via `ride_id` (voir RLS). Écrite uniquement par
Edge Function (`service_role`), jamais directement par le client.

```sql
create table payments (
  id uuid primary key default gen_random_uuid(),
  ride_id uuid not null references rides(id) on delete cascade,
  payment_method_id uuid references payment_methods(id),
  amount integer not null,
  status text not null default 'pending' check (status in ('pending','paid','failed')),
  provider_reference text,
  paid_at timestamptz
);
```

### `driver_wallets` *(nouveau — v2)*
Solde courant du chauffeur, **source de vérité unique**, maintenu
exclusivement côté serveur (jamais recalculé/décidé côté client
FlutterFlow). Remplace le calcul "somme des `wallet_transactions`" décrit
en v1, jugé pas assez fiable pour de l'argent réel.

```sql
create table driver_wallets (
  driver_id uuid primary key references driver_profiles(id) on delete cascade,
  balance integer not null default 0 check (balance >= 0),
  updated_at timestamptz not null default now()
);
```

### `wallet_transactions`
Ledger d'audit (append-only) des mouvements. Écrit uniquement par
Edge Function/trigger (`service_role`).

```sql
create table wallet_transactions (
  id uuid primary key default gen_random_uuid(),
  driver_id uuid not null references driver_profiles(id) on delete cascade,
  ride_id uuid references rides(id),
  payout_id uuid, -- FK ajoutée après création de payouts
  type text not null check (type in ('ride_earning','bonus','payout','payout_refund')),
  amount integer not null, -- positif pour ride_earning/bonus/payout_refund, négatif pour payout
  created_at timestamptz not null default now()
);
create index wallet_transactions_driver_idx on wallet_transactions(driver_id);
```

### `payouts` *(nouveau — v2)*
Une ligne par demande de retrait, avec idempotence et statut explicite —
remplace le simple "transaction négative" de la v1, insuffisant pour de
l'argent réel (pas de protection contre les doubles clics/retries réseau,
pas de suivi de l'état réel côté fournisseur mobile money).

```sql
create table payouts (
  id uuid primary key default gen_random_uuid(),
  driver_id uuid not null references driver_profiles(id) on delete cascade,
  amount integer not null check (amount > 0),
  status text not null default 'pending'
    check (status in ('pending','processing','paid','failed')),
  provider text not null check (provider in ('orange_money','wave')),
  provider_reference text,
  idempotency_key uuid not null unique default gen_random_uuid(),
  requested_at timestamptz not null default now(),
  completed_at timestamptz
);

alter table wallet_transactions
  add constraint wallet_transactions_payout_fk
  foreign key (payout_id) references payouts(id);
```

### `ratings`

```sql
create table ratings (
  id uuid primary key default gen_random_uuid(),
  ride_id uuid not null references rides(id) on delete cascade,
  rater_id uuid not null references profiles(id),
  rated_id uuid not null references profiles(id),
  stars integer not null check (stars between 1 and 5),
  tags text[],
  comment text,
  created_at timestamptz not null default now(),
  unique (ride_id, rater_id)
);
```

## Vue publique restreinte — infos chauffeur pendant une course

**Corrigée (v2)** : filtre explicite sur le passager courant **et**
`security_invoker` pour que la vue s'exécute avec les droits (et donc les
RLS) de l'utilisateur appelant, pas du créateur de la vue. Les deux
mécanismes se cumulent en défense en profondeur.

```sql
create view active_driver_public
with (security_invoker = true) as
select
  r.id as ride_id,
  p.id as driver_profile_id,
  p.full_name,
  p.avatar_url,
  p.rating_avg,
  p.rating_count,
  v.plate,
  v.model,
  v.color
from rides r
join driver_profiles dp on dp.id = r.driver_id
join profiles p on p.id = dp.id
join vehicles v on v.driver_id = dp.id
where r.status in ('driver_en_route','arrived','in_progress')
  and r.passenger_id = auth.uid();

grant select on active_driver_public to authenticated;
```

## RLS — politiques

RLS activé sur toutes les tables (`alter table ... enable row level security;`).
Sauf mention contraire, aucune politique `insert`/`update`/`delete` n'existe
pour le rôle `authenticated` sur les tables financières — ces écritures
passent exclusivement par des Edge Functions en `service_role`, qui
contournent RLS par conception (donc la logique métier, pas RLS, y garantit
la sécurité — voir section Paiements & retraits).

- **`profiles`**
  - `select`/`update` : `id = auth.uid()`.
  - Pas de lecture croisée directe — les infos chauffeur passent par
    `active_driver_public`.
- **`driver_profiles`**
  - `select`/`update`/`insert` : `id = auth.uid()`.
- **`vehicles`**
  - `select`/`insert`/`update`/`delete` : `driver_id = auth.uid()`.
- **`saved_places`**
  - `select`/`insert`/`update`/`delete` : `profile_id = auth.uid()`.
- **`driver_locations`**
  - `insert`/`update` : `driver_id = auth.uid()` (le chauffeur écrit sa
    propre position).
  - `select` : autorisé si l'utilisateur courant est le passager d'une
    course active dont `driver_id` correspond, **statuts
    `driver_en_route`, `arrived`, `in_progress`** (corrigé v2 — `in_progress`
    manquait, ce qui coupait le suivi pendant la course elle-même) :
    ```sql
    create policy driver_locations_select on driver_locations for select using (
      exists (
        select 1 from rides r
        where r.driver_id = driver_locations.driver_id
          and r.passenger_id = auth.uid()
          and r.status in ('driver_en_route','arrived','in_progress')
      )
      or driver_id = auth.uid()
    );
    ```
- **`rides`**
  - `select` :
    - passager : `passenger_id = auth.uid()`.
    - chauffeur : `driver_id = auth.uid()` (course déjà assignée) — la
      visibilité des courses `searching` disponibles ne passe **pas** par
      une lecture directe de `rides` mais par `ride_offers` (voir
      politique suivante), pour ne jamais exposer toutes les courses en
      recherche à tous les chauffeurs.
  - `insert` : passager authentifié, `passenger_id = auth.uid()`.
  - `update` :
    - passager : uniquement `status` vers `cancelled`, et uniquement si
      `status = 'searching'`.
    - chauffeur : transition de statut sur une course où
      `driver_id = auth.uid()` (`arrived`, `in_progress`).
    - L'assignation `driver_id` + passage à `driver_en_route` se fait
      **exclusivement** via l'Edge Function `accept-ride`
      (`service_role`), jamais par une policy `update` ouverte au client,
      pour garantir l'atomicité anti double-acceptation.
- **`ride_offers`**
  - `select` : `driver_id = auth.uid()`.
  - `update` : `driver_id = auth.uid()`, transition autorisée uniquement
    `sent → refused` (le passage à `accepted` passe par `accept-ride` en
    `service_role`, cf. Matching).
  - `insert` : aucune policy client — créées uniquement par l'Edge Function
    de matching.
- **`payment_methods`**
  - `select`/`insert`/`update`/`delete` : `profile_id = auth.uid()`.
- **`payments`** *(corrigé v2 — la v1 référençait une colonne
  `profile_id` inexistante sur cette table)*
  - `select` : accès via la course liée, pas de colonne directe :
    ```sql
    create policy payments_select on payments for select using (
      exists (
        select 1 from rides r
        where r.id = payments.ride_id
          and (r.passenger_id = auth.uid() or r.driver_id = auth.uid())
      )
    );
    ```
  - `insert`/`update` : aucune policy client — écrit uniquement par
    Edge Function (`service_role`) lors de la confirmation du paiement.
- **`driver_wallets`**
  - `select` : `driver_id = auth.uid()`.
  - `insert`/`update` : aucune policy client — géré uniquement par
    Edge Function (`service_role`), verrouillage transactionnel (cf.
    Paiements & retraits).
- **`wallet_transactions`**
  - `select` : `driver_id = auth.uid()`.
  - `insert`/`update` : aucune policy client.
- **`payouts`**
  - `select` : `driver_id = auth.uid()`.
  - `insert` : le client peut **initier** une demande (statut forcé à
    `pending`, montant validé côté serveur dans l'Edge Function qui
    traite ensuite la demande) ; alternative plus sûre retenue : même
    l'`insert` initial passe par l'Edge Function `payout` en
    `service_role`, le client ne fait qu'appeler la fonction, aucune
    policy `insert` client sur cette table.
  - `update` : aucune policy client — mis à jour uniquement par
    l'Edge Function/webhook fournisseur.
- **`ratings`**
  - `insert` : `rater_id = auth.uid()`, uniquement si la course est
    `completed` et que l'utilisateur en est passager ou chauffeur.
  - `select` : les deux participants de la course concernée.

## Matching chauffeur/passager (temps réel)

**Refonte v2** — le matching v1 ne traçait rien par chauffeur individuel
(pas de table dédiée), rendant impossible la relance après refus/expiration
et l'anti-double-acceptation robuste. Le flux ci-dessous s'appuie sur
`ride_offers`.

1. **Demande** : le passager crée une ligne `rides` (`status = 'searching'`,
   `driver_id = null`).
2. **Recherche** : l'Edge Function `match-ride` (déclenchée sur `insert` de
   `rides`, puis re-déclenchée périodiquement par `pg_cron` tant que
   `status = 'searching'`) interroge `driver_locations` via
   `ST_DWithin(position, pickup_position, rayon_metres)`, filtré sur
   `driver_profiles.is_available = true`, `vehicles.category =
   rides.category`, et **exclut les chauffeurs ayant déjà une
   `ride_offers` `sent`/`refused`/`expired` pour cette course** (pas de
   double-sollicitation).
3. **Création des offres** : pour chaque chauffeur trouvé, `insert` dans
   `ride_offers` (`status = 'sent'`, `expires_at = now() + interval '9
   seconds'`).
4. **Notification** : chaque insertion déclenche un événement **Supabase
   Realtime** sur le canal privé `driver:{driver_id}` (voir section
   Realtime — autorisation), reçu côté FlutterFlow (écran Demande
   entrante, compte à rebours local synchronisé sur `expires_at`).
5. **Acceptation atomique** — Edge Function `accept-ride`
   (`service_role`), transaction unique :
   ```sql
   begin;

   update ride_offers
   set status = 'accepted', responded_at = now()
   where ride_id = :ride_id and driver_id = :driver_id
     and status = 'sent' and expires_at > now();
   -- si 0 ligne : offre expirée ou déjà traitée -> rollback, erreur au client

   update rides
   set driver_id = :driver_id, status = 'driver_en_route', accepted_at = now()
   where id = :ride_id and status = 'searching' and driver_id is null;
   -- si 0 ligne : course déjà prise entre-temps -> rollback, erreur au client

   update ride_offers
   set status = 'expired'
   where ride_id = :ride_id and driver_id != :driver_id and status = 'sent';

   commit;
   ```
   C'est ce qui déclenche réellement `driver_en_route` (corrige le point
   v1 où ce statut n'était jamais atteint).
6. **Refus explicite** : update direct autorisé par RLS,
   `ride_offers.status: sent → refused` (pas besoin d'Edge Function, pas
   de risque de concurrence sur cette transition).
7. **Expiration** : job planifié (`pg_cron`, toutes les 5s) :
   - passe en `expired` les `ride_offers` `sent` dont `expires_at` est
     dépassé ;
   - si une course reste `searching` sans offre active au-delà d'un délai
     global configurable (ex. 2 minutes), passe `rides.status = 'expired'`.

## Realtime — autorisation des canaux *(précisé v2)*

Le canal `driver:{driver_id}` est un canal **privé** (Supabase Realtime
Authorization). Une policy d'autorisation restreint l'écoute au chauffeur
concerné uniquement :

```sql
create policy "driver listens to own channel"
on realtime.messages for select
using (
  realtime.topic() = 'driver:' || auth.uid()::text
);
```

*Note d'implémentation* : l'API exacte de Realtime Authorization (nom de
la fonction `realtime.topic()`, activation des canaux privés) doit être
vérifiée contre la documentation Supabase au moment de l'implémentation —
la fonctionnalité évolue. Cette section fixe l'intention (un chauffeur ne
peut écouter que son propre canal), pas la syntaxe finale figée.

## Estimation de prix (`estimate-fare`) *(précisé v2)*

Edge Function appelée depuis l'écran Estimation, **calcul serveur
obligatoire** (jamais côté client, pour éviter la manipulation du prix
affiché) :
- Entrée : `pickup_position`, `dropoff_position`, `category`.
- Calcule `distance_km`/`duration_min` via un service de routage externe
  (fournisseur non tranché à ce stade — ex. Mapbox Directions ou OSRM
  auto-hébergé — **décision ouverte**, à trancher avant implémentation de
  cette fonction).
- Applique la grille tarifaire par catégorie (barème non détaillé ici —
  **décision produit ouverte**, hors scope de ce document technique).
- Retourne un objet d'estimation **non persisté** tant que la course n'est
  pas commandée ; au moment de l'`insert` dans `rides`, les mêmes valeurs
  sont recalculées et stockées (`distance_km`, `duration_min`,
  `base_fare`, `distance_fee`, `service_fee`, `total_fare`) pour figer le
  prix de la course.

## Paiements & retraits — sécurisation *(refonte v2)*

Le solde chauffeur et les retraits ne doivent jamais dépendre d'un calcul
ou d'une décision côté client FlutterFlow.

**Crédit (fin de course)** — trigger ou Edge Function `service_role`,
déclenché quand `rides.status` passe à `completed` :
```sql
begin;
insert into wallet_transactions (driver_id, ride_id, type, amount)
values (:driver_id, :ride_id, 'ride_earning', :net_amount);

update driver_wallets
set balance = balance + :net_amount, updated_at = now()
where driver_id = :driver_id;
commit;
```

**Retrait (`payout`, Edge Function `service_role`)** :
1. Le client génère un `idempotency_key` (UUID) côté FlutterFlow avant
   l'appel, réutilisé tel quel en cas de retry réseau (double-tap, perte
   de connexion) — la contrainte `unique` sur `payouts.idempotency_key`
   rejette toute deuxième insertion avec la même clé.
2. Transaction serveur avec verrou explicite sur la ligne de solde,
   empêchant deux retraits concurrents de passer en même temps :
   ```sql
   begin;
   select balance from driver_wallets where driver_id = :driver_id for update;
   -- vérifier balance >= :amount, sinon rollback + erreur

   insert into payouts (driver_id, amount, provider, idempotency_key, status)
   values (:driver_id, :amount, :provider, :idempotency_key, 'pending');

   update driver_wallets
   set balance = balance - :amount, updated_at = now()
   where driver_id = :driver_id;

   insert into wallet_transactions (driver_id, payout_id, type, amount)
   values (:driver_id, :payout_id, 'payout', -:amount);
   commit;
   ```
3. Après commit, appel asynchrone à l'API du fournisseur mobile money.
   Callback/webhook fournisseur :
   - succès → `payouts.status = 'paid'`, `provider_reference` renseignée.
   - échec → `payouts.status = 'failed'` **et** remboursement (nouvelle
     transaction : `+amount` sur `driver_wallets.balance`, ligne
     `wallet_transactions` `type = 'payout_refund'`).
4. Le client FlutterFlow lit uniquement `driver_wallets.balance` (jamais
   de recalcul local) et l'historique via `wallet_transactions`/`payouts`.

## Hors scope de ce document (nécessite un spec dédié avant implémentation)

- Choix du fournisseur de routage pour `estimate-fare` (Mapbox/OSRM/autre)
  et barème tarifaire détaillé.
- Intégration technique réelle des API mobile money (Orange Money, Wave) —
  ce document définit le contrat interne (`payouts`, idempotence,
  transaction), pas l'appel HTTP au fournisseur ni la gestion de ses
  webhooks spécifiques.
- Chat in-app passager/chauffeur.
- Partage de trajet (génération de lien, page de suivi publique).
- Notifications push (FCM) au-delà du canal Realtime in-app.
- Suivi de position en arrière-plan (app fermée/minimisée) : le rafraîchissement
  toutes les 5s décrit dans la spec écrans suppose l'app au premier plan.
  Le suivi en arrière-plan réel nécessite une capacité de géolocalisation
  native (service Android/iOS dédié) dont la disponibilité dans FlutterFlow
  **doit être vérifiée** — susceptible de dépendre d'un plan payant ou
  d'un plugin/code natif personnalisé. Risque ouvert, à trancher avant de
  considérer le matching temps réel comme fiable en production.
- Système de bonus/gamification chauffeur (mentionné sur les maquettes,
  logique de calcul non spécifiée ici).

## Changelog (v1 → v2, suite revue technique du 2026-08-24)

| # | Point soulevé | Correction appliquée |
|---|---|---|
| 1 | `active_driver_public` sans filtre passager | Filtre `r.passenger_id = auth.uid()` + `security_invoker = true` + `grant` explicite |
| 2 | RLS `payments` référence `profile_id` inexistant | Policy réécrite via `exists (... rides ...)`, écriture réservée à `service_role` |
| 3 | Moyen de paiement choisi non stocké sur la course | Ajout `rides.payment_method_id` |
| 4 | Pas de modèle d'offre pour le matching | Ajout table `ride_offers` (sollicitations, expiration, refus) |
| 5 | `driver_en_route` jamais déclenché | Statuts simplifiés (`accepted` supprimé), `accept-ride` positionne directement `driver_en_route` |
| 6 | RLS `driver_locations` n'incluait pas `in_progress` | Ajouté à la liste de statuts autorisés |
| 7 | Wallet non sécurisé (pas d'idempotence/statut/verrou) | Ajout `driver_wallets` (solde serveur), `payouts` (idempotence, statut, référence fournisseur), transaction avec `for update` |
| — | `full_name not null` sans étape de saisie fiable | Création du profil déplacée après un écran "Compléter le profil" dédié (voir spec écrans) |
| — | Destinations favorites sans table | Ajout `saved_places` |
| — | `estimate-fare`/`payout`/Realtime insuffisamment spécifiés | Sections dédiées ajoutées ; fournisseur de routage et intégration mobile money restent des décisions ouvertes explicites |
| — | Autorisation du canal Realtime absente | Section "Realtime — autorisation des canaux" ajoutée |
| — | Position en arrière-plan non couverte | Listé explicitement en risque ouvert (Hors scope) |
