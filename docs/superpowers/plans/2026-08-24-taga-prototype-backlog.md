# TAGA Prototype — Backlog de dispatch (Claude Code / Codex / Copilot)

Source : `docs/superpowers/plans/2026-08-24-taga-prototype-screens.md` (21 tâches, code complet). Ce backlog répartit ces mêmes tâches en 3 lots pour exécution par 3 agents IA différents, sans dupliquer le code — chaque ticket référence le numéro de tâche exact à ouvrir dans le plan.

## État d'avancement — 24 août 2026 (mise à jour finale)

**Les 4 lots sont terminés.** Le dispatch multi-agent (Codex/Copilot) n'a finalement pas eu lieu — Claude Code a implémenté l'intégralité du prototype en local dans cette session, push GitLab bloqué (voir plus bas).

- **Lot 1 — Fondations** : ✅ terminé — routing, store et composants partagés.
- **Lot 2 — Parcours Client** : ✅ terminé — composants client et écrans `Home`, `Estimate`, `ActiveRide`, `RideEnd`.
- **Lot 3 — Parcours Chauffeur** : ✅ terminé — écrans `Online`, `IncomingRequest`, `Navigation`, `RideInProgress`, `PayoutRecap`.
- **Lot 4 — Navigation et écrans transverses** : ✅ terminé — voir détail des tickets N1–N5 plus bas.

**Portée finale : 16 écrans** (les 11 du spec UX initial + `Splash`, `Otp`, `Profile`, `RideHistory`, `PaymentMethods`, ajoutés en Lot 4 pour couvrir les écrans communs du spec FlutterFlow v4, hors scope du plan React d'origine mais demandés en cours de route).

**Routing final** :
```
/               Splash (redirige selon rôle mocké : /role-choice, /client/home ou /driver/online)
/role-choice    Choix de rôle (hybride A+B)
/onboarding     Numéro de téléphone
/otp            Vérification OTP (nouveau relais avant Home/Online)
/profile        Profil (commun, sections conditionnelles par rôle)
/ride-history   Historique des courses (commun, role-aware)
/payment-methods Moyens de paiement / retrait (commun)
/client/*       Home, Estimate, ActiveRide, RideEnd
/driver/*       Online, IncomingRequest, Navigation, RideInProgress, PayoutRecap
```

**Validation** : `npm run build` et `npm run lint` passent sur l'état final. Vérification visuelle complète via Playwright headless (13 écrans capturés au total sur les deux sessions de QA, 0 erreur console). Aucun push effectué — bloqué sur l'authentification GitLab (`HTTP Basic: Access denied` sur `origin`, pas de PAT ni de credential helper configuré pour ce repo, askpass interactif non fonctionnel dans ce sandbox WSL). 15+ commits locaux en attente sur `main`, en avance sur `origin/main`.

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

**État** : ✅ implémenté et validé par build/lint. Push non effectué (auth GitLab bloquée) — n'a donc pas pu débloquer un vrai dispatch vers Codex/Copilot ; Claude Code a enchaîné directement sur les lots suivants en local.

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

**État** : ✅ implémenté et validé par build/lint + vérification visuelle Playwright (Home, Estimate capturés sans erreur console).

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

**État** : ✅ implémenté et validé par build/lint. Le correctif de mise en page de `Online` place désormais la carte en arrière-plan et le panneau d'informations au premier plan.

---

## Lot 4 — Navigation et écrans transverses

| # | Ticket | État | Livrable |
|---|---|---|---|
| N1 | Barre de navigation principale | ✅ | `src/components/BottomNavBar.jsx`, utilisée sur les écrans client et transverses |
| N2 | Navigation chauffeur | ✅ | Boutons `Travail`, `Gains`, `Courses`, `Profil` dans `src/screens/driver/Online.jsx` |
| N3 | Écrans Profil, Historique, Paiements | ✅ | `src/screens/Profile.jsx`, `src/screens/RideHistory.jsx`, `src/screens/PaymentMethods.jsx` |
| N4 | Splash et vérification OTP | ✅ | `src/screens/Splash.jsx`, `src/screens/Otp.jsx` |
| N5 | Harmoniser la barre chauffeur avec le composant partagé | ✅ (décision : garder la nav locale) | La nav de `Online` reste stylée localement (bandeau navy) plutôt que `BottomNavBar` (fond blanc) — mieux intégrée visuellement au bottom sheet sombre de l'écran. Rendue fonctionnelle (onglets Gains/Courses/Profil menaient nulle part avant, désormais routés + état actif via `useLocation`). |

**Definition of Done du lot** : chaque bouton ouvre la route attendue, l'onglet actif est identifiable, les écrans transverses restent accessibles depuis Client et Chauffeur, et `npm run build && npm run lint` passent.

---

## Risque de collision : `src/App.jsx`

**Sans objet finalement** — le dispatch multi-agent n'a pas eu lieu (push GitLab bloqué avant que Codex/Copilot puissent démarrer, voir État d'avancement). Claude Code a implémenté tous les lots séquentiellement dans la même session, donc aucun conflit de merge réel sur `App.jsx`. La section ci-dessous reste comme référence si un vrai dispatch multi-agent est retenté plus tard (une fois le push débloqué).

- Chaque agent commite `App.jsx` séparément à chaque ticket (pas de gros commit final groupé) → conflits plus petits, plus faciles à résoudre.
- Alternative plus sûre si les agents tournent vraiment en parallèle sur des branches : donner à Codex et Copilot deux branches (`feat/client-screens`, `feat/driver-screens`) parties du même commit de fin de Lot 1, et rebaser/merger séquentiellement à la fin plutôt qu'en continu.

## Vérification finale — effectuée

```bash
npm run build && npm run lint
```
Les deux passent sur l'état final (16 écrans). Flows complets rejoués dans une seule session `npm run dev` (Playwright headless) sans recharger la page entre passager et chauffeur — le store partagé ne mélange pas les deux rôles. 0 erreur console sur l'ensemble des écrans capturés.

## Suite possible

- **QA onboarding/OTP** : [rapport QA](../../qa/2026-08-24-taga-passenger-onboarding-otp.md) — simulation locale validée, SMS réel non branché.
- **Plan SMS réel** : [plan d’implémentation](./2026-08-24-taga-passenger-sms-implementation-plan.md) — Supabase Auth, fournisseur SMS, routage dev serveur et critères d’acceptation.
- **Répartition des responsabilités** : [tableau comparatif](./2026-08-24-taga-responsabilites-implementation.md) — responsables, livrables, fichiers, dépendances et ordre d’exécution.
- **Débloquer le push** : fournir un PAT GitLab (scope `write_repository`) ou pousser manuellement depuis un poste avec credential manager fonctionnel — condition pour sauvegarder le travail sur `origin/main` et pour qu’un vrai dispatch multi-agent redevienne possible sur un futur lot.
- **Polish visuel** : remplacer les emojis par des icônes SVG (les emojis s'affichent en tofu dans certains environnements headless/Linux sans police couleur — déjà corrigé pour le drapeau 🇨🇮 sur l'écran Onboarding, pas encore fait pour le reste).
- **Phase suivante** : portage vers FlutterFlow + Supabase à partir de ce prototype validé, en s'appuyant sur `2026-08-24-taga-flutterflow-screens.md` (v4) et `2026-08-24-taga-supabase-schema.md` (v4) — hors dépôt distant (`docs/superpowers/specs/` volontairement non poussé, voir `.gitignore`).
