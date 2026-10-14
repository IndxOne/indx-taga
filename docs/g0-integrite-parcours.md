# G0 — Intégrité du parcours réel

Parcours cible : passager → chauffeur → course terminée, états décidés par le serveur.

## Modes
- **Démo** (`VITE_DEMO_MODE=true`) : données fictives conservées, bandeau « Mode démonstration · données fictives ».
- **Réel** (`VITE_DEMO_MODE=false` + variables Supabase) : aucun paiement, retrait, gain, prix de repli, ETA ni appel d'assistance simulé. Un montant inconnu s'affiche « — » ou « Montant à confirmer ».
- Le numéro de test passager n'est substitué qu'en démo **et** en développement local (`usesTestPassengerPhone`).

## Transitions chauffeur (migration 011, non appliquée)
RPC `advance_driver_ride(p_ride_id, p_to_status)` :
`assigned → arriving → arrived → in_progress → completed`, strictement séquentiel.

| Garde | Comportement |
|---|---|
| Session absente | `28000` |
| Pas chauffeur actif / pas le chauffeur affecté | `42501` |
| Cible hors chaîne (`cancelled`, `assigned`…) | `22023` |
| Transition illégale (saut, retour arrière, après `completed`) | `55000` |
| Même statut rejoué | renvoie la course, aucune écriture (idempotent) |
| Concurrence | `select … for update` sur la course : les appels sont sérialisés |
| Historique | `ride_status_history` écrit dans la même transaction |
| Fin de course | chauffeur `on_ride → offline` s'il n'a aucune autre course active |

Le client n'a toujours aucun `GRANT UPDATE` sur `rides`.

## Côté React
- `dispatchService.advanceRide` → RPC ; `rideRealtimeService.getActiveDriverRide` → reprise après rechargement (RLS `rides_select_assigned_driver`).
- `useDriverRide` relit toujours le serveur au montage et ne met dans Zustand que la réponse serveur.

## G0.1 — correctifs de la revue indépendante
| # | Contrat |
|---|---|
| P1.1 | Mode réel : `ride.pickup` / `ride.destination` démarrent à `null`, libellés vides. `ridePoints.js` n'accepte qu'un point avec libellé, latitude **et** longitude valides, hors (0,0), et provenance dans `TRUSTED_POINT_SOURCES` (`device_gps`, `address_selection`). `SupabaseRideService.createRide` refuse tout autre point **avant** la RPC. Aucun sélecteur d'adresse n'existe : la commande réelle est désactivée et expliquée (Home, Estimate). `ClientRideMap`/`DriverRideMap` ne dessinent ni tracé ni marqueurs en réel. La provenance est une garantie client que le backend ne peut pas vérifier. |
| P1.2 | `normalizePhone` : `+225` + 10 chiffres nationaux (zéro conservé) ; `07 07 12 34 56`, `+225 07 07 12 34 56`, `00225…` → `+2250707123456`. Tout le reste → `''` (le service réel refuse avant d'appeler Supabase : aucun SMS). Substitution du numéro de test : démo ET développement local uniquement. |
| P1.3 | `rideRealtimeService.getCompletedRide(id)` (statut `completed`, session requise, `passenger_id` = utilisateur) distinct de `getActiveRide`. Route `/client/ride-end/:rideId`. `rideSession.js` garde l'id suivi et les récapitulatifs clôturés (sessionStorage, repli mémoire). `ActiveRide` rattrape une fin manquée (rechargement, reconnexion `online`, canal en erreur). `RideEnd` : chargement / introuvable / interdit / erreur réseau (+ réessai) ; clôture explicite = plus jamais rouvert. |
| P1.4 | `getServerRidePricing` ne calcule plus de gain : `driverEarning` reste `null` en mode réel (« Gain non disponible »). Le calcul à 85 % n'existe que pour la démo (`getRidePricing`). |
| P2 | `dispatchService.getDriverAvailability()` (RLS : profil propre). `Online` affiche « SYNCHRONISATION… » tant que le serveur n'a pas répondu, distingue hors ligne / en ligne / en course, bloque les bascules concurrentes (ref) et reste en « ÉTAT INCONNU » si la lecture échoue. Après clôture, le chauffeur revient `offline` (choix G0). |

## G0.4 — création de course et montants
**Création** : migration `012_create_ride_lockdown.sql` (non appliquée) — validation serveur stricte des coordonnées et révocation d'`EXECUTE` sur `create_ride` aux clients. Détails, limites et réactivation : [`backend-rides.md`](./backend-rides.md#verrouillage-de-create_ride-012). La provenance d'une adresse n'est pas prouvable par le client ; seule la désactivation garantit qu'aucune commande réelle n'est créée.

**Montants** — quatre notions distinctes, jamais déduites l'une de l'autre :

| Champ | Source | Valeur actuelle en réel |
|---|---|---|
| `estimatedPrice` | `rides.estimated_price` (estimation serveur) | nombre fini ≥ 0 si fourni, sinon `null` |
| `finalPrice` | backend métier autoritatif (inexistant) | toujours `null` |
| `driverEarning` | backend autoritatif (inexistant) | toujours `null` |
| `paymentStatus` | preuve de transaction serveur (inexistante) | toujours `null` |

Le champ historique `price` n'existe plus en mode réel (il restait une copie de l'estimation). Interface réelle : « Estimation indicative » quand elle existe, « Montant final non disponible », « Paiement : statut non disponible », « Gain non disponible ». Jamais « Payé », « Total payé » ni un débit. Démo : calculs et libellés fictifs conservés. Aucune migration financière.

## Tests
- `npm test` — unitaires/écrans (Vitest).
- `supabase/tests/run-local.sh` — rejoue les migrations 001→011, puis `*.test.sql` et `*.test.sh`, sur une **base PostgreSQL jetable** (jamais Supabase distant) :
  - `011_driver_ride_transitions.test.sql` : tests séquentiels (autorisations, transitions illégales, idempotence séquentielle, historique, libération, isolation de lecture type RLS).
  - `011_concurrency.test.sh` : vraie concurrence (plusieurs sessions `psql`, la session A garde le verrou ; les autres doivent attendre). Retirer `for update` de la RPC le fait échouer (S1).
  - `012_create_ride_lockdown.test.sql` : ACL (public/anon/authenticated sans EXECUTE), appels directs refusés sans course ni historique, validation exhaustive des points (corps appelé par le propriétaire), rôles, réexécution de 012, réactivation simulée puis annulée.
  - `staging_seed.test.sh` : le dispositif de recette isolé fonctionne pour le propriétaire, refuse sans confirmation, n'expose rien aux clients, et la course injectée suit les transitions 011.
- **Non couvert ici (staging requis)** : RLS réelle via PostgREST, JWT Supabase, Realtime, droits `authenticated` sur un vrai projet.
