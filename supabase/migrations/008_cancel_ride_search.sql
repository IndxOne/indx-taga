-- TAGA : annulation et nouvelle tentative d'une recherche passager.
-- Les deux opérations restent côté serveur : le client ne peut ni modifier
-- directement rides, ni fermer les offres d'un autre utilisateur.

create or replace function public.cancel_ride_search(p_ride_id uuid)
returns public.rides
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := (select auth.uid());
  ride_row public.rides;
begin
  if current_user_id is null then
    raise exception 'Une session est nécessaire pour annuler la recherche.'
      using errcode = '28000';
  end if;

  select r.*
  into ride_row
  from public.rides r
  where r.id = p_ride_id
    and r.passenger_id = current_user_id
  for update;

  if not found then
    raise exception 'Course introuvable pour ce passager.' using errcode = '42501';
  end if;

  if ride_row.status = 'cancelled' then
    return ride_row;
  end if;

  if ride_row.status not in ('requested', 'searching') then
    raise exception 'Cette course ne peut plus être annulée.' using errcode = '55000';
  end if;

  update public.ride_dispatch_offers
  set status = 'cancelled',
      responded_at = coalesce(responded_at, now())
  where ride_id = ride_row.id
    and status = 'offered';

  update public.rides
  set status = 'cancelled',
      dispatch_deadline_at = null
  where id = ride_row.id
  returning * into ride_row;

  insert into public.ride_status_history (ride_id, status, actor_id)
  values (ride_row.id, 'cancelled', current_user_id);

  return ride_row;
end;
$$;

create or replace function public.retry_ride_search(p_ride_id uuid)
returns public.rides
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := (select auth.uid());
  ride_row public.rides;
begin
  if current_user_id is null then
    raise exception 'Une session est nécessaire pour relancer la recherche.'
      using errcode = '28000';
  end if;

  select r.*
  into ride_row
  from public.rides r
  where r.id = p_ride_id
    and r.passenger_id = current_user_id
  for update;

  if not found then
    raise exception 'Course introuvable pour ce passager.' using errcode = '42501';
  end if;

  if ride_row.status <> 'no_driver' then
    raise exception 'La recherche ne peut être relancée qu’après expiration.'
      using errcode = '55000';
  end if;

  update public.rides
  set status = 'requested',
      driver_id = null,
      assigned_at = null,
      dispatch_deadline_at = null
  where id = ride_row.id
  returning * into ride_row;

  insert into public.ride_status_history (ride_id, status, actor_id)
  values (ride_row.id, 'requested', current_user_id);

  return ride_row;
end;
$$;

revoke execute on function public.cancel_ride_search(uuid) from public, anon;
grant execute on function public.cancel_ride_search(uuid) to authenticated;

revoke execute on function public.retry_ride_search(uuid) from public, anon;
grant execute on function public.retry_ride_search(uuid) to authenticated;
