# TAGA — Schéma Supabase (data model, RLS, matching temps réel)

Date : 2026-08-24
Statut : approuvé (design), à implémenter via migrations SQL.

## Portée

Ce document décrit le modèle de données Supabase qui alimente l'app TAGA
construite dans FlutterFlow (voir `2026-08-24-taga-flutterflow-screens.md`
pour la spec écran par écran qui référence ces tables). Il couvre : schéma
complet (tables/colonnes/types), politiques RLS, et l'architecture de
matching chauffeur/passager en temps réel.

## Tables

### `profiles`
Étend `auth.users`. Un enregistrement par utilisateur, quel que soit son rôle.

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
Extension pour les utilisateurs ayant activé le mode chauffeur.

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

### `rides`
Une ligne par course, de la demande à la fin (ou annulation).

```sql
create table rides (
  id uuid primary key default gen_random_uuid(),
  passenger_id uuid not null references profiles(id),
  driver_id uuid references driver_profiles(id),
  category text not null check (category in ('go','partage','family','confort')),
  status text not null default 'searching'
    check (status in ('searching','offered','accepted','driver_en_route',
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

### `payment_methods`
Moyens de paiement (côté passager) / de retrait (côté chauffeur) — même table,
usage distingué par le contexte d'affichage (voir spec écrans).

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
```

### `payments`

```sql
create table payments (
  id uuid primary key default gen_random_uuid(),
  ride_id uuid not null references rides(id) on delete cascade,
  payment_method_id uuid references payment_methods(id),
  amount integer not null,
  status text not null default 'pending' check (status in ('pending','paid','failed')),
  paid_at timestamptz
);
```

### `wallet_transactions`
Ledger des gains et retraits chauffeur.

```sql
create table wallet_transactions (
  id uuid primary key default gen_random_uuid(),
  driver_id uuid not null references driver_profiles(id) on delete cascade,
  ride_id uuid references rides(id),
  type text not null check (type in ('ride_earning','bonus','payout')),
  amount integer not null,
  created_at timestamptz not null default now()
);
create index wallet_transactions_driver_idx on wallet_transactions(driver_id);
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

Un passager ne doit jamais lire directement `profiles`/`driver_profiles` d'un
chauffeur. Une vue expose uniquement les champs nécessaires, pour les courses
actives où il est le passager concerné.

```sql
create view active_driver_public as
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
where r.status in ('accepted','driver_en_route','arrived','in_progress');
```

## RLS — politiques

RLS activé sur toutes les tables (`alter table ... enable row level security;`).

- **`profiles`**
  - `select`/`update` : `id = auth.uid()`.
  - Pas de lecture croisée directe — les infos chauffeur passent par
    `active_driver_public`.
- **`driver_profiles`**
  - `select`/`update`/`insert` : `id = auth.uid()`.
- **`vehicles`**
  - `select`/`insert`/`update`/`delete` : `driver_id = auth.uid()`.
- **`driver_locations`**
  - `insert`/`update` : `driver_id = auth.uid()` (le chauffeur écrit sa
    propre position).
  - `select` : autorisé si l'utilisateur courant est le passager d'une
    course active (`status in ('accepted','driver_en_route','arrived')`)
    dont `driver_id` correspond, via une fonction `is_active_ride_driver(uuid)`.
- **`rides`**
  - `select` :
    - passager : `passenger_id = auth.uid()`.
    - chauffeur : `driver_id = auth.uid()` **ou** `status = 'searching'`
      et chauffeur disponible dans la zone (accès via fonction
      `nearby_searching_rides()`, pas de lecture libre de la table — voir
      section Matching).
  - `insert` : passager authentifié, `passenger_id = auth.uid()`.
  - `update` :
    - passager : uniquement `status` vers `cancelled`, et uniquement si
      `status in ('searching','offered')`.
    - chauffeur : transition de statut sur une course où
      `driver_id = auth.uid()`, ou claim atomique d'une course `searching`
      (voir Matching, étape 4) — implémenté en Edge Function avec la
      `service_role` key plutôt qu'en RLS pur, pour garantir l'atomicité.
- **`payment_methods`**, **`payments`**, **`wallet_transactions`** :
  `select`/`insert`/`update`/`delete` restreints à `profile_id = auth.uid()`
  (ou `driver_id = auth.uid()` pour `wallet_transactions`).
- **`ratings`** :
  - `insert` : `rater_id = auth.uid()`, uniquement si la course est
    `completed` et que l'utilisateur en est passager ou chauffeur.
  - `select` : les deux participants de la course concernée.

## Matching chauffeur/passager (temps réel)

1. **Demande** : le passager crée une ligne `rides` avec `status = 'searching'`.
2. **Recherche** : une **Edge Function** (`match-ride`) est déclenchée
   (webhook sur `insert` de `rides`) et interroge `driver_locations` via
   `ST_DWithin(position, pickup_position, rayon_metres)`, filtré sur
   `driver_profiles.is_available = true` et `vehicles.category = rides.category`.
3. **Notification** : les chauffeurs trouvés sont notifiés via **Supabase
   Realtime** (canal `driver:{driver_id}`), qui pousse l'événement
   "nouvelle demande" côté FlutterFlow (écran Demande entrante, compte à
   rebours 9s géré côté client).
4. **Acceptation atomique** : quand un chauffeur accepte, l'app appelle une
   Edge Function (`accept-ride`, `service_role`) qui exécute :
   ```sql
   update rides
   set driver_id = :driver_id, status = 'accepted', accepted_at = now()
   where id = :ride_id and status = 'searching' and driver_id is null;
   ```
   Si `0` ligne affectée → la course a déjà été prise, l'app affiche
   "Cette course n'est plus disponible" au chauffeur.
5. **Expiration** : un job planifié (`pg_cron`, toutes les 5s) repasse en
   `expired` les courses `searching` dont `requested_at` dépasse le délai
   configuré (fenêtre de recherche globale, distincte du compte à rebours
   d'affichage 9s par chauffeur individuel).

## Hors scope de ce document

- Notifications push (FCM) au-delà du canal Realtime — sujet du spec
  d'intégration FlutterFlow ↔ Supabase Realtime.
- Facturation/comptabilité détaillée au-delà de `wallet_transactions`.
- Système de bonus/gamification chauffeur (mentionné sur les maquettes,
  logique de calcul non spécifiée ici).
