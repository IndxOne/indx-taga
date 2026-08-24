# TAGA Prototype — Backlog de dispatch (Claude Code / Codex / Copilot)

Source : `docs/superpowers/plans/2026-08-24-taga-prototype-screens.md` (21 tâches, code complet). Ce backlog répartit ces mêmes tâches en 3 lots pour exécution par 3 agents IA différents, sans dupliquer le code — chaque ticket référence le numéro de tâche exact à ouvrir dans le plan.

## Règle d'ordre

**Le lot Fondations doit être terminé et pushé avant que les deux autres lots démarrent.** Les lots Client et Chauffeur peuvent ensuite tourner en parallèle — ils ne se touchent pas (fichiers disjoints : `src/screens/client/*` vs `src/screens/driver/*`), mais tous deux dépendent des composants et du routing posés par les Fondations.

```
Fondations (CC)
   │
   ├──► Client (Codex)
   └──► Chauffeur (Copilot)
```

Chaque ticket = une tâche du plan, exécutée telle quelle (steps, code, commit inclus). Ne pas réinventer le contenu : ouvrir le plan à la tâche indiquée et suivre les steps.

---

## Lot 1 — Fondations (Claude Code)

**Pourquoi Claude Code** : ce lot pose les contrats (forme du store, props des composants partagés) que les deux autres agents vont consommer sans les avoir écrits eux-mêmes — autant que l'agent qui a écrit le plan les implémente, pour éviter tout écart d'interprétation sur les noms de champs/props.

**Bloque** : tous les tickets des lots 2 et 3 (import de `useAppStore`, `PrimaryButton`, `AmountTile`, `MapView`, `RoleCard`, `PhoneInput`).

| # | Ticket | Tâche du plan | Livrable |
|---|---|---|---|
| F1 | Store Zustand mocké | Task 1 | `src/store/useAppStore.js` |
| F2 | Layout `PhoneFrame` + squelette de routing | Task 2 | `src/components/PhoneFrame.jsx`, `src/App.jsx` (routes stub) |
| F3 | Composant `PrimaryButton` | Task 3 | `src/components/PrimaryButton.jsx` |
| F4 | Composant `AmountTile` | Task 4 | `src/components/AmountTile.jsx` |
| F5 | Composant `MapView` | Task 8 | `src/components/MapView.jsx` |
| F6 | Composant `RoleCard` | Task 6 | `src/components/RoleCard.jsx` |
| F7 | Composant `PhoneInput` | Task 7 | `src/components/PhoneInput.jsx` |
| F8 | Écran `RoleChoice` | Task 11 | `src/screens/RoleChoice.jsx` + route `/` câblée |
| F9 | Écran `Onboarding` | Task 12 | `src/screens/Onboarding.jsx` + route `/onboarding` câblée |

**Definition of Done du lot** : `npm run build && npm run lint` passent, `/` et `/onboarding` fonctionnels en vrai (plus stub), les deux routes suivantes (`/client/home`, `/driver/online`) restent en stub — c'est normal, elles seront livrées par les lots 2/3. Push sur la branche partagée avant de notifier les deux autres agents.

---

## Lot 2 — Parcours Client (Codex)

**Fichiers touchés** : `src/screens/client/*`, plus 3 composants dédiés au client. Aucun chevauchement avec le lot Chauffeur.

**Dépend de** : Lot 1 poussé (import `useAppStore`, `PrimaryButton`, `AmountTile`, `MapView`).

