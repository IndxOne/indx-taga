# TAGA Prototype — Rapport QA (2026-08-24)

Périmètre : les 16 écrans du prototype React (`/home/adminkon/projets/taga-prototype`),
état du repo au moment du test (3 fichiers en cours d'édition par une session
Codex CLI concurrente : `useAppStore.js`, `Onboarding.jsx`, `Otp.jsx` — non
commités, ajout de la persistance du numéro de téléphone entre les deux
écrans).

## Méthode

- `npm run build` + `npm run lint` sur l'état courant du repo.
- Navigation automatisée (Playwright headless, viewport 500×850) sur les 16
  routes, avec capture d'écran, écoute des erreurs console/page, et
  interception des réponses HTTP ≥ 400.

## Résultats

| Vérification | Résultat |
|---|---|
| `npm run build` | ✅ 57 modules transformés, aucune erreur |
| `npm run lint` (oxlint) | ✅ aucune erreur |
| Erreurs console/JS sur les 16 routes | ✅ 0 |
| Réponses HTTP ≥ 400 sur les 16 routes | ✅ 0 |
| Rendu visuel des 16 écrans | ✅ conforme aux maquettes, voir détail ci-dessous |

### Écrans vérifiés (16/16)

Communs : Splash, Choix de rôle, Onboarding, OTP, Profil, Historique,
Moyens de paiement.
Client : Accueil, Estimation, Course active, Fin de course.
Chauffeur : En ligne, Demande entrante, Navigation, Course en cours, Récap
& retrait.

Tous rendus sans erreur, navigation bas fonctionnelle et onglet actif
correctement surligné sur les écrans qui l'utilisent (Accueil, Profil,
Historique, Paiements, En ligne).

## Écarts constatés

### 1. Fin de course — tags de feedback rapide manquants (mineur)

`src/screens/client/RideEnd.jsx` n'implémente pas les tags de feedback
rapide (`Conduite`, `À l'heure`, `Voiture propre`) présents dans la
maquette (`docs/mockups/prototype client/5. Fin de course.png`) et
mentionnés dans le spec écrans (`Chip` multi-sélection). L'écran actuel
n'a que les étoiles de notation.

**Impact** : fonctionnel (la notation marche), mais moins riche que prévu.
**Sévérité** : basse.

### 2. Rendu des emojis dans certains environnements (cosmétique, déjà en partie traité)

Les icônes emoji (🚕, 🏠, 🚗, 🧾, etc., utilisées dans `RoleCard`,
`RideOptionCard`, les favoris de l'écran Accueil, etc.) s'affichent en
tofu (case vide) dans ce conteneur headless sans police couleur. Le cas du
drapeau 🇨🇮 avait déjà été corrigé sur `PhoneInput` (remplacé par un badge
texte "CI") car Windows ne rend pas non plus les drapeaux emoji. Les
autres emojis (pictogrammes standards) s'affichent normalement sur
Windows/macOS/mobile via leurs polices couleur natives — ce n'est donc
**pas un bug réel** pour les utilisateurs finaux, seulement un artefact de
ce bac à sable de test. Noté pour référence si une bibliothèque d'icônes
SVG est souhaitée pour une identité visuelle plus contrôlée.

**Impact** : aucun sur les plateformes cibles réelles.
**Sévérité** : cosmétique, non bloquant.

## Aucun bug fonctionnel trouvé

Aucune régression, aucun crash, aucune route cassée, aucune incohérence de
store repérée sur l'état actuel du repo (y compris les modifications en
cours de Codex sur la persistance du téléphone, qui compilent et
s'affichent correctement).

## Points hors scope de cette QA

- Le blocage du push GitLab (authentification) — confirmé indépendamment
  par la session Claude Code et la session Codex, documenté dans le
  backlog, pas un problème de code.
- La cohabitation Claude Code / Codex sur le même repo sans répartition de
  fichiers formelle (le dispatch en 3 lots prévu initialement n'a pas eu
  lieu tel quel) — organisationnel, pas un défaut du prototype lui-même.
