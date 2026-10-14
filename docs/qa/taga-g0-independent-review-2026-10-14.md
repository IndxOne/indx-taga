# TAGA — Revue indépendante G0 (2026-10-14)

## Verdict

**NO-GO** pour toute qualification production ou mise en service réelle. La branche examinée est la baseline `main` au SHA `e8c7bce71e185fbc8c3a20fcb85361a63819e051`. La branche Claude et une PR Draft ne sont pas visibles sur GitHub au contrôle du 14 octobre 2026 ; la phase de revue du diff Claude reste donc en attente.

Cette revue est une inspection statique et une exécution des tests navigateur simulés via Vitest/jsdom. Aucune exécution contre PostgreSQL/Supabase, aucun test Realtime en multi-utilisateurs et aucun navigateur réel n'ont été effectués. Les tests SQL regex existants sont traités comme des indices de contrat, pas comme preuve d'isolation effective.

## P0/P1 — blocages

### P1 — Parcours chauffeur réel non persisté et absence de workflow de fin côté serveur

`supabase/migrations/001` à `010` ne définissent pas de RPC qui fasse évoluer une course attribuée de `assigned` vers `arriving`, `arrived`, `in_progress` puis `completed`. La table `rides` n'accorde aux utilisateurs authentifiés que `SELECT` (migration 002, lignes 64–74). Pourtant `src/screens/driver/Navigation.jsx:20-27` fait progresser ces statuts uniquement avec `setRideStatus` dans Zustand ; `src/screens/driver/RideInProgress.jsx:20-24` termine pareillement la course et crédite le portefeuille client-side. Un refresh ou un client modifié annule/contourne cette progression ; le statut serveur ne peut jamais passer à `completed` via le parcours livré. Reproduction : mode réel, accepter une offre, cliquer « Je suis arrivé », « Démarrer course », « Terminer la course », puis interroger `rides` ou recharger : aucune RPC de statut n'est envoyée et la ligne reste attribuée.

Correction attendue : transitions explicites autorisées par rôle/état et enregistrées atomiquement par RPC côté serveur ; fin, libération du chauffeur et historique doivent être validés/écrits ensemble. La UI doit n'afficher succès et gains qu'après confirmation serveur.

### P1 — Données financières de démonstration affichées comme réelles

La course créée côté serveur a `estimated_price = null` (migration 002, lignes 161–185). `getRidePricing(null, ...)` substitue les tarifs fixes `src/services/rideFare.js:1-27`; cette substitution est réutilisée par `rideService.js:69-85`, `rideRealtimeService.js:23-43`, `dispatchService.js:23-34` et les écrans. `src/screens/client/RideEnd.jsx:24-64` affiche néanmoins « Total payé », des lignes de frais, un moyen de paiement marqué « Payé » et un numéro de reçu fictif ; `PayoutRecap.jsx:15-49` affiche des gains et un solde local, puis enregistre un retrait fictif. Le bouton de reçu indique ensuite que le service n'existe pas (ligne 102). Le store `src/store/useAppStore.js:26-50,99-118` contient les montants, comptes et historique de démonstration par défaut.

Reproduction : mode réel, jusqu'à l'écran de fin de course / Gains ; le modèle serveur ne fournit aucun tarif ni paiement, mais les écrans déduisent des montants statiques et présentent un reçu/paiement comme réalisé. Correction attendue : masquer/désactiver ces montants, reçus, soldes et actions tant que des services autoritatifs et états de paiement vérifiés ne les alimentent pas ; distinguer explicitement toute démo.

### P1 — Build Netlify de production configuré en mode démo

`netlify.toml:8-15` force `VITE_DEMO_MODE="true"` en `context.production`, alors que Deploy Preview et branch deploy utilisent `false`. Un déploiement Production exécuterait donc les parcours simulés et non les services Supabase, indépendamment des variables de production configurées. Reproduction : inspecter la configuration de build Netlify pour le contexte Production ; l'application sélectionne alors `Demo*Service` (`rideService.js:169-176`, `rideRealtimeService.js:305-314`). Correction attendue : décision éditoriale explicite sur le rôle de production, puis configuration cohérente avec ce rôle ; ne pas publier avant validation des variables/projet et tests.

## P2 — À corriger/valider avant d'ouvrir les parcours correspondants

### P2 — Contrôle du statut chauffeur non répété lors de l'acceptation

La sélection de candidats vérifie le profil actif, `verification_status = 'verified'`, disponibilité et véhicule actif (`supabase/migrations/003_dispatch.sql:241-263`). Mais `respond_to_ride_offer` ne vérifie, à l'acceptation, que `profiles.role = 'driver'` et `profiles.status = 'active'` (`003_dispatch.sql:378-385`) avant d'accepter l'offre (`431-450`). Un chauffeur suspendu/non vérifié après émission d'une offre encore valide peut donc tenter de l'accepter. Reproduction DB requise : créer une offre valide pour un chauffeur vérifié, révoquer son statut avec le rôle serveur, puis appeler la RPC avant expiration. Correction attendue : revalider atomiquement vérification, disponibilité, profil et véhicule au moment de l'acceptation ; invalider les offres à la révocation.

### P2 — Numéro test substitué en développement même en mode réel

