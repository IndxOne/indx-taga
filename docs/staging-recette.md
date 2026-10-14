# Recette Supabase — injection d'une course de test

Procédure **soumise à validation humaine**. Aucun environnement distant n'est connecté par le dépôt, la CI ni cet assistant.

## Ce que fait le script
`supabase/staging/seed_test_ride.sql` insère **une** course `searching` et **deux** lignes d'historique pour un passager de test actif, dans une transaction unique (tout ou rien). Il ne crée ni fonction, ni rôle, ni `GRANT`, ni RPC, ne touche pas à `create_ride` et ne contient aucun secret.

C'est un script **`psql`** : ses méta-commandes (`\set`, `\if`, `\gset`) ne fonctionnent **pas** dans le SQL Editor de Supabase. Ne pas le coller dans l'éditeur web.

## Contrôles intégrés (avant toute écriture)
1. `confirm_isolated_staging=yes` — **déclaratif** : cela ne prouve pas que la base est isolée. Seule l'étape 1 ci-dessous le garantit.
2. Session **et** rôle courant = `postgres` (rôle administratif attendu). `anon`, `authenticated`, `service_role`, `authenticator` sont refusés. `service_role` n'est jamais un contournement.
3. Privilèges réels : `INSERT`+`SELECT` sur `rides` et `ride_status_history`, `SELECT` sur `profiles`, contournement de RLS (`BYPASSRLS`, ou propriétaire sans RLS forcé). Le `postgres` hébergé n'est pas superuser : `rolsuper` n'est donc pas exigé.
4. `create_ride` existe et n'est exécutable ni par `anon` ni par `authenticated` (migration 012 appliquée).
5. Passager actif (`role = passenger`, `status = active`).
6. Après insertion : exactement 1 course et 2 lignes d'historique, sinon erreur et annulation.

`expected_admin_role` (défaut `postgres`) n'existe que pour les tests sur base jetable. Ne jamais le définir sur Supabase.

## Procédure
1. **Identifier le projet cible.** Dashboard Supabase → *Project Settings* → *General* : noter le *Project ID*, le nom et l'organisation. Vérifier que c'est un projet dédié à la recette (aucun utilisateur ni donnée réels, aucun domaine de production). En cas de doute : **stop**.
2. **Examiner les migrations appliquées.** *Database → Migrations* (ou `supabase migration list` après `supabase link`). Attendu : 001 à 012 appliquées, dans l'ordre, rien d'autre. Vérifier en SQL (SQL Editor, lecture seule) que `create_ride` n'est pas accordée aux clients :
   ```sql
   select has_function_privilege('anon', 'public.create_ride(jsonb,jsonb,public.taga_ride_type,timestamptz)', 'EXECUTE') as anon,
          has_function_privilege('authenticated', 'public.create_ride(jsonb,jsonb,public.taga_ride_type,timestamptz)', 'EXECUTE') as authenticated;
   -- attendu : false | false
   ```
3. **Vérifier les privilèges** du rôle `postgres` avec lequel `psql` se connectera :
   ```sql
   select current_user, session_user,
          has_table_privilege('public.rides', 'INSERT') as rides_insert,
          has_table_privilege('public.ride_status_history', 'INSERT') as hist_insert,
          has_table_privilege('public.profiles', 'SELECT') as profiles_select,
          (select rolbypassrls from pg_roles where rolname = current_user) as bypass_rls;
   ```
4. **Sauvegarde / restauration.** Confirmer une sauvegarde récente (*Database → Backups*, ou Point-in-Time Recovery si activé) ou accepter de recréer le projet de recette. La seule écriture du script est une course + 2 lignes, supprimables (étape 7).
5. **Passager de test.** Choisir l'`id` d'un compte de **test** existant (`profiles.role = 'passenger'`, `status = 'active'`). Le script n'en crée pas.
6. **Exécution contrôlée.** Depuis un poste de confiance, avec la chaîne de connexion fournie hors dépôt (variables d'environnement ou fichier `~/.pgpass`, jamais dans un script, une commande copiée dans un ticket ni un log) :
   ```bash
   psql -v confirm_isolated_staging=yes \
        -v passenger_id=<uuid-passager-test> \
        -v pickup_label="Point A (test)" -v pickup_lat=5.3600 -v pickup_lng=-4.0083 \
        -v dest_label="Point B (test)"   -v dest_lat=5.3200  -v dest_lng=-4.0200 \
        -f supabase/staging/seed_test_ride.sql
   ```
   Succès : `NOTICE: Course de test créée : <uuid> (1 course, 2 lignes d'historique)`. Toute autre issue est un refus : rien n'a été écrit. Ne pas contourner un refus ; en comprendre la cause.
7. **Vérifications** :
   ```sql
   select r.id, r.status, r.estimated_price, (select count(*) from public.ride_status_history h where h.ride_id = r.id) as history
   from public.rides r where r.id = '<uuid-course>';   -- searching | null | 2
   ```
   Puis recette fonctionnelle : dispatch (offre 30 s), transitions 011, récapitulatif.
8. **Nettoyage** (SQL Editor ou `psql`, rôle `postgres`) :
   ```sql
   begin;
   delete from public.ride_status_history where ride_id = '<uuid-course>';
   delete from public.rides where id = '<uuid-course>';   -- les offres de dispatch suivent (ON DELETE CASCADE)
   commit;
   ```
   Vérifier que `select count(*) from public.rides where id = '<uuid-course>'` renvoie 0. Restaurer la sauvegarde si l'état n'est pas celui attendu.

## Limites
- La confirmation `psql` est une déclaration, pas une preuve d'isolation (étape 1).
- Les tests automatiques (`supabase/tests/staging_seed.test.sh`) tournent sur une base PostgreSQL jetable. Le contrôle est exercé avec un rôle **non-superuser** (`NOSUPERUSER`, `BYPASSRLS`, droits explicites) imitant `postgres`, mais cela **ne prouve pas** la compatibilité avec un projet Supabase hébergé : privilèges réels du `postgres` hébergé, RLS via PostgREST, JWT, Realtime restent à constater lors de l'étape 3 et de la recette.
