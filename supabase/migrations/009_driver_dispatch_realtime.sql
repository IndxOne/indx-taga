-- TAGA : lecture de l'offre courante et diffusion Realtime côté chauffeur.
-- Le chauffeur ne lit jamais directement une course non attribuée : la RPC
-- vérifie son offre et renvoie l'offre ainsi que la course correspondante.

create or replace function public.get_driver_active_offer()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := (select auth.uid());
  offer_row public.ride_dispatch_offers;
  ride_row public.rides;
begin
  if current_user_id is null then
    raise exception 'Une session est nécessaire pour lire les offres.'
      using errcode = '28000';
  end if;

  select o.*
  into offer_row
  from public.ride_dispatch_offers o
  where o.driver_id = current_user_id
    and o.status = 'offered'
    and o.expires_at > now()
  order by o.offered_at asc, o.id
  limit 1;

  if not found then
    return null;
  end if;

  select r.*
  into ride_row
  from public.rides r
  where r.id = offer_row.ride_id;

  if not found then
    return null;
  end if;

  return jsonb_build_object(
    'offer', to_jsonb(offer_row),
    'ride', to_jsonb(ride_row)
  );
end;
$$;

revoke execute on function public.get_driver_active_offer() from public, anon;
grant execute on function public.get_driver_active_offer() to authenticated;

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    if not exists (
      select 1
      from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = 'ride_dispatch_offers'
    ) then
      alter publication supabase_realtime add table public.ride_dispatch_offers;
    end if;
  end if;
end;
$$;

alter table public.ride_dispatch_offers replica identity full;