| # | Ticket | Tâche du plan | Livrable |
|---|---|---|---|
| C1 | Composant `RatingStars` | Task 5 | `src/components/RatingStars.jsx` |
| C2 | Composant `RideOptionCard` | Task 9 | `src/components/RideOptionCard.jsx` |
| C3 | Composant `DriverInfoCard` | Task 10 | `src/components/DriverInfoCard.jsx` (affiché côté client sur l'écran Course active) |
| C4 | Écran `Home` (Accueil) | Task 13 | `src/screens/client/Home.jsx` + route |
| C5 | Écran `Estimate` (Estimation) | Task 14 | `src/screens/client/Estimate.jsx` + route |
| C6 | Écran `ActiveRide` (Course active) | Task 15 | `src/screens/client/ActiveRide.jsx` + route |
| C7 | Écran `RideEnd` (Fin de course) | Task 16 | `src/screens/client/RideEnd.jsx` + route |

**Ordre interne** : C1–C3 (composants) avant C4–C7 (écrans qui les consomment) ; C4→C5→C6→C7 dans cet ordre car chaque écran navigue vers le suivant (utile pour le test manuel du flow).

**Definition of Done du lot** : `npm run build && npm run lint` passent ; flow complet jouable manuellement `/` → passager → `/onboarding` → `/client/home` → `/client/estimate` → `/client/active-ride` (3× "Simuler arrivée") → `/client/ride-end` → retour `/client/home`.

---

## Lot 3 — Parcours Chauffeur (Copilot)

**Fichiers touchés** : `src/screens/driver/*` uniquement. Aucun nouveau composant partagé requis (tout est déjà fourni par le Lot 1).

**Dépend de** : Lot 1 poussé (import `useAppStore`, `PrimaryButton`, `AmountTile`, `MapView`).

| # | Ticket | Tâche du plan | Livrable |
|---|---|---|---|
| D1 | Écran `Online` (En ligne) | Task 17 | `src/screens/driver/Online.jsx` + route |
| D2 | Écran `IncomingRequest` (Demande entrante) | Task 18 | `src/screens/driver/IncomingRequest.jsx` + route |
| D3 | Écran `Navigation` | Task 19 | `src/screens/driver/Navigation.jsx` + route |
| D4 | Écran `RideInProgress` (Course en cours) | Task 20 | `src/screens/driver/RideInProgress.jsx` + route |
| D5 | Écran `PayoutRecap` (Récap & retrait) | Task 21 | `src/screens/driver/PayoutRecap.jsx` + route ; **dernier ticket du repo** : supprimer le composant `Stub` désormais inutilisé de `App.jsx` (cf. Task 21, Step 2) |

**Ordre interne** : D1→D2→D3→D4→D5, chaque écran navigue vers le suivant.

**Definition of Done du lot** : `npm run build && npm run lint` passent ; flow complet jouable manuellement `/` → chauffeur → `/onboarding` → `/driver/online` (toggle dispo → Simuler) → `/driver/incoming-request` (Accepter) → `/driver/navigation` (2 clics) → `/driver/ride-in-progress` (Terminer) → `/driver/payout-recap` → "Reprendre en ligne" → retour `/driver/online`. Solde du portefeuille augmenté de 2 720 F par rapport à sa valeur initiale (25 120 → 27 840).

---

## Risque de collision : `src/App.jsx`

**Seul fichier partagé entre les 3 lots.** Chaque ticket d'écran y ajoute un import + remplace une ligne de route stub par le vrai composant. Pour éviter les conflits de merge entre Codex et Copilot qui travaillent en parallèle sur le même fichier :

- Chaque agent commite `App.jsx` séparément à chaque ticket (pas de gros commit final groupé) → conflits plus petits, plus faciles à résoudre.
- Alternative plus sûre si les agents tournent vraiment en parallèle sur des branches : donner à Codex et Copilot deux branches (`feat/client-screens`, `feat/driver-screens`) parties du même commit de fin de Lot 1, et rebaser/merger séquentiellement à la fin plutôt qu'en continu.

## Vérification finale (après les 3 lots)

Une fois les lots 2 et 3 mergés :
```bash
npm run build && npm run lint
```
Puis rejouer les deux flows complets (Definition of Done de chaque lot) dans une seule session `npm run dev`, sans recharger la page entre les deux, pour vérifier que le store partagé ne mélange pas les deux rôles.
