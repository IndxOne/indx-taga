# TAGA — Prototype interactif (design)

Date : 2026-08-24
Statut : approuvé par l'utilisateur, en attente de plan d'implémentation.

## Contexte

TAGA est une app VTC/covoiturage pour Abidjan, à deux faces (passager / chauffeur),
paiement mobile money (Orange Money, Wave). Des maquettes statiques (captures PNG)
existent déjà dans `docs/mockups/` (copiées depuis `indxone-taga/assets/`) :

- Écran de choix de rôle (3 variantes A/B/C proposées)
- Parcours client, 5 écrans : Onboarding → Accueil → Estimation → Course active → Fin de course
- Parcours chauffeur, 5 écrans : En ligne → Demande entrante → Navigation → Course en cours → Récap & retrait

La cible produit finale sera construite dans FlutterFlow (backend Supabase), mais
avant ce portage, l'utilisateur veut un **prototype fonctionnel et cliquable**
pour valider les interactions et parcours en conditions réelles, et pouvoir le
reprendre en conversation Claude (via un Artifact) pour être guidé écran par écran.

## Décision — écran de choix de rôle

Hybride retenu entre les variantes A et B des maquettes :
- **Structure visuelle de A** : fond navy plein écran, deux cartes passager/chauffeur
  côte à côte (variante la plus mémorable).
- **Contenu de B** : bénéfice chiffré affiché sur la carte chauffeur
  (« 85% net · Retrait instantané » au lieu d'un sous-texte générique).

Raison : l'utilisateur priorise à la fois le recrutement rapide de chauffeurs
(marketplace à deux faces, le goulot est côté offre) et l'impact visuel à
la première ouverture. Aucune variante seule ne couvrait les deux.
Variante C (éditorial Abidjan / skyline) écartée pour ce lancement, à garder
en tête si l'angle marketing pivote vers l'ancrage local.

## Portée de ce prototype

- Uniquement le **front** : aucune vraie API, aucune vraie authentification,
  aucun vrai paiement. Toutes les données (chauffeur assigné, gains, trajets,
  positions) sont mockées en dur dans le code.
- Pas de tests automatisés — c'est un prototype d'interaction/UX, pas du code
  de production. La reconstruction finale se fera dans FlutterFlow (phase 2,
  hors scope de ce document).
- Objectif : valider les flows et le contenu écran par écran, pas la
  robustesse technique.

## Architecture

- **Stack** : React 19 + Vite + Tailwind CSS (mêmes versions majeures que
  Indxone-Hub pour rester cohérent avec les conventions IndxOne), React Router
  pour la navigation entre écrans, Zustand pour l'état global léger (rôle
  sélectionné, écran courant, données mockées de la course en cours).
- **Repo** : `taga-prototype`, indépendant, sur GitLab (même convention que
  les autres repos IndxOne : un repo par projet, pas de monorepo).
- **Design tokens** : couleurs extraites de `docs/mockups/code_couleur_logo.png`
  (bleu `#0005D6`, vert `#36AB52`) et des fonds navy observés sur les
  maquettes. Police Archivo (mentionnée dans les maquettes) avec fallback
  système. Tokens Tailwind définis dans `tailwind.config.js` (`theme.extend.colors.taga`).

## Composants / écrans

11 écrans au total, un composant par écran :

1. `RoleChoice` — écran de choix de rôle (hybride A+B)
2. Parcours client (`src/screens/client/`) :
   `Onboarding`, `Home`, `Estimate`, `ActiveRide`, `RideEnd`
3. Parcours chauffeur (`src/screens/driver/`) :
   `Online`, `IncomingRequest`, `Navigation`, `RideInProgress`, `PayoutRecap`

Chaque écran est un composant autonome, stylé au format mobile (cadre de
téléphone centré, comme dans les maquettes), et navigable via React Router
(`/`, `/client/...`, `/driver/...`).

## Flux de données

État global minimal via Zustand (`src/store/useAppStore.js`) :
- `role` : `'passenger' | 'driver' | null`
- données mockées de course courante (chauffeur assigné, distance, prix,
  statut) — un seul jeu de données fixe suffit pour ce prototype, pas besoin
  de générateur aléatoire.

Pas d'appel réseau. Toute navigation entre écrans se fait via les boutons
visibles sur les maquettes (ex. « Continuer », « Commander », « Accepter »).

## Double sortie (repo + Artifact)

En plus du repo GitLab (app Vite classique, `npm run dev` en local), une
version **Artifact Claude.ai** sera publiée pour permettre à l'utilisateur de
reprendre le prototype directement en conversation. Contrainte technique :
les Artifacts exigent un fichier HTML autonome (CSS/JS inlinés, aucune
dépendance externe, CSP stricte). Cette version sera générée séparément
(build inliné ou réécriture ciblée), pas committée dans le repo GitLab en
tant que source de vérité — le repo React/Vite reste la référence de code.

## Hors scope

- Backend réel (Supabase), authentification SMS, paiement mobile money réel,
  géolocalisation réelle — tout est mocké.
- Portage FlutterFlow — sujet d'un spec ultérieur, une fois le prototype
  validé.
- Tests automatisés.
