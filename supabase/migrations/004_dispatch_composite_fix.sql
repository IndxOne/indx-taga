-- TAGA Lot 3 hotfix : ignorer explicitement le retour composite de
-- l’allocation d’offre dans request_ride_dispatch.
-- La version précédente tentait de l’assigner directement à une variable
-- record, ce qui provoquait une conversion texte -> uuid côté PostgreSQL.

create or replace function public.request_ride_dispatch(p_ride_id uuid)
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
    raise exception 'Une session est nécessaire pour lancer la recherche.'
      using errcode = '28000';
  end if;

  select r.* into ride_row
  from public.rides r
  where r.id = p_ride_id
    and r.passenger_id = current_user_id
  for update;

  if not found then
    raise exception 'Course introuvable.' using errcode = '42501';
  end if;

  if ride_row.status = 'requested' then
    update public.rides
    set status = 'searching',
        dispatch_deadline_at = now() + interval '120 seconds'
    where id = p_ride_id
    returning * into ride_row;

    insert into public.ride_status_history (ride_id, status, actor_id)
    values (p_ride_id, 'searching', current_user_id);

    perform public.create_next_ride_dispatch_offer(p_ride_id);
  elsif ride_row.status = 'searching'
    and ride_row.dispatch_deadline_at is not null
    and ride_row.dispatch_deadline_at <= now() then
    update public.rides
    set status = 'no_driver', dispatch_deadline_at = null
    where id = ride_row.id
    returning * into ride_row;

    insert into public.ride_status_history (ride_id, status, actor_id)
    values (ride_row.id, 'no_driver', current_user_id);
  elsif ride_row.status = 'searching' then
    perform public.create_next_ride_dispatch_offer(p_ride_id);
  end if;

  return ride_row;
end;
$$;

grant execute on function public.request_ride_dispatch(uuid) to authenticated;
