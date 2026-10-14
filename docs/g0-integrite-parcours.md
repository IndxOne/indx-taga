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

## Tests
- `npm test` — unitaires/écrans (Vitest).
- `supabase/tests/run-local.sh` — rejoue les migrations 001→011 et `supabase/tests/*.test.sql` sur une **base PostgreSQL jetable** (jamais Supabase distant).
