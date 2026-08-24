# TAGA — Schéma Supabase (data model, RLS, matching temps réel)

Date : 2026-08-24 (v3 — corrections suite 2e revue technique)
Statut : approuvé (design), à implémenter via migrations SQL.

## Portée

Ce document décrit le modèle de données Supabase qui alimente l'app TAGA
construite dans FlutterFlow (voir `2026-08-24-taga-flutterflow-screens.md`
pour la spec écran par écran qui référence ces tables). Il couvre : schéma
complet (tables/colonnes/types), ordre de migration, politiques RLS et
grants par colonne, l'architecture de matching chauffeur/passager en temps
réel, et la sécurisation des flux financiers.

**v3 — changements suite 2e revue** : suppression de la FK inline
`rides.payment_method_id` (ordre de migration invalide) ; remplacement de
la vue `active_driver_public` par une fonction `security definer`
(`get_active_driver_info`) car `security_invoker` bloquait la lecture
sous RLS ; ajout d'une policy + vue `driver_incoming_offers` pour que le
chauffeur puisse lire une course avant acceptation ; création de profil
déplacée dans une Edge Function `complete-profile` (les policies `insert`
client sur `profiles`/`driver_profiles`/`driver_wallets` sont supprimées) ;
création de course déplacée dans une Edge Function `request-ride` (prix
recalculé serveur, plus d'`insert` client direct sur `rides`) ; grants par
colonne sur `profiles`/`driver_profiles` pour empêcher la modification de
champs sensibles (`rating_avg`, `verification_status`...) ; index unique
partiel pour un seul moyen de paiement par défaut ; trigger de propriété
sur `default_payout_method_id` ; crédit du wallet rendu idempotent
(index unique partiel sur `ride_id`) et déplacé dans une Edge Function
`complete-ride` ; mécanisme de réconciliation des `payouts` bloqués ;
section **Ordre de migration** ajoutée. Voir **Changelog** en fin de
document.

## Ordre de migration

Les blocs SQL de ce document doivent être appliqués dans cet ordre (chaque
étape dépend de la précédente) :

1. Extension `postgis`.
2. `profiles`
3. `driver_profiles` (sans FK vers `payment_methods` — ajoutée en 10)
4. `vehicles`
5. `driver_locations`
6. `saved_places`
7. `rides` (`payment_method_id uuid` **sans** référence inline — ajoutée en 10)
8. `ride_offers`
9. `payment_methods`
10. `alter table` : FK `driver_profiles.default_payout_method_id`,
    FK `rides.payment_method_id`, trigger de propriété du moyen de retrait
11. `payments`
12. `driver_wallets`
13. `wallet_transactions`
14. `payouts` + FK `wallet_transactions.payout_id`
15. `ratings` + trigger de mise à jour de `profiles.rating_avg`
16. Index uniques partiels (`payment_methods` défaut unique,
    `wallet_transactions` crédit idempotent)
17. RLS (`enable row level security` + policies, toutes tables)
18. Grants par colonne (`profiles`, `driver_profiles`)
19. Fonction `security definer` `get_active_driver_info`
20. Policy Realtime (canal privé chauffeur)

## Tables

### `profiles`
Étend `auth.users`. Créé exclusivement via l'Edge Function
`complete-profile` (v3 — plus d'`insert` client direct, voir RLS).

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
  default_payout_method_id uuid, -- FK ajoutée à l'étape 10
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
Une ligne par course, de la demande à la fin (ou annulation). Créée
exclusivement via l'Edge Function `request-ride` (v3 — voir RLS et section
"Estimation & création de course").

**Correction v3 (bloquant #1)** : `payment_method_id` n'a **plus de
référence inline** — `payment_methods` est créée après `rides` dans
l'ordre de migration. La contrainte `foreign key` est ajoutée par un
`alter table` séparé à l'étape 10, une fois `payment_methods` existante
(même pattern déjà utilisé pour `driver_profiles.default_payout_method_id`).

```sql
create table rides (
  id uuid primary key default gen_random_uuid(),
  passenger_id uuid not null references profiles(id),
  driver_id uuid references driver_profiles(id),
  payment_method_id uuid, -- FK ajoutée à l'étape 10, après création de payment_methods
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

### `ride_offers`
Trace chaque sollicitation individuelle envoyée à un chauffeur pendant le
matching : qui a été sollicité, quand, avec quelle expiration, et sa
réponse.

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
```

### Étape 10 — contraintes différées et trigger de propriété

**Correction v3 (bloquant #6, risque "default_payout_method_id peut
pointer vers un autre profil")** : un trigger vérifie que le moyen de
retrait par défaut d'un chauffeur lui appartient bien.

```sql
alter table driver_profiles
  add constraint driver_profiles_default_payout_fk
  foreign key (default_payout_method_id) references payment_methods(id);

alter table rides
  add constraint rides_payment_method_fk
  foreign key (payment_method_id) references payment_methods(id);

create or replace function check_default_payout_owner()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if new.default_payout_method_id is not null then
    if not exists (
      select 1 from payment_methods pm
      where pm.id = new.default_payout_method_id
        and pm.profile_id = new.id
    ) then
      raise exception 'default_payout_method_id must belong to the same profile';
    end if;
  end if;
  return new;
end;
$$;

create trigger driver_profiles_default_payout_owner_check
before insert or update of default_payout_method_id on driver_profiles
for each row execute function check_default_payout_owner();
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

### `driver_wallets`
Solde courant du chauffeur, **source de vérité unique**, maintenu
exclusivement côté serveur.

```sql
create table driver_wallets (
  driver_id uuid primary key references driver_profiles(id) on delete cascade,
  balance integer not null default 0 check (balance >= 0),
  updated_at timestamptz not null default now()
);
```

### `wallet_transactions`
Ledger d'audit (append-only) des mouvements. Écrit uniquement par
Edge Function (`service_role`).

```sql
create table wallet_transactions (
  id uuid primary key default gen_random_uuid(),
  driver_id uuid not null references driver_profiles(id) on delete cascade,
  ride_id uuid references rides(id),
  payout_id uuid, -- FK ajoutée après création de payouts (étape 14)
  type text not null check (type in ('ride_earning','bonus','payout','payout_refund')),
  amount integer not null, -- positif pour ride_earning/bonus/payout_refund, négatif pour payout
  created_at timestamptz not null default now()
);
create index wallet_transactions_driver_idx on wallet_transactions(driver_id);
```

### `payouts`
Une ligne par demande de retrait, avec idempotence et statut explicite.

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

**Correction v3** : trigger de mise à jour automatique de
`profiles.rating_avg`/`rating_count` — ces colonnes ne sont plus
modifiables par le client (voir grants par colonne), il fallait donc un
mécanisme serveur pour les tenir à jour.

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

create or replace function update_profile_rating()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  update profiles
  set rating_count = rating_count + 1,
      rating_avg = round(((rating_avg * rating_count) + new.stars) / (rating_count + 1), 1)
  where id = new.rated_id;
  return new;
end;
$$;

create trigger ratings_update_profile_rating
after insert on ratings
for each row execute function update_profile_rating();
```

## Index uniques partiels

**Correction v3 (risque "aucun index unique ne garantit un seul moyen de
paiement par défaut")** :

```sql
create unique index payment_methods_one_default_per_profile
on payment_methods (profile_id)
where is_default;
```

**Correction v3 (bloquant "crédit du wallet non idempotent")** : un seul
crédit `ride_earning` par course, garanti au niveau base — un deuxième
appel de `complete-ride` pour la même course ne peut pas créer une
deuxième ligne de crédit.

```sql
create unique index wallet_transactions_ride_earning_once
on wallet_transactions (ride_id)
where type = 'ride_earning';
```

## Infos chauffeur pendant une course — fonction sécurisée (v3)

**Correction v3 (bloquant #2)** : la vue `active_driver_public` v2 avec
`security_invoker = true` exécute la requête avec les droits du passager
appelant — donc avec **ses** RLS. Or les RLS de `profiles`,
`driver_profiles` et `vehicles` n'autorisent la lecture que de sa propre
ligne (`id = auth.uid()`). Un passager ne peut donc jamais lire les lignes
du chauffeur à travers cette vue, filtre ou pas : la vue était
inutilisable telle quelle.

Remplacée par une **fonction `security definer`**, qui s'exécute avec les
droits du créateur de la fonction (contournant volontairement les RLS des
tables sous-jacentes), mais dont le corps vérifie explicitement et
strictement que l'appelant est bien le passager de la course active avant
de renvoyer quoi que ce soit — c'est cette vérification interne, pas RLS,
qui sécurise l'accès ici.

```sql
create or replace function get_active_driver_info(p_ride_id uuid)
returns table (
  driver_profile_id uuid,
  full_name text,
  avatar_url text,
  rating_avg numeric,
  rating_count integer,
  plate text,
  model text,
  color text
)
language sql
security definer
set search_path = public
as $$
  select p.id, p.full_name, p.avatar_url, p.rating_avg, p.rating_count,
         v.plate, v.model, v.color
  from rides r
  join driver_profiles dp on dp.id = r.driver_id
  join profiles p on p.id = dp.id
  join vehicles v on v.driver_id = dp.id
  where r.id = p_ride_id
    and r.passenger_id = auth.uid()
    and r.status in ('driver_en_route','arrived','in_progress');
$$;

revoke all on function get_active_driver_info(uuid) from public;
grant execute on function get_active_driver_info(uuid) to authenticated;
```

Côté FlutterFlow, l'écran Course active appelle cette fonction (RPC) au
lieu de lire une vue/table directement.

## RLS — politiques

RLS activé sur toutes les tables (`alter table ... enable row level security;`).

- **`profiles`**
  - `select` : `id = auth.uid()`.
  - `update` : `id = auth.uid()`, **restreint par colonne** (voir Grants
    ci-dessous) — impossible de modifier `rating_avg`, `rating_count`,
    `has_driver_profile` depuis le client.
  - `insert` : **aucune policy client** (correction v3, bloquant #4) —
    créé exclusivement par l'Edge Function `complete-profile`
    (`service_role`).
  - Pas de lecture croisée directe — les infos chauffeur passent par
    `get_active_driver_info`.
- **`driver_profiles`**
  - `select` : `id = auth.uid()`.
  - `update` : `id = auth.uid()`, **restreint par colonne** — impossible
    de modifier `verification_status` depuis le client.
  - `insert` : **aucune policy client** (correction v3) — créé
    exclusivement par `complete-profile` (première inscription chauffeur)
    ou une future Edge Function `become-driver` (passager existant qui
    active le mode chauffeur).
- **`vehicles`**
  - `select`/`insert`/`update`/`delete` : `driver_id = auth.uid()`.
- **`saved_places`**
  - `select`/`insert`/`update`/`delete` : `profile_id = auth.uid()`.
- **`driver_locations`**
  - `insert`/`update` : `driver_id = auth.uid()`.
  - `select` :
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
  - `select` — **deux policies combinées (OR)**, corrigeant le bloquant
    #3 : le chauffeur doit pouvoir lire une course dès qu'une offre lui a
    été envoyée, pas seulement une fois assigné.
    ```sql
    create policy rides_select_own on rides for select using (
      passenger_id = auth.uid() or driver_id = auth.uid()
    );

    create policy rides_select_via_offer on rides for select using (
      exists (
        select 1 from ride_offers o
        where o.ride_id = rides.id
          and o.driver_id = auth.uid()
          and o.status = 'sent'
          and o.expires_at > now()
      )
    );
    ```
  - `insert` : **aucune policy client** (correction v3, bloquant #5) —
    créée exclusivement par l'Edge Function `request-ride`
    (`service_role`), qui recalcule le prix côté serveur (voir section
    "Estimation & création de course").
  - `update` :
    - passager, annulation uniquement :
      ```sql
      create policy rides_update_passenger_cancel on rides for update
      using (passenger_id = auth.uid() and status = 'searching')
      with check (status = 'cancelled');
      ```
    - chauffeur, transitions non financières uniquement (`driver_en_route`
      → `arrived` → `in_progress`) :
      ```sql
      create policy rides_update_driver_progress on rides for update
      using (driver_id = auth.uid())
      with check (status in ('arrived','in_progress'));
      ```
    - L'assignation initiale (`driver_id` + passage à `driver_en_route`)
      et le passage à `completed` (impact financier) se font
      **exclusivement** via Edge Functions `accept-ride` et
      `complete-ride` (`service_role`), jamais par une policy `update`
      ouverte au client.
- **`ride_offers`**
  - `select` : `driver_id = auth.uid()`.
  - `update` : `driver_id = auth.uid()`, transition autorisée uniquement
    `sent → refused` :
    ```sql
    create policy ride_offers_refuse on ride_offers for update
    using (driver_id = auth.uid() and status = 'sent')
    with check (status = 'refused');
    ```
  - `insert` : aucune policy client — créées uniquement par l'Edge
    Function de matching.
- **`payment_methods`**
  - `select`/`insert`/`update`/`delete` : `profile_id = auth.uid()`.
- **`payments`**
  - `select` :
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
    Edge Function (`service_role`).
- **`driver_wallets`**
  - `select` : `driver_id = auth.uid()`.
  - `insert`/`update` : aucune policy client.
- **`wallet_transactions`**
  - `select` : `driver_id = auth.uid()`.
  - `insert`/`update` : aucune policy client.
- **`payouts`**
  - `select` : `driver_id = auth.uid()`.
  - `insert`/`update` : aucune policy client — le client appelle l'Edge
    Function `payout`, qui écrit avec `service_role`.
- **`ratings`**
  - `insert` : `rater_id = auth.uid()`, uniquement si la course est
    `completed` et que l'utilisateur en est passager ou chauffeur.
  - `select` : les deux participants de la course concernée.

## Grants par colonne — champs sensibles (v3, bloquant #6)

RLS contrôle *quelles lignes* sont visibles/modifiables, pas *quelles
colonnes*. Pour empêcher un utilisateur de modifier ses propres
`rating_avg`, `rating_count`, `has_driver_profile` (`profiles`) ou son
`verification_status` (`driver_profiles`) via un `update` par ailleurs
autorisé par RLS sur sa propre ligne, on restreint les `grant` au niveau
colonne pour le rôle `authenticated` :

```sql
revoke update on profiles from authenticated;
grant update (full_name, avatar_url, active_role) on profiles to authenticated;

revoke update on driver_profiles from authenticated;
grant update (is_available, years_experience, default_payout_method_id)
  on driver_profiles to authenticated;
```

`rating_avg`/`rating_count` ne sont modifiées que par le trigger
`ratings_update_profile_rating` (`security definer`, contourne le grant
par conception). `has_driver_profile` et `verification_status` ne sont
modifiées que par les Edge Functions `complete-profile`/`become-driver`
et par le processus de vérification chauffeur (hors scope de ce document).

## Matching chauffeur/passager (temps réel)

1. **Demande** : le passager appelle l'Edge Function `request-ride`
   (v3 — plus d'`insert` client direct, voir section suivante), qui crée
   la ligne `rides` (`status = 'searching'`, `driver_id = null`).
2. **Recherche** : l'Edge Function `match-ride` (déclenchée après la
   création de la course, puis re-déclenchée périodiquement par
   `pg_cron` tant que `status = 'searching'`) interroge
   `driver_locations` via `ST_DWithin(position, pickup_position,
   rayon_metres)`, filtré sur `driver_profiles.is_available = true`,
   `vehicles.category = rides.category`, et exclut les chauffeurs ayant
   déjà une `ride_offers` `sent`/`refused`/`expired` pour cette course.
3. **Création des offres** : pour chaque chauffeur trouvé, `insert` dans
   `ride_offers` (`status = 'sent'`, `expires_at = now() + interval '9
   seconds'`).
4. **Notification** : chaque insertion déclenche un événement Supabase
   Realtime sur le canal privé `driver:{driver_id}` (voir section
   Realtime), reçu côté FlutterFlow. L'écran Demande entrante charge
   ensuite le détail de la course via la policy `rides_select_via_offer`
   (corrige le bloquant #3 — le chauffeur peut désormais lire pickup,
   destination, distance, montant avant d'accepter).
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
6. **Refus explicite** : update direct autorisé par RLS,
   `ride_offers.status: sent → refused`.
7. **Expiration** : job planifié (`pg_cron`, toutes les 5s) :
   - passe en `expired` les `ride_offers` `sent` dont `expires_at` est
     dépassé ;
   - si une course reste `searching` sans offre active au-delà d'un délai
     global configurable (ex. 2 minutes), passe `rides.status = 'expired'`.

## Realtime — autorisation des canaux

Le canal `driver:{driver_id}` est un canal **privé** (Supabase Realtime
Authorization) :

```sql
create policy "driver listens to own channel"
on realtime.messages for select
using (
  realtime.topic() = 'driver:' || auth.uid()::text
);
```

*Note d'implémentation* : l'API exacte de Realtime Authorization (nom de
la fonction `realtime.topic()`, activation des canaux privés) reste à
vérifier contre la documentation Supabase au moment de l'implémentation —
point déjà signalé en v2, toujours non tranché, non bloquant pour la
suite du design mais **à valider avant d'écrire le code du matching**.

## Estimation & création de course (v3 — bloquant #5)

**Problème corrigé** : en v2, l'écran Estimation appelait `estimate-fare`
pour *afficher* un prix, mais c'est le client qui envoyait ensuite ce prix
dans l'`insert` de `rides` — un client modifié pouvait donc soumettre un
`total_fare` arbitraire.

**Correction** : suppression de toute policy `insert` client sur `rides`.
Une seule Edge Function crée la course :

**`request-ride`** (`service_role`), entrée : `pickup_position`,
`pickup_address`, `dropoff_position`, `dropoff_address`, `category`,
`payment_method_id`.
1. Vérifie que `payment_method_id` appartient bien à l'appelant
   (`payment_methods.profile_id = auth.uid()`), sinon erreur.
2. Recalcule `distance_km`/`duration_min` et le prix (même logique que
   `estimate-fare`, idéalement factorisée dans un module partagé entre
   les deux fonctions) — **jamais** de valeurs reçues du client utilisées
   telles quelles pour le prix.
3. `insert` la ligne `rides` avec les valeurs recalculées côté serveur.
4. Retourne `ride_id` au client, qui navigue vers l'écran Course active.

`estimate-fare` (appelée juste avant, pour l'affichage du prix à l'écran
Estimation) et `request-ride` doivent donc partager le même calcul, pour
que le prix affiché avant commande corresponde exactement au prix figé à
la commande (à la variation de distance/durée temps réel près, si le
routage est recalculé entre-temps — comportement à trancher lors de
l'implémentation : figer le prix de l'estimation avec une courte validité,
ou toujours recalculer à la commande).

- Fournisseur de routage (Mapbox/OSRM/autre) : **décision ouverte**, hors
  scope de ce document.
- Barème tarifaire détaillé par catégorie : **décision produit ouverte**,
  hors scope de ce document.

## Paiements & retraits — sécurisation

Le solde chauffeur et les retraits ne doivent jamais dépendre d'un calcul
ou d'une décision côté client FlutterFlow.

**Crédit (fin de course)** — Edge Function `complete-ride`
(`service_role`), appelée par le chauffeur (remplace l'`update` client
direct de `rides.status = 'completed'`, désormais interdit par RLS) :
```sql
begin;

update rides
set status = 'completed', completed_at = now()
where id = :ride_id and driver_id = :driver_id and status = 'in_progress';
-- si 0 ligne : déjà complétée ou statut invalide -> traiter comme idempotent,
-- relire l'état courant et le renvoyer sans erreur bloquante au client

insert into wallet_transactions (driver_id, ride_id, type, amount)
values (:driver_id, :ride_id, 'ride_earning', :net_amount)
on conflict do nothing; -- protégé par l'index unique partiel (ride_id) where type='ride_earning'
-- vérifier le nombre de lignes affectées (ex. GET DIAGNOSTICS en PL/pgSQL) :

update driver_wallets
set balance = balance + :net_amount, updated_at = now()
where driver_id = :driver_id
  and :insert_affected_a_row; -- n'incrémente que si le crédit vient d'être réellement créé

commit;
```
Grâce à l'index unique partiel `wallet_transactions_ride_earning_once`, un
appel dupliqué de `complete-ride` pour la même course (retry réseau,
double-tap) ne peut jamais créditer deux fois — corrige le bloquant "crédit
non idempotent".

**Retrait (`payout`, Edge Function `service_role`)** :
1. Le client génère un `idempotency_key` (UUID) avant l'appel, réutilisé
   tel quel en cas de retry réseau — la contrainte `unique` sur
   `payouts.idempotency_key` rejette toute deuxième insertion avec la
   même clé.
2. Transaction serveur avec verrou explicite sur la ligne de solde :
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
4. **Réconciliation (v3)** : un job planifié (`pg_cron`, ex. toutes les
   2 minutes) interroge les `payouts` en `pending`/`processing` depuis
   plus de N minutes sans webhook reçu, appelle l'API de statut du
   fournisseur, et résout à `paid`/`failed` en conséquence — évite qu'un
   retrait reste bloqué indéfiniment si le webhook du fournisseur est
   perdu.
5. Le client FlutterFlow lit uniquement `driver_wallets.balance` (jamais
   de recalcul local) et l'historique via `wallet_transactions`/`payouts`.

## Hors scope de ce document (nécessite un spec dédié avant implémentation)

- Choix du fournisseur de routage pour `estimate-fare`/`request-ride`
  (Mapbox/OSRM/autre) et barème tarifaire détaillé.
- Intégration technique réelle des API mobile money (Orange Money, Wave) —
  ce document définit le contrat interne (`payouts`, idempotence,
  transaction, réconciliation), pas l'appel HTTP au fournisseur ni le
  détail de ses webhooks.
- Chat in-app passager/chauffeur.
- Partage de trajet (génération de lien, page de suivi publique).
- Notifications push (FCM) au-delà du canal Realtime in-app.
- Suivi de position en arrière-plan (app fermée/minimisée) — le
  rafraîchissement toutes les 5s décrit dans la spec écrans suppose l'app
  au premier plan. Capacité native à vérifier, possible dépendance à un
  plan payant ou un plugin/code natif. Risque ouvert.
- Système de bonus/gamification chauffeur (mentionné sur les maquettes,
  logique de calcul non spécifiée ici).
- Écriture des Edge Functions elles-mêmes (`match-ride`, `accept-ride`,
  `request-ride`, `estimate-fare`, `complete-ride`, `payout`,
  `complete-profile`) et des jobs `pg_cron` comme code déployable — ce
  document fixe leur contrat transactionnel, pas leur implémentation.

## Changelog (v2 → v3, suite 2e revue technique du 2026-08-24)

| # | Point soulevé | Correction appliquée |
|---|---|---|
| 1 | `rides` référence `payment_methods` avant sa création (migration invalide) | FK inline supprimée, ajoutée par `alter table` à l'étape 10 de l'ordre de migration |
| 2 | `security_invoker` sur `active_driver_public` bloque la lecture (RLS de `profiles`/`driver_profiles`/`vehicles` restreint à `auth.uid()`) | Vue remplacée par la fonction `security definer` `get_active_driver_info`, qui vérifie explicitement `passenger_id = auth.uid()` dans son corps |
| 3 | Le chauffeur ne peut pas lire `rides` avant acceptation (`driver_id` encore `null`) | Policy `rides_select_via_offer` ajoutée (lecture autorisée si une `ride_offers` `sent` non expirée existe pour ce chauffeur) |
| 4 | Création de profil (`insert` direct) incompatible avec l'absence de policy `insert` | Déplacée dans l'Edge Function `complete-profile` (`service_role`) ; policies `insert` client supprimées sur `profiles`/`driver_profiles`/`driver_wallets` |
| 5 | Prix falsifiable (client envoie `total_fare` dans l'`insert`) | `insert` client sur `rides` supprimé ; Edge Function `request-ride` recalcule et crée la course côté serveur |
| 6 | Champs sensibles modifiables (`rating_avg`, `verification_status`...) | Grants par colonne sur `profiles`/`driver_profiles` ; `rating_avg`/`rating_count` mis à jour par trigger uniquement |
| — | Pas de garantie d'un seul moyen de paiement par défaut | Index unique partiel `payment_methods_one_default_per_profile` |
| — | `default_payout_method_id` sans vérification de propriété | Trigger `check_default_payout_owner` |
| — | Crédit du wallet non idempotent (retry = double crédit) | Index unique partiel `wallet_transactions_ride_earning_once` ; crédit déplacé dans `complete-ride` (`service_role`) |
| — | Pas de reprise pour les `payouts` bloqués en `pending` | Job de réconciliation `pg_cron` ajouté à la section Paiements & retraits |
| — | Edge Functions/triggers/`pg_cron` non identifiés comme étapes de migration | Section "Ordre de migration" ajoutée |
