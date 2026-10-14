-- Bootstrap minimal d'une base PostgreSQL JETABLE pour rejouer les migrations
-- hors Supabase. Reproduit uniquement ce que les migrations supposent
-- (rôles, schéma auth, auth.uid()/auth.jwt(), publication Realtime).
-- Ne jamais exécuter sur un projet Supabase : il fournit déjà tout cela.
create role anon nologin;
create role authenticated nologin;
create role service_role nologin;

create schema auth;
create table auth.users (id uuid primary key);
create function auth.uid() returns uuid language sql stable as
  $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
create function auth.jwt() returns jsonb language sql stable as
  $$ select coalesce(nullif(current_setting('request.jwt.claims', true), '')::jsonb, '{}'::jsonb) $$;

grant usage on schema auth to anon, authenticated, service_role;
grant usage on schema public to anon, authenticated, service_role;
create publication supabase_realtime;
