# Plan d’implémentation — OTP SMS passager

Date : 24 août 2026  
Objectif : remplacer la simulation locale par un OTP réel, tout en conservant un routage contrôlé vers le numéro de test en développement.

## État de départ

Le client possède déjà :

- `/onboarding` avec saisie du numéro ;
- `/otp` avec saisie de six chiffres ;
- un store Zustand contenant `phone` ;
- un override de développement vers `+330775679067` pour le rôle passager ;
- une navigation locale vers `/client/home` ou `/driver/online`.

Le client ne possède pas encore d’appel Supabase, de fournisseur SMS, de challenge OTP ni de vérification serveur.

## Avancement d’implémentation local

La première tranche frontend est réalisée :

- service OTP interchangeable dans `src/services/otpService.js` ;
- simulation dev conservée si `VITE_OTP_API_URL` est vide ;
- contrat API prévu pour `/send-otp`, `/verify-otp` et `/resend-otp` ;
- challenge et numéro masqué conservés dans Zustand ;
- états d’envoi, de renvoi, de vérification et d’erreur dans les écrans ;
- labels accessibles et `autocomplete="one-time-code"` ajoutés aux champs OTP ;
- `.env.example` ajouté pour documenter le branchement de l’API.

La simulation dev accepte encore tout code à six chiffres. La vérification réelle reste bloquée jusqu’à l’implémentation de l’API Supabase.

## Décisions d’architecture

1. L’identité et la validation OTP restent côté serveur.
2. Le numéro de test ne doit jamais être une règle de sécurité côté client.
3. En développement, le routage vers le numéro de test est piloté par une variable serveur/configuration de dev, pas par une constante exposée au bundle final.
4. En production, le SMS est envoyé au numéro normalisé saisi par le passager.
5. Le code OTP n’est jamais stocké en clair côté client ni dans une table accessible par le client.
6. Le succès de la vérification crée ou restaure une session Supabase Auth avant d’ouvrir `/client/home`.

## Décision validée (24 août 2026) — génération du code : Option B (custom, hors Auth téléphone native)

Tranché avec le Product Owner : le code à 6 chiffres **n'est pas généré par
`supabase.auth.signInWithOtp`** (Auth téléphone native de Supabase). Cette
option native impose un fournisseur SMS de la liste supportée par
Supabase (Twilio, MessageBird, Vonage, TextLocal) — aucun fournisseur
ivoirien/local n'y figure, ce qui contraindrait injustement le choix du
Product Owner à l'étape 1 du tableau de responsabilités
(`2026-08-24-taga-responsabilites-implementation.md`).

**Retenu à la place** : génération et vérification custom dans des Edge
Functions, indépendantes du fournisseur SMS choisi (Orange, Twilio ou
autre — décision fournisseur toujours ouverte, seule la mécanique de
génération est tranchée ici).

### Schéma — table `otp_challenges`

Nouvelle table, à ajouter dans `2026-08-24-taga-supabase-schema.md` lors
de sa prochaine révision (non encore répercutée dans ce document au
24/08, seulement documentée ici en attendant) :

```sql
create table otp_challenges (
  id uuid primary key default gen_random_uuid(),
  phone text not null,               -- format E.164 normalisé
  code_hash text not null,           -- hash (jamais le code en clair)
  purpose text not null default 'onboarding' check (purpose in ('onboarding','login')),
  attempts integer not null default 0,
  max_attempts integer not null default 5,
  expires_at timestamptz not null default (now() + interval '5 minutes'),
  resend_count integer not null default 0,
  created_at timestamptz not null default now(),
  verified_at timestamptz
);
create index otp_challenges_phone_idx on otp_challenges(phone) where verified_at is null;
```

Aucune policy RLS `select`/`insert`/`update` pour `authenticated` ou
`anon` — table lue/écrite exclusivement par les Edge Functions
(`service_role`), même principe que `payments`/`payouts` dans le schéma
principal.

### Edge Functions (remplace la ligne "Edge Function ou client Supabase" de la Phase 2)

- **`send-otp`** (`phone`, `purpose`) : normalise le numéro (E.164),
  génère un entier aléatoire à 6 chiffres (`crypto.getRandomValues`, pas
  `Math.random`), le hash (ex. SHA-256 + sel), insère la ligne
  `otp_challenges`, appelle l'API du fournisseur SMS retenu, renvoie
  `challenge_id` + numéro masqué au client — jamais le code.
