-- Bootstrap minimal d'une base PostgreSQL JETABLE pour rejouer les migrations
-- hors Supabase. Reproduit uniquement ce que les migrations supposent
-- (rôles, schéma auth, auth.uid()/auth.jwt(), publication Realtime).
-- Ne jamais exécuter sur un projet Supabase : il fournit déjà tout cela.
-- Les rôles sont globaux au cluster : création idempotente pour rejouer sur une base neuve.
do $$
declare r text;
begin
  foreach r in array array['anon', 'authenticated', 'service_role'] loop
    if not exists (select 1 from pg_roles where rolname = r) then
      execute format('create role %I nologin', r);
    end if;
  end loop;
end $$;

create schema auth;
create table auth.users (id uuid primary key);
create function auth.uid() returns uuid language sql stable as
  $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
create function auth.jwt() returns jsonb language sql stable as
  $$ select coalesce(nullif(current_setting('request.jwt.claims', true), '')::jsonb, '{}'::jsonb) $$;

grant usage on schema auth to anon, authenticated, service_role;
grant usage on schema public to anon, authenticated, service_role;
create publication supabase_realtime;