`src/screens/Onboarding.jsx:18-29` remplace le numéro saisi par `DEV_TEST_PASSENGER_PHONE` pour tout passager dans un build Vite `DEV`, sans vérifier `isDemoMode`. En lancement local avec `VITE_DEMO_MODE=false`, l'OTP réel est donc demandé au numéro de test plutôt qu'au numéro saisi. Les builds Netlify de preview/prod ne sont pas concernés par `DEV=false`, mais les essais locaux du vrai OTP le sont. Correction attendue : substitution strictement cantonnée à une voie de test/démo explicitement sélectionnée ; vérifier le numéro envoyé au fournisseur avec des tests mocks puis un OTP réel autorisé.

### P2 — Positions GPS périmées masquées mais non supprimées

La migration 006 filtre la lecture RLS aux positions de moins de 60 s (`006_live_driver_location_freshness.sql:8-20`), et le client arrête d'afficher une position après expiration (`src/services/rideRealtimeService.js:140-153,167-175`). Aucune migration ne purge les lignes anciennes de `driver_locations`. Elles ne sont plus lisibles par les utilisateurs, mais restent stockées. À confirmer selon la politique de rétention/confidentialité attendue ; si « suppression » signifie effacement, définir et tester une rétention server-side.

## Contrôles faits et limites de preuve

