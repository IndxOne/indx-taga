-- TAGA G0.4 : verrouillage de public.create_ride.
--
-- Migration additive, NON APPLIQUÉE : à valider sur un environnement isolé
-- (staging / branche Supabase) avant toute application distante. Elle ne
-- modifie ni 002 ni 011 : create_ride est redéfinie avec la même signature.
--
-- Deux protections indépendantes :
--
-- 1. Validation serveur des points (défense en profondeur). Chaque point doit
--    porter un libellé et deux coordonnées JSON NUMÉRIQUES, finies, dans les
--    bornes GPS, et le couple (0,0) est refusé. Cela garantit des données bien
--    formées ; cela ne prouve PAS qu'une adresse est authentique : un client
--    peut toujours envoyer des coordonnées plausibles mais fausses, et aucun
--    champ « source » fourni par le client n'est une preuve de provenance.
--
-- 2. Désactivation des commandes réelles : EXECUTE est révoqué à tout client
--    (public, anon, authenticated) tant qu'une sélection d'adresse fiable,
--    vérifiée côté serveur, n'existe pas. Réversible par une migration
--    ultérieure (voir docs/backend-rides.md, « Réactivation »), sous un gate
--    distinct. Aucun accès de contournement n'est ajouté.

-- Validation d'un point. Fonction interne : jamais exposée aux clients.
create or replace function public.taga_normalize_ride_point(
  p_point jsonb,
  p_field text
)
returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  label_value text;
  lat_value numeric;
  lng_value numeric;
begin
  if p_point is null or jsonb_typeof(p_point) <> 'object' then
    raise exception 'Le point % est requis.', p_field using errcode = '22023';
  end if;

  if jsonb_typeof(p_point->'label') is distinct from 'string' then
    raise exception 'Le libellé du point % est invalide.', p_field using errcode = '22023';
  end if;
  label_value := nullif(btrim(p_point->>'label'), '');
  if label_value is null or char_length(label_value) > 240 then
    raise exception 'Le libellé du point % est invalide.', p_field using errcode = '22023';
  end if;

  -- Type JSON strictement numérique : refuse absent, null, texte (« NaN »,
  -- « 5.3 »), booléen, objet, tableau. jsonb n'admet ni NaN ni Infinity.
  if jsonb_typeof(p_point->'lat') is distinct from 'number'
     or jsonb_typeof(p_point->'lng') is distinct from 'number' then
    raise exception 'Les coordonnées du point % sont requises et doivent être numériques.', p_field
      using errcode = '22023';
  end if;

  -- Comparaison en numeric : aucun dépassement possible avant le contrôle des bornes.
  lat_value := (p_point->>'lat')::numeric;
  lng_value := (p_point->>'lng')::numeric;

  if lat_value not between -90 and 90 or lng_value not between -180 and 180 then
    raise exception 'Les coordonnées GPS du point % sont hors bornes.', p_field
      using errcode = '22023';
  end if;

  if lat_value = 0 and lng_value = 0 then
    raise exception 'Les coordonnées (0,0) du point % ne sont pas une position valide.', p_field
      using errcode = '22023';
  end if;

  return jsonb_build_object(
    'label', label_value,
    'lat', lat_value::double precision,
    'lng', lng_value::double precision
  );
end;
$$;

revoke all on function public.taga_normalize_ride_point(jsonb, text) from public, anon, authenticated;

-- Même signature, même identité (auth.uid()), mêmes restrictions de rôle,
-- statut initial et prix forcés côté serveur ; seule la validation des points change.
create or replace function public.create_ride(
  p_pickup jsonb,
  p_destination jsonb,
  p_ride_type public.taga_ride_type,
  p_scheduled_at timestamptz default null
)
returns public.rides
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := (select auth.uid());
  pickup_value jsonb;
  destination_value jsonb;
  created_ride public.rides;
begin
  if current_user_id is null then
    raise exception 'Une session est nécessaire pour créer une course.'
      using errcode = '28000';
  end if;

  if not exists (
    select 1
    from public.profiles
    where public.profiles.id = current_user_id
      and public.profiles.role = 'passenger'
      and public.profiles.status = 'active'
  ) then
    raise exception 'Seul un passager actif peut créer une course.'
      using errcode = '42501';
  end if;

  pickup_value := public.taga_normalize_ride_point(p_pickup, 'de départ');
  destination_value := public.taga_normalize_ride_point(p_destination, 'de destination');

  if p_scheduled_at is not null and p_scheduled_at < now() then
    raise exception 'La date planifiée doit être future.'
      using errcode = '22023';
  end if;

  insert into public.rides (
    passenger_id,
    pickup_label,
    pickup_lat,
    pickup_lng,
    destination_label,
    destination_lat,
    destination_lng,
    ride_type,
    scheduled_at,
    status,
    estimated_price
  ) values (
    current_user_id,
    pickup_value->>'label',
    (pickup_value->>'lat')::double precision,
    (pickup_value->>'lng')::double precision,
    destination_value->>'label',
    (destination_value->>'lat')::double precision,
    (destination_value->>'lng')::double precision,
    p_ride_type,
    p_scheduled_at,
    'requested',
    null
  )
  returning * into created_ride;

  insert into public.ride_status_history (ride_id, status, actor_id)
  values (created_ride.id, 'requested', current_user_id);

  return created_ride;
end;
$$;

-- Désactivation des commandes réelles. Idempotent et réversible.
-- On révoque aussi `authenticated` ET les privilèges hérités (public/anon) :
-- sur Supabase, les privilèges par défaut du schéma public accordent EXECUTE
-- aux rôles API lors d'une CRÉATION de fonction ; create or replace conserve
-- l'ACL existante, mais on la réaffirme explicitement. Le rôle service_role
-- (clé serveur, jamais embarquée dans un client) n'est volontairement pas
-- modifié ici : voir docs/backend-rides.md.
revoke all on function public.create_ride(jsonb, jsonb, public.taga_ride_type, timestamptz) from public, anon, authenticated;
