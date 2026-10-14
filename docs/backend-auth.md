# TAGA — authentification et rôles

Le Lot 1 sépare le client React du fournisseur d’authentification : les écrans utilisent `otpService`, `accountService` et `SessionGuard`, jamais le client Supabase directement.

## Modes d’exécution

Démo locale ou preview sans backend :

```text
VITE_DEMO_MODE=true
```

Mode réel :

```text
VITE_DEMO_MODE=false
VITE_SUPABASE_URL=https://<projet>.supabase.co
VITE_SUPABASE_ANON_KEY=<clé publique anon/publishable>
```

Les deux variables Supabase sont obligatoires en mode réel. Aucune `service_role` key ne doit être préfixée par `VITE_` ou embarquée dans le bundle.

## Migration

`supabase/migrations/001_profiles_roles.sql` est une étape historique : ne l'appliquer
ni la rejouer sur un projet Supabase sans inventaire préalable des migrations déjà
appliquées (voir [`staging-recette.md`](./staging-recette.md)). Elle crée les profils, les profils spécialisés, les véhicules, les contraintes, les index et les politiques RLS.

Le rôle est choisi uniquement à la création initiale du profil et ne peut plus être changé par le client. Le rôle `admin` est réservé à une opération serveur.

## AuthService

Le contrat utilisé par l’interface est :

```text
requestOtp(phone)
verifyOtp(phone, token)
getSession()
getCurrentUser()
signOut()
subscribeToAuthChanges(callback)
```

`DemoAuthService` conserve le parcours de démonstration. `SupabaseAuthService` utilise Supabase Auth avec persistance de session et renouvellement automatique du jeton.
