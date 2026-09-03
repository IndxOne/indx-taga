-- TAGA : restaure le créateur d'offre utilisé par request_ride_dispatch.
-- Cette migration corrige la dérive de la base de développement sans rejouer
-- la migration 003.

create or replace function public.create_next_ride_dispatch_offer(p_ride_id uuid)
returns public.ride_dispatch_offers
language plpgsql
security definer
set search_path = ''
as $$
declare
  ride_row public.rides;
  candidate public.driver_profiles;
  offer_row public.ride_dispatch_offers;
begin
  update public.ride_dispatch_offers
  set status = 'expired', responded_at = now()
  where status = 'offered'
    and expires_at <= now();

  select r.* into ride_row
  from public.rides r
  where r.id = p_ride_id
  for update;

  if not found or ride_row.status <> 'searching' then
    return null;
  end if;

  if ride_row.dispatch_deadline_at is not null
    and ride_row.dispatch_deadline_at <= now() then
    return null;
  end if;

  select dp.* into candidate
  from public.driver_profiles dp
  join public.profiles p on p.id = dp.user_id
  where p.role = 'driver'
    and p.status = 'active'
    and dp.verification_status = 'verified'
    and dp.availability_status = 'available'
    and exists (
      select 1
      from public.vehicles v
      where v.driver_id = dp.user_id
        and v.status = 'active'
    )
    and not exists (
      select 1
      from public.ride_dispatch_offers active_offer
      where active_offer.driver_id = dp.user_id
        and active_offer.status = 'offered'
    )
    and not exists (
      select 1
      from public.rides active_ride
      where active_ride.driver_id = dp.user_id
        and active_ride.status in ('assigned', 'arriving', 'arrived', 'in_progress')
    )
  order by dp.available_since asc nulls last, dp.user_id
  for update of dp skip locked
  limit 1;

  if not found then
    return null;
  end if;

  begin
    insert into public.ride_dispatch_offers (
      ride_id,
      driver_id,
      status,
      offered_at,
      expires_at
    ) values (
      p_ride_id,
      candidate.user_id,
      'offered',
      now(),
      now() + interval '30 seconds'
    )
    returning * into offer_row;
  exception when unique_violation then
    -- Une autre réservation a gagné la course ou le chauffeur.
    return null;
  end;

  return offer_row;
end;
$$;

revoke execute on function public.create_next_ride_dispatch_offer(uuid)
  from public, anon, authenticated;