- Routes React vérifiées dans `src/App.jsx:27-50` : tous les écrans métier sont derrière `SessionGuard`; les écrans client/chauffeur imposent le rôle. `SessionGuard.jsx:36-53` recharge toutefois le profil backend sans test de vérification chauffeur ; l'autorisation effective doit rester serveur. Le client ne peut pas prouver RLS.
- Migrations 001–010 lues, dont privilèges des tables/RPC. Les RPC `SECURITY DEFINER` sont, dans l'ensemble, créées avec `search_path = ''` et grants explicites ; les protections de rôle/statut sont documentées ci-dessus. Aucun `SECURITY DEFINER` de progression/fin de course n'existe.
- RLS candidat : offres, courses et locations ont des politiques participant/propriétaire. Le code ajoute offres et locations à la publication Realtime (migrations 005/009) ; l'isolation effective doit être testée avec deux JWT/utilisateurs dans une DB de test, notamment pendant révocation d'accès. La documentation Supabase confirme que Postgres Changes ne livre que les lignes lisibles par les politiques RLS ([Realtime Authorization](https://supabase.com/docs/guides/realtime/authorization), [Subscriptions](https://supabase.com/docs/guides/realtime/subscribing-to-database-changes)). Cette propriété générale ne prouve pas la justesse des politiques de cette application.
- Les tests existants incluent des assertions regex sur le SQL (`*Contract.test.js`) et des mocks JS. Ils ne prouvent ni privilèges effectifs, ni concurrence, ni exécution des politiques RLS/Postgres. La doc Supabase recommande des scénarios membre/non-membre dans `supabase/tests/` ([RLS](https://supabase.com/docs/guides/database/postgres/row-level-security)).
- `psql` est installé, mais aucun serveur local n'écoute sur `localhost:5432` (`pg_isready`: no response). Docker n'est pas installé. Supabase CLI est présent, mais `supabase status` a échoué en tentant d'écrire sa télémétrie sous `/home/adminkon/.supabase`, chemin en lecture seule ; aucune instance locale n'a donc été lancée. Aucun accès projet distant n'a été utilisé.
- Aucun Playwright/browser runner n'est dans les dépendances (`npm ls @playwright/test playwright --depth=0`: vide). Les tests du dépôt sont Vitest/jsdom ; aucune inspection visuelle navigateur n'a été possible dans cet environnement.
- Vérifications éditoriales/terrain impossibles dans cette baseline de prototype : les personnes, véhicules, positions, trajets, dates, notes, historiques, bonus, ETA, vitesses et évaluations visibles sont des données mockées (`useAppStore.js`, écrans chauffeur/client). Obtenir la validation produit/ops de chaque donnée officielle et des règles tarifaires/paiement avant toute mise en réel.
- Sécurité dépendances : `npm ci` a annoncé 11 vulnérabilités (4 modérées, 7 hautes). La consultation d'advisories avec `npm audit` a échoué (DNS `registry.npmjs.org` indisponible au contrôle) ; aucun correctif automatique n'a été appliqué et la part de vulnérabilités de production reste à établir.

## Résultats exacts des contrôles

Sur la baseline `e8c7bce71e185fbc8c3a20fcb85361a63819e051` :

| Contrôle | Résultat |
|---|---|
| `npm ci` | exit 0 ; 198 packages ajoutés, 199 audités ; 11 vulnérabilités rapportées (4 moderate, 7 high) |
| `npm run lint` | exit 0 ; avertissement `src/hooks/useAsyncData.js:25:5` (`react(set-state-in-effect`) |
| `npm test` | exit 0 ; 21 fichiers, 98 tests passés |
| `npm run build` | exit 0 ; 126 modules transformés |
| `git diff --check` (baseline) | exit 0 |
| PostgreSQL/RLS runtime | non exécuté : aucun serveur local |
| E2E navigateur | non exécuté : aucun runner navigateur installé |
| `npm audit --omit=dev` | échec réseau/DNS ; advisories non récupérées |

## Matrice indépendante à exécuter sur une DB éphémère

Ne pas considérer la matrice comme validée tant qu'elle n'a pas été exécutée contre une instance PostgreSQL/Supabase locale jetable, avec des rôles/JWT séparés, puis vérifiée par requêtes SQL sur les états persistés :

1. Passager A ne lit/annule/rejoue ni course ni offre de B ; chauffeur non assigné ne lit pas les données course/location ; appel RPC anonyme refusé.
2. Chauffeur pending/rejected/suspended, véhicule inactif, et chauffeur dont la vérification est révoquée pendant une offre ne peuvent ni passer en ligne, ni voir/accepter l'offre.
3. Deux chauffeurs acceptent en parallèle la même offre/course : un seul `driver_id`, une transition et une ligne d'historique cohérentes ; répéter la requête est idempotent.
4. Offre expirée au niveau serveur refusée malgré un timer client en retard ; l'offre expirée est remplacée au plus une fois.
5. Annulation/reprise simultanées et retries répétés : seuls les états autorisés gagnent, sans doublons d'historique ni offre active orpheline.
6. Progression/fin de course, refus des transitions illégales, enregistrement historique, libération du chauffeur et remise en disponibilité atomiques. Actuellement bloqué : RPC de progression/fin absente.
7. Deux utilisateurs abonnés aux mêmes filtres Postgres Changes n'observent que les lignes autorisées par RLS ; répéter avec révocation du profil et nouvelle connexion.
8. GPS plus ancien que 60 s invisible en lecture et Realtime, effacement/purge vérifié après la durée de rétention convenue.
9. Recharger à chaque état client/chauffeur et couper/rétablir le réseau : état serveur restauré, aucune réussite locale mensongère, aucun doublon d'action.
10. Mode réel : aucun tarif de secours, paiement « payé », reçu, solde, gain ou retrait non confirmé affiché comme réel.
11. OTP réel : saisir un numéro non-test ; vérifier par mock le numéro exact normalisé envoyé à `signInWithOtp`, puis réaliser un SMS réel uniquement avec un projet de test autorisé.

## État Git / concurrence / livraison

- Référence distante `main` vérifiée : `e8c7bce71e185fbc8c3a20fcb85361a63819e051`.
- Branches distantes : `codex/lot1-backend-auth-roles` (`dfad7349d248e309bb0bdd2d082968e9e59b83aa`), `codex/lot2-rides` (`24d37317dafe6d2e7a4850881cb339e434f2d0b8`), `codex/lot3-dispatch` (`1b9db86f82cb4bbb0bd7c7793708da83e2a95dc2`), `codex/lot4-geolocation-realtime` (même SHA que main). La branche `claude/taga-g0-integrite-parcours` n'est pas présente au contrôle distant.
- PR GitHub ouvertes/fermées : aucune retournée (`gh pr list --state all`).
- Worktree de revue : `/tmp/indx-taga-g0-review`, branche `codex/taga-g0-revue-test`, créée à `main`; worktree source séparé `/tmp/indx-taga-g0-audit`. Aucun fichier métier modifié.
- Aucun commit, push, PR, migration distante, changement de secret, déploiement ou publication effectué. Le présent rapport est le seul fichier ajouté sur la branche de revue ; pas de tests d'intégration DB ajoutés car ils seraient non exécutables et ne doivent pas être présentés comme preuve de sécurité.
- Prochaine étape : quand la PR Draft de Claude devient visible, figer son SHA, auditer tout le diff, rejouer baseline et matrice, puis publier une revue séparée avec findings ligne par ligne. Ne pas merger.

## G0.2 — Revue indépendante de la PR Claude (2026-10-14)

### Portée et verdict

SHA audité : `27f166007ef844d225b9f5cd9116291284afcf15` (`claude/taga-g0-integrite-parcours`), comparé à `main@e8c7bce71e185fbc8c3a20fcb85361a63819e051`. Le diff complet comprend 42 fichiers (+1601/-175). La PR #1 est une Draft ouverte. Le worktree de revue reste sur `codex/taga-g0-revue-test`; son HEAD est toujours la base. Le worktree détaché `/tmp/indx-taga-pr1-review` est propre au SHA figé.

**NO-GO** pour poursuivre vers une recette Supabase isolée : des P1 demeurent dans les parcours réels (trajet fictif pouvant être réservé, récapitulatif de course non restaurable, finance estimée présentée comme finalisée, numéro ivoirien mal normalisé). Aucun de ces constats n'a été corrigé directement dans la branche Claude. La Preview Netlify accessible n'est qu'un artefact UI : elle ne valide ni RPC, ni RLS/Realtime en conditions multi-utilisateurs, ni le backend Supabase.

### Matrice de la baseline

| Finding baseline | Correction Claude | Preuve | Verdict |
|---|---|---|---|
| P1 — Progression et fin de course uniquement locales | Corrigé pour l'autorité des transitions chauffeur : RPC serveur et hook dédié | `supabase/migrations/011_driver_ride_transitions.sql:13-116`; `src/hooks/useDriverRide.js:1-100`; tests PostgreSQL CI `OK 011_driver_ride_transitions` | GO sur ce finding, sous réserve des limites de concurrence/RLS ci-dessous |
| P1 — Paiement, reçu, tarif et gains fictifs | Partiel : plusieurs faux moyens de paiement/reçus/retraits sont retirés ou désactivés, mais `estimated_price` devient encore `price` et le gain est calculé côté client | `src/services/rideFare.js:31-47`; `src/screens/client/RideEnd.jsx:45-58`; `src/screens/driver/IncomingRequest.jsx:207-235`; tests `rideFare.test.js:35-38` | NO-GO |
| P1 — Production Netlify sélectionne le mode démo | Persistant (hors changement Claude, configuration laissée intacte conformément au périmètre) | `netlify.toml:8-15` ; production `VITE_DEMO_MODE=true`, preview false | NO-GO pour toute mise en production ; pas le motif principal du blocage de recette DB isolée |
| P2 — Vérification chauffeur non répétée lors d'une acceptation d'offre | Persistant, migration 003 non modifiée | `supabase/migrations/003_dispatch.sql:378-385` ne vérifie que rôle/statut actif dans `respond_to_ride_offer` | À corriger avant ouverture publique des offres |
| P2 — Numéro OTP remplacé en mode réel/dev | Corrigé : remplacement limité à la démo de développement | `src/services/phone.js:4-5`; `src/screens/Onboarding.jsx`; `src/services/phone.test.js` | GO sur la substitution; la normalisation nationale reste NO-GO (finding ci-dessous) |
| P2 — Positions GPS périmées masquées mais pas purgées | Persistant / non traité par le diff | politiques de fraîcheur migration 006; pas de purge ajoutée | À confirmer selon rétention, pas un blocage immédiat de recette isolée |

### Findings restants

**P1 — Le réel peut créer une course avec un itinéraire fictif.** `src/store/useAppStore.js:12-16,54-66` fournit Cocody/Riviera 3 → Plateau/CAISTAB comme valeurs fixes. `src/screens/client/Home.jsx:44-50` renvoie vers l'estimation sans champ destination; `src/screens/client/Estimate.jsx:28-41` prend éventuellement la position GPS comme coordonnées de départ, mais conserve les libellés fixes et appelle `createRide`. Le bandeau « Itinéraire provisoire » (`Estimate.jsx:81-82`) ne bloque pas la réservation réelle. Reproduction : mode réel, ouvrir estimation, lancer une course; le backend reçoit des coordonnées GPS de départ avec un libellé de départ et une destination statiques. Impact : dispatch potentiellement vers des lieux différents de la demande réelle. Correction minimale : bloquer `createRide` en mode réel tant que départ/destination n'ont pas des coordonnées et libellés explicitement sélectionnés et concordants; ne pas utiliser le mock comme valeur par défaut.

**P1 — Récapitulatif passager perdu après refresh/déconnexion.** `src/services/rideRealtimeService.js:5-6,123-132` exclut `completed` des statuts restaurables; `src/screens/client/ActiveRide.jsx:141-153` navigue au récapitulatif uniquement sur l'événement realtime et sinon redirige vers l'accueil. `src/screens/client/RideEnd.jsx` lit l'état Zustand local, sans charger la course terminée auprès du serveur. Reproduction : terminer une course alors que l'app passager est hors ligne, ou rafraîchir après la fin, puis ouvrir l'historique/récapitulatif. Impact : résultat serveur non consultable et écran générique possible sans preuve de statut, tarif ou trajet. Correction minimale : charger par identifiant une course terminée appartenant au passager (ou la dernière course terminée), hydrater le récapitulatif depuis le serveur et n'afficher le succès qu'après confirmation serveur.

**P1 — Tarif estimé présenté comme montant final et gain dérivé du taux UI 85 %.** `src/services/rideFare.js:31-47` affecte le même `amount` à `estimatedPrice` et `price`, et dérive `driverEarning` par `DRIVER_COMMISSION_RATE`; le schéma serveur ne fournit qu'`estimated_price` (migration 002). `IncomingRequest.jsx:207-235` peut présenter « TU GAGNES »/« Net 85% », `RideInProgress.jsx:24-27,63-69` « TON GAIN », et `RideEnd.jsx:45-58` « Montant de la course ». Le test `rideFare.test.js:35-38` verrouille cette dérivation (3250 → 2763), il ne démontre pas un gain serveur. Reproduction : fournir un `estimated_price` valide à `getServerRidePricing`, observer `price` et `driverEarning` numériques puis afficher l'offre/course en mode réel. Impact : promesse financière non autoritative; aucune preuve de prix réglé ni de dette chauffeur. Correction minimale : ne renseigner prix final/gain que depuis des champs serveur distincts, explicitement finalisés; afficher toute estimation comme estimation et supprimer le calcul/présentation du gain 85% dans le réel.

**P1 — Normalisation CI perd le zéro national.** `src/services/phone.js:8-15` retire le `0` initial dans la branche locale puis préfixe `+225`; `normalizePhone('07 07 12 34 56')` produit `+225707123456`, au lieu de conserver les dix chiffres nationaux `+2250707123456`. La forme déjà internationale `+225 07 07 12 34 56` conserve le zéro, donc les deux entrées équivalentes divergent. Les tests `src/services/phone.test.js:19-23` ne vérifient que le préfixe. Reproduction : appeler `normalizePhone` sur les deux formes ci-dessus; comparer le suffixe national. Impact : OTP envoyé vers un numéro incorrect/invalide. Correction minimale : normaliser les séparateurs et valider le format E.164 convenu sans supprimer le zéro national; assertions exactes pour les formes locales et `+225`.

**P2 — Disponibilité persistée non restaurée dans Zustand.** `src/store/useAppStore.js:123-124` initialise `driverAvailable=false` sans persistance. `src/screens/driver/Online.jsx:29-66` restaure course/offre, mais pas la disponibilité du profil; l'écriture locale ne se fait qu'après action (`68-84`). Après refresh, le serveur peut conserver `available` alors que l'UI indique hors ligne; le dispatch reste piloté par le statut serveur. La RPC de fin met correctement le profil à offline (`011:94-107`) et `useDriverRide.js:71-72` reflète ce retour. Reproduction : chauffeur en ligne, rafraîchir la page; comparer l'état affiché avec `driver_profiles.status` et l'arrivée d'une offre. Impact : UI et dispatch se contredisent, l'utilisateur ne peut savoir s'il reçoit des demandes. Correction minimale : charger la disponibilité serveur avant d'afficher le contrôle et réconcilier le store après reconnexion; garder l'écriture serveur comme source de vérité.

**P2 — Fond cartographique de démonstration visible en parcours réel.** Les écrans/cartes dessinent encore des trajets SVG prédéfinis (`src/components/ClientRideMap.jsx`, `src/components/DriverRideMap.jsx`) sans positionnement géographique. Le libellé « Carte SVG · aperçu » dans `MapView.jsx` et les messages « Guidage non disponible » réduisent le risque de prétendre à une navigation, mais l'aperçu et les marqueurs peuvent encore être pris pour le trajet de la course réelle. Correction minimale : dans le réel, remplacer le tracé par un état neutre « cartographie non disponible » ou rendre la mention d'aperçu persistante au niveau de chaque carte; aucun changement général de composants mobiles n'est demandé.

### Migration 011 et tests SQL

Points positifs vérifiés dans `supabase/migrations/011_driver_ride_transitions.sql:13-116` : RPC `SECURITY DEFINER`, `search_path=''`, fonctions/objets qualifiés, authentification requise, profil chauffeur actif exigé, chauffeur limité à sa course assignée, cibles et transitions autorisées explicites. Le `SELECT ... FOR UPDATE` sérialise les changements sur une course donnée; la répétition d'une transition déjà appliquée retourne sans ajouter d'historique. Mise à jour du statut, insertion d'historique et libération du chauffeur ont lieu dans le même appel/transaction PostgreSQL; toute erreur annule la fonction. `PUBLIC` et `anon` n'ont pas `EXECUTE`, `authenticated` l'a. La libération n'a lieu qu'après la fin et si aucun autre trajet actif n'existe.

`supabase/tests/011_driver_ride_transitions.test.sql` utilise un vrai PostgreSQL dans le job CI (PostgreSQL 16, bootstrap local des rôles/auth); le journal GitHub montre application des migrations 001–011 et `OK 011_driver_ride_transitions`. Les scénarios couvrent appels sans identité, passager/autre chauffeur/non-assigné, transition illégale, mutation directe refusée, parcours valide, répétition idempotente, historique et libération. Limites : pas de migration 011 rejouée dans le test; pas de sessions concurrentes réelles; le cas « autre course active » ne prouve pas une contrainte serveur contre deux appels simultanés sur deux lignes distinctes; pas de vérification explicite `EXECUTE` sous `anon`, ni de lecture croisée RLS passager/chauffeur/Realtime. La conception du verrou par ligne paraît correcte pour la même course, mais la garantie d'acceptation concurrente inter-courses mérite un test multi-session avant recette Supabase isolée.

### Tests indépendants et environnement

Sur le worktree détaché au SHA Claude :

| Contrôle | Résultat |
|---|---|
| `npm ci` | exit 0; 198 paquets ajoutés |
| `npm run lint` | exit 0; avertissement existant `src/hooks/useAsyncData.js:25:5` (`react(set-state-in-effect`) |
| `npm test` | exit 0; 27 fichiers, 151 tests passés |
| `npm run build` | exit 0; 128 modules transformés |
| `git diff --check` | exit 0 |
| PostgreSQL local jetable | non exécuté : `pg_isready` sans serveur, Docker absent; `run-local.sh` échoue à la connexion localhost |
| PostgreSQL CI | exécuté sur Postgres 16 éphémère pour migration 011 et son SQL de test; limites listées ci-dessus |
| Navigateur | aucun E2E navigateur/appareil réel exécuté dans cette reprise; Preview ne constitue pas un test backend |

`npm audit --json` n'a pas pu joindre `registry.npmjs.org` (DNS `EAI_AGAIN`); aucun rapport d'advisories courant n'a donc été récupéré. Le rapport baseline conserve la déclaration initiale de 11 vulnérabilités (4 modérées, 7 hautes), mais leur liste détaillée et leur exploitabilité sur ce SHA restent **non vérifiées**. Les dépendances n'ont pas été mises à jour. En l'absence de sortie d'audit exploitable, il serait infondé de classer ces 11 éléments individuellement; la distinction dépendance de production / outil de développement n'est pas établie dans cette reprise.

La CI PR est verte, y compris le job de migration PostgreSQL; Preview deploy status est SUCCESS et l'URL observée est `https://deploy-preview-1--tagaapp.netlify.app`. Les builds CI/Preview emploient une configuration de démo (workflow `.github/workflows/pr-ci.yml`); ils ne prouvent pas qu'un backend Supabase est correctement activé, autorisé ou isolé.

### État final de la revue

La branche Claude n'a été ni modifiée ni fusionnée. Pas de migration distante, secret, environnement Supabase, Netlify, production, commit ou push touché. Aucun test supplémentaire n'a été ajouté. Dans le worktree indépendant `/tmp/indx-taga-g0-review`, seul le rapport QA est non commité (fichier non suivi à la baseline, complété ici) ; HEAD reste `e8c7bce71e185fbc8c3a20fcb85361a63819e051`. Les limites restantes sont le test multi-session/RLS complet, la récupération passager, le vrai flux de localisation et l'audit npm détaillé.

**Conclusion : NO-GO.** Les constats P1 de trajet, récapitulatif, finance et téléphone doivent être corrigés puis réaudités avant la recette isolée; ce verdict n'autorise en aucun cas migration distante, merge ou production.

## G0.3 — Revue indépendante finale des correctifs (2026-10-14)

### Références et verdict

SHA audité : `ae1cb0e6f72fa798672e1915bb82d6d038d58d66`, comparé uniquement au delta `27f166007ef844d225b9f5cd9116291284afcf15...ae1cb0e6f72fa798672e1915bb82d6d038d58d66` (43 fichiers, +1466/-156). Les références distantes vérifiées par `git ls-remote` sont `claude/taga-g0-integrite-parcours=ae1cb0e…` et `main=e8c7bce…`. La tête Claude correspond au SHA fourni; le worktree Codex QA reste sur sa branche dédiée et le worktree détaché de revue est propre au SHA Claude. Aucun fichier Claude n'a été modifié.

**NO-GO.** Les gains d'app, téléphone et faux tracés sont désormais correctement cadrés, mais un P1 sécurité/intégrité demeure : le client bloque la création d'une course sans points déclarés fiables, alors que le RPC accessible aux utilisateurs authentifiés accepte encore les coordonnées absentes et ne peut pas valider la provenance des points. L'estimation reste également exposée comme « prix » et peut apparaître comme montant final dans le récapitulatif.

### Matrice des six findings

| Finding précédent | Verdict correctif | Preuve et constat | Verdict QA |
|---|---|---|---|
| Adresses et réservation réelle | Partiellement corrigé | UI réelle explicitement désactivée (`src/screens/client/Home.jsx:51-57`, `src/screens/client/Estimate.jsx:15,27,31,110`) ; contrôles dans `ridePoints.js:14-30` et `rideService.js:27-30,62-65`. Mais `create_ride` reste callable par tout utilisateur authentifié et accepte coordonnées absentes (`supabase/migrations/002_rides.sql:148-159`); aucune provenance ne peut être validée puisque la provenance client est ôtée du payload (`ridePoints.js:33-35`). | **NO-GO P1** |
| Téléphone ivoirien et OTP | Corrigé | Résultats exacts couverts pour `07 07 12 34 56`, `+225 07 07 12 34 56`, `225…`, `00225…`, séparateurs et formats invalides (`src/services/phone.test.js:19-62`). `SupabaseAuthService.requestOtp` normalise puis passe précisément cette valeur à `signInWithOtp` (`src/services/authService.js:190-200`; test `authService.test.js:97-114`). | GO |
| Course terminée / reprise et isolation | Partiellement corrigé | URL porte l'ID, `getCompletedRide` exige session et statut completed, la RLS filtre les courses; écrans tests couvrent refresh direct, évènement manqué, accès interdit et erreurs (`src/services/rideRealtimeService.js:126-146`, `RideEnd.jsx:111-151`, tests ActiveRide/RideEnd). Une erreur initiale de `getActiveRide()` ou `getDriverLocation()` tombe dans le `catch` avant l'installation du listener `online` (`ActiveRide.jsx:149-210`); pas de relance réseau automatique dans cette situation. | **P2 résiduel** |
| Gains / finances réels | Partiellement corrigé | `getServerRidePricing(3250)` produit `driverEarning: null`, pas de commission frontend; test explicite (`src/services/rideFare.js:31-45`, `rideFare.test.js:35-48`). Cependant il affecte encore `price=estimated_price`; `RideEnd.jsx:168-173` appelle cela « Montant de la course », et le récapitulatif passager affiche tout prix numérique. | **P1 résiduel** si `estimated_price` est renseigné |
| Disponibilité persistée | Partiellement corrigé | Lecture serveur avant toute bascule, états loading/unknown, refus d'écriture durant chargement/on_ride, erreur récupérable par action manuelle; tests pour offline/available/on_ride, panne et doubles clics (`Online.jsx:35-42,84-106`; `Online.test.jsx:44-152`). Pas de resynchronisation automatique `online` ni abonnement aux changements concurrents de `driver_profiles`; après première lecture, un changement externe peut laisser l'UI périmée jusqu'à nouvelle lecture/navigation. La RPC serveur verrouille la ligne et reste autoritaire (`003_dispatch.sql:128-185`). | P2 résiduel |
| Faux trajet / cartes en mode réel | Corrigé fonctionnellement | Home annonce la commande indisponible; marqueurs/tracés `ClientRideMap` et `DriverRideMap` ne se rendent pas en mode réel; `MapView` étiquette le fond décoratif (« aucun trajet réel »). Le tracé statique restant sur Home est explicitement décoratif (`Home.jsx:20-39`, `MapView.jsx:52-56`). | GO, risque visuel faible |

### Finding P1 — RPC de création insuffisamment protégé contre des points invalides/non fiables

La désactivation de la commande est explicite et compréhensible côté UI : aucun point fiable n'est actuellement fourni par un sélecteur réel, `REAL_RIDE` commence avec `pickup` et `destination` à null; le bouton reste désactivé, et `handleOrder` retourne avant d'appeler `createRide`. Le service frontend rejette aussi les points incomplets, coordonnées hors plage, libellés seuls et `source` inconnu. Les tests `RealMode.test.jsx` vérifient que `createRide` n'est pas appelé pour ces entrées.

Cette barrière n'est pas imposée par le backend. Reproduction PostgreSQL/PostgREST attendue : comme utilisateur `authenticated` avec rôle passager actif, appeler `rpc/create_ride` avec `p_pickup={"label":"lieu fictif"}` et `p_destination={"label":"autre lieu fictif"}`. Dans `supabase/migrations/002_rides.sql:148-159`, les valeurs lat/lng nulles échappent au contrôle (« if coord is not null… »), puis la course est insérée. Des coordonnées plausibles mais inventées passent également; une propriété JSON `source` ne serait qu'une déclaration cliente, pas une provenance vérifiée. La fonction a `EXECUTE` accordé au rôle authenticated (`195-196`).

Impact : un client authentifié peut contourner l'UI et créer une demande de course sans coordonnées/provenance; celle-ci peut ensuite entrer dans le workflow de dispatch. Correction minimale : garder la création réelle impossible jusqu'à une source d'adresse contrôlée côté serveur, ou faire valider côté RPC que les deux points ont des coordonnées non-nulles/dans les bornes et une attestation/provenance que le serveur peut réellement contrôler; ne pas présenter un champ `source` libre fourni par l'app comme une preuve. Ajouter un test SQL `expect_error` pour coordonnées absentes, partielles, nulles et hors plages. Ce test direct n'a pas été exécuté localement faute de PostgreSQL.

### Course terminée et disponibilité — limites de resynchronisation

La reprise via refresh fonctionne par identifiant stocké dans `sessionStorage`, mais ce pointeur n'est qu'un identifiant non sensible : le récapitulatif est relu du backend, limité au statut `completed`, et `passenger_id` est vérifié en plus de RLS (`rideSession.js:1-74`, `rideRealtimeService.js:126-146`). Le lien direct exige un ID et le rôle passager via `App.jsx:36-43`; un ID d'un autre compte est filtré par RLS/absence de ligne. Les tests unitaires simulent le filtrage; cela ne constitue pas un test PostgREST/JWT en direct.

Dans `ActiveRide`, l'écoute `online` est créée seulement après lecture initiale de la course ET de la position chauffeur (`149-190`). Si la page est ouverte sans réseau, `getActiveRide` échoue et seul un message d'erreur avec retour accueil est affiché; le retour réseau ne relance pas la requête. Si la lecture initiale de la course réussit mais la position échoue, la souscription et le listener restent aussi absents. La correction minimale est d'enregistrer le listener de reconnexion avant les requêtes et de rejouer la restauration en cas d'erreur transitoire, avec garde contre les appels concurrents.

Pour `Online`, les valeurs offline/available/on_ride viennent bien du serveur et aucun état initial faux n'est affiché. Mais la lecture échouée nécessite le bouton « Relire ma disponibilité »; le changement par un autre appareil après le chargement n'est pas écouté. La règle SQL, et non le store, conserve l'autorité et protège le passage hors ligne pendant une course; il reste un écart d'affichage P2 et non une preuve de bascule serveur non autorisée.

### Gains et prix

Testé explicitement : `getServerRidePricing(3250)` vaut `{ estimatedPrice: 3250, price: 3250, driverEarning: null }`; les cartes chauffeur affichent « Gain non disponible » si le montant serveur est absent (`IncomingRequest.jsx:231-236`), sans « Net 85 % » en réel. C'est conforme pour le gain chauffeur.

Limite : l'alias `price` persiste dans la fonction de normalisation. Si la base contient un `estimated_price`, `RideEnd` affiche le même nombre comme « Montant de la course », sans statut d'estimation. À la réception, « Course total » est présenté sans libellé « estimé ». Comme le schéma expose seulement `estimated_price` et pas un montant final/réglé, ces rendus ne prouvent aucun prix arrêté/paiement. Correction minimale : maintenir `price: null` en réel tant qu'un champ final serveur distinct n'existe pas, et étiqueter visiblement `estimatedPrice` comme estimation partout.

### Migration 011 et scénarios multi-sessions S1–S5

La migration 011 n'a pas changé depuis `27f1660`. Sa revue de sécurité et le test séquentiel SQL de G0.2 restent valides. Le nouveau `011_concurrency.test.sh` lance de véritables processus `psql` distincts; S1–S3 et S5 mesurent la durée écoulée et exigent au moins 1 000 ms tandis que la session A garde les verrous 2 s (`supabase/tests/011_concurrency.test.sh:12-13,68-80,86-120,131-147`). Les logs du job CI PostgreSQL montrent S1, S2, S3, S4, S5 puis `OK 011_concurrency`; ce ne sont pas de simples assertions regex.

S1 confirme que les courses concurrentes sur la même transition attendent, deviennent idempotentes et n'ajoutent qu'une ligne d'historique. S2 confirme l'ordre sérialisé arrivé puis in_progress. S3 confirme qu'une cible concurrente illégale renvoie `ERR:55000` après attente et ne mute ni statut ni historique. S4 vérifie le refus d'un autre chauffeur (`ERR:42501`) pendant qu'un verrou est tenu, sans prétendre que ce refus doit attendre. S5 établit l'ordre fin de course / `set_driver_availability(false)` : B attend le verrou profil et termine offline après la libération serveur. Les wrappers SQL attrapent les erreurs pour comparer le SQLSTATE attendu; les autres erreurs de psql ne sont pas silencieusement acceptées grâce à `ON_ERROR_STOP`, et chaque résultat/statut/historique est asserté. Le test dépend toutefois de `sleep 0.5` comme synchronisation et ne comporte pas de `timeout` explicite; il est donc bon comme signal de concurrence reproductible en CI mais pas comme preuve exhaustive de tous les entrelacements.

Le test SQL mis à jour vérifie rôle `anon` refusé et visibilité RLS de courses/profils entre passagers et chauffeurs (`011_driver_ride_transitions.test.sql:81-119,154-166`). `set_driver_availability(true)` pendant une course est protégé côté SQL : il verrouille le profil puis refuse si l'état/validation véhicule/driver l'interdit (`003_dispatch.sql:128-185`); S5 teste spécifiquement `false`, et non `true` pendant une course. Le test de réexécution de 011 n'est pas présent. La définition 011 est statiquement rejouable (`CREATE OR REPLACE FUNCTION`, REVOKE, GRANT), mais son réapplication n'a pas été exécutée.

La CI PostgreSQL utilise une base jetable avec bootstrap minimal, migrations 001–011, tests SQL et sessions concurrentes. Aucun serveur/PostgreSQL local n'écoute dans ce worktree (`pg_isready`: no response; Docker absent), donc les migrations n'ont pas été rejouées localement. Cela ne valide pas PostgREST, JWT réel Supabase, policies effectives dans le projet, ni Realtime multi-utilisateurs.

### Tests et vulnérabilités

Exécutés sur `ae1cb0e6f72fa798672e1915bb82d6d038d58d66` :

| Contrôle | Résultat |
|---|---|
| `npm ci` | exit 0; 198 paquets ajoutés |
| `npm run lint` | exit 0; avertissement `src/hooks/useAsyncData.js:25:5` (`react(set-state-in-effect`) |
| `npm test` | exit 0; 31 fichiers et 248 tests passés |
| `npm run build` | exit 0; 131 modules transformés |
| `git diff --check 27f1660...HEAD` | exit 0 |
| Job CI « Migrations SQL (base jetable) » | pass; log confirme `OK 011_driver_ride_transitions` et `OK 011_concurrency` |
| PostgreSQL local | non exécuté; aucun daemon et Docker absent |
| `npm audit` et `npm audit --omit=dev` | non concluants; DNS `EAI_AGAIN registry.npmjs.org`; aucune mise à jour appliquée |

Le nombre initial de 11 vulnérabilités (4 modérées, 7 hautes) n'a pas pu être revalidé ni ventilé par dépendance/runtime. Pas d'avis exploitable reçu du registre; ne pas conclure qu'elles ont disparu ou qu'elles sont exploitables sur la seule baseline historique.

La Preview PR est marquée prête (`https://deploy-preview-1--tagaapp.netlify.app`), mais la CI de build est distincte du backend et ne valide pas une connexion aux services Supabase réels.

### État durable et limites

Le rapport baseline et la section G0.2 ci-dessus sont conservés. La présente section G0.3 est le seul ajout QA; aucun test ou fichier métier n'a été changé sur la branche Codex, et aucun commit/push/merge, secret, environnement Supabase, migration distante, configuration Netlify ou production n'a été touché. Le worktree de revue détaché est propre au SHA `ae1cb0e…`; le worktree QA garde sa branche `codex/taga-g0-revue-test` avec uniquement ce rapport modifié/non suivi avant livraison.

**Conclusion : NO-GO.** Le RPC accepte actuellement une création authentifiée sans coordonnées et sans preuve de provenance malgré la barrière UI. L'estimation reste également susceptible d'être présentée comme prix final. GO ne peut être accordé qu'après correction et réexécution des tests ciblés; aucune migration distante, merge ou production n'est autorisée par cette revue.