- **`verify-otp`** (`challenge_id`, `code`) : recharge le challenge,
  vérifie `expires_at` et `attempts < max_attempts`, compare le hash.
  Échec → incrémente `attempts`, renvoie une erreur générique (ne pas
  révéler si c'est le numéro ou le code qui est en cause). Succès → pose
  `verified_at`, puis **émet une session Supabase** : le moyen le plus
  simple avec ce flux custom est de signer côté serveur un JWT compatible
  Supabase (`role: authenticated`, `sub: <user_id>`) avec la clé JWT du
  projet, retourné au client qui l'installe via `supabase.auth.setSession()`
  — Supabase Auth n'a pas de méthode publique pour "réclamer" une session
  après une vérification OTP entièrement externe à son flux natif.
- **`resend-otp`** (`challenge_id`) : incrémente `resend_count`,
  respecte un cooldown serveur (aligné sur le cooldown déjà affiché côté
  client, 30s), régénère un nouveau code (n'étend pas silencieusement
  l'ancien).

### Numéro de test développeur

Le routage vers `DEV_TEST_PASSENGER_PHONE` (Phase 3) s'applique **dans
`send-otp`** : si `purpose = 'onboarding'`, rôle passager, et variable
serveur `TAGA_ENV=development`, le SMS est envoyé au numéro de test
configuré au lieu du numéro saisi — mais `otp_challenges.phone` reste le
numéro réellement saisi par le passager (pas le numéro de test), pour ne
pas fausser l'historique/les futurs comptes.

## Phases

### Phase 1 — Contrat frontend/backend

- Définir les réponses communes : `send_otp`, `verify_otp`, `resend_otp`.
- Ajouter les états `idle`, `sending`, `sent`, `verifying`, `verified`, `error`.
- Afficher les erreurs : numéro invalide, code expiré, code incorrect, trop de tentatives, fournisseur indisponible.
- Désactiver les boutons pendant les appels et conserver le cooldown de renvoi.
- Ajouter un identifiant de challenge non sensible côté client.

### Phase 2 — OTP custom (Edge Functions), pas d'Auth téléphone native

*(tranché 24/08, voir section "Décision validée" ci-dessus — remplace
l'ambiguïté initiale de cette phase)*

- Créer la table `otp_challenges` (schéma détaillé plus haut).
- Implémenter les Edge Functions `send-otp`, `verify-otp`, `resend-otp`
  (`service_role`, aucune policy client sur `otp_challenges`).
- Normaliser les numéros au format E.164 avant envoi.
- À la vérification réussie, émettre une session Supabase par signature
  JWT serveur (voir détail ci-dessus), pas via `auth.signInWithOtp`.
- Vérifier le code côté serveur et ne jamais accepter six chiffres
  uniquement sur le client.

### Phase 3 — Routage de test développeur

- Ajouter une variable serveur de développement, par exemple `DEV_TEST_PASSENGER_PHONE`.
- Si le rôle est passager et que l’environnement est explicitement `development`, remplacer la destination côté fonction serveur.
- Journaliser uniquement un identifiant masqué, jamais le code OTP ni le numéro complet.
- Interdire ce mode dans les environnements staging/production par défaut.
- Prévoir un code fixe de test uniquement si nécessaire et uniquement derrière une garde serveur explicite.

### Phase 4 — Adaptation frontend

- Remplacer `setPhone` local par l’appel `sendOtp(phone, role)`.
- Afficher le numéro masqué renvoyé par le serveur, pas une valeur déduite localement.
- Appeler `verifyOtp(challengeId, code)` depuis `/otp`.
- Rediriger vers `/client/home` uniquement après session valide.
- Prévoir le renvoi et la modification du numéro.
- Ajouter les labels accessibles et `autocomplete="one-time-code"`.

### Phase 5 — QA et sécurité

- Tests unitaires du formatage et des états d’erreur.
- Tests Edge Function : numéro valide, numéro invalide, expiration, réutilisation, trop de tentatives.
- Test de non-régression chauffeur : aucun routage vers le numéro passager.
- Test dev : toute saisie passager aboutit au numéro de test configuré.
- Test production/staging : aucune substitution du numéro.
- Vérifier les logs, quotas, rate limiting et coûts fournisseur.
- Ajouter un test navigateur du parcours complet avec un fournisseur SMS de sandbox ou un code de test serveur contrôlé.

## Critères d’acceptation

- Un passager saisit un numéro valide et reçoit réellement le SMS.
- Le code correct crée une session Supabase et ouvre `/client/home`.
- Un code incorrect ou expiré reste sur `/otp` avec un message exploitable.
- Le renvoi est limité par cooldown et rate limiting serveur.
- Le numéro de test ne fonctionne qu’en environnement de développement explicitement configuré.
- Aucun code OTP, secret fournisseur ou numéro complet n’est exposé dans les logs client.
- Le parcours chauffeur reste inchangé.
- `npm run build`, `npm run lint` et les tests backend/e2e passent.

## Ordre recommandé

1. Configurer Supabase Auth et le fournisseur SMS.
2. Écrire les fonctions serveur et leurs tests.
3. Ajouter la configuration dev du numéro de test.
4. Brancher `/onboarding` et `/otp`.
5. Ajouter les états d’erreur et l’accessibilité.
6. Exécuter la QA complète puis retirer la simulation client.

## Hors périmètre immédiat

- Persistance métier du profil passager.
- Notifications push après création de course.
- Remplacement définitif de l’indicatif CI dans les maquettes.
- Déploiement ou push GitLab.
