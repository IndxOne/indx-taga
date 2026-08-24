# TAGA — Spec d'implémentation FlutterFlow (écran par écran)

Date : 2026-08-24 (v3 — corrections suite 2e revue technique)
Statut : approuvé (design), à construire dans FlutterFlow.

## Portée

Ce document documente, écran par écran, la réalisation finale dans
FlutterFlow : widgets, composants réutilisables, variables d'état, actions
par bouton, routes, tables Supabase concernées (voir
`2026-08-24-taga-supabase-schema.md`, v2), règles de visibilité,
comportement responsive mobile, et critères d'acceptation.

Base UX : `2026-08-24-taga-prototype-design.md` (prototype React) et les
maquettes dans `docs/mockups/`. **17 écrans** au total (v2 — ajout de
l'écran "Compléter le profil") : 7 écrans communs, 4 écrans client, 5
écrans chauffeur, plus l'écran de rôle.

**v2 — changements suite revue** : nouvel écran "Compléter le profil"
(la création de `profiles` exige `full_name`, ce que l'OTP seul ne
garantissait pas) ; écran Demande entrante branché sur `ride_offers` (plus
sur un événement Realtime générique) ; statut `driver_en_route` réellement
déclenché à l'acceptation (remplace `accepted`) ; écran Estimation
enregistre désormais `payment_method_id` sur la course ; écran Récap &
retrait lit `driver_wallets.balance` (source serveur) au lieu de calculer
le solde côté client, et le retrait passe par une clé d'idempotence ;
écran Accueil branché sur la table `saved_places` ; composants
réutilisables `PaymentMethodTile`, `RideHistoryTile`, `BottomNavBar`
ajoutés à la liste.

**v3 — changements suite 2e revue** : écran "Compléter le profil" appelle
désormais l'Edge Function `complete-profile` au lieu d'`insert` directs
(RLS ne les autorise plus) ; écran Estimation crée la course via l'Edge
Function `request-ride` (prix recalculé serveur, plus falsifiable) ;
écran Course active lit les infos chauffeur via la fonction RPC
`get_active_driver_info` (remplace la vue `active_driver_public`,
inutilisable avec `security_invoker` + RLS restrictives) ; écran Demande
entrante peut désormais lire la course avant acceptation (nouvelle policy
`rides_select_via_offer`) ; écran Course en cours termine la course via
l'Edge Function `complete-ride` (crédit idempotent) au lieu d'un `update`
client direct. Voir **Changelog** en fin de document.

Conventions transverses :
- App mobile uniquement (portrait), largeur cible 375–430px, pas de layout
  tablette au MVP.
- Composants réutilisables partagés listés une fois (section suivante), puis
  référencés par nom dans chaque écran.
- Toute donnée affichée provient de Supabase (plus de mock à ce stade —
  contrairement au prototype React).
- **Suivi de position en arrière-plan non couvert par ce document** (risque
  ouvert, voir schéma Supabase §Hors scope) — les écrans ci-dessous
  supposent l'app au premier plan.

## Composants réutilisables (transverses)

- **`PrimaryButton`** : bouton pleine largeur, fond navy ou mangue selon
  contexte, état `loading`/`disabled`.
- **`RoleCard`** : carte icône + titre + sous-texte + badge + bouton
  (paramétrable passager/chauffeur).
- **`PhoneInput`** : sélecteur indicatif + champ numéro, validation format CI.
- **`OtpInput`** : 6 cases de saisie de code.
- **`MapView`** : carte avec marqueurs pickup/dropoff/chauffeur, tracé
  d'itinéraire.
- **`DriverInfoCard`** : avatar, nom, note, véhicule, boutons appel/message
  (alimenté par la fonction RPC `get_active_driver_info`).
- **`RideOptionCard`** : catégorie de course, icône, prix, temps d'attente,
  état sélectionné/non sélectionné.
- **`RatingStars`** : sélecteur 1–5 étoiles interactif.
- **`AmountTile`** : libellé + montant formaté FCFA.
- **`EmptyState`** : icône + message, pour listes vides (historique sans
  course, etc.).
- **`PaymentMethodTile`** *(v2)* : logo fournisseur (Orange Money/Wave),
  numéro masqué, badge "par défaut", actions (définir par défaut,
  supprimer).
- **`RideHistoryTile`** *(v2)* : date, trajet résumé (adresse pickup →
  dropoff), montant (`AmountTile` interne), icône statut.
- **`BottomNavBar`** *(v2)* : barre de navigation basse à 4 onglets
  (Accueil/Trajets/Paiements/Profil côté client — équivalent
  Travail/Gains/Courses/Profil côté chauffeur, cf. maquette "En ligne").

---

## Écran 0 — Splash

- **Widgets** : `Container` plein écran fond navy, logo TAGA centré,
  `CircularProgressIndicator` discret.
- **Composants réutilisables** : aucun (écran spécifique).
- **Variables d'état** : aucune propre à l'écran ; lit `currentUser` (App
  State FlutterFlow, alimenté par l'auth Supabase).
- **Actions** : aucune interaction utilisateur — redirection automatique
  après résolution de la session (max 1.5s).
- **Routes** : `/` (route initiale de l'app).
  - Pas de session → `/role-choice`.
  - Session valide, pas de ligne `profiles` associée → `/complete-profile`
    *(v2 — cas possible si l'utilisateur a quitté l'app entre l'OTP et la
    complétion du profil)*.
  - Session + profil, `has_driver_profile = false` → `/client/home`.
  - Session + profil, `has_driver_profile = true`, `active_role =
    'driver'` → `/driver/online`.
  - Session + profil, `active_role = 'passenger'` → `/client/home`.
- **Tables Supabase** : `profiles` (lecture de `active_role`,
  `has_driver_profile`, existence de la ligne).
- **Règles de visibilité** : jamais accessible manuellement (pas de bouton
  retour vers cet écran).
- **Responsive mobile** : contenu centré verticalement et horizontalement,
  aucune variation nécessaire.
- **Critères d'acceptation** :
  - [ ] Redirection correcte selon les 4 cas de session ci-dessus.
  - [ ] Timeout de sécurité (ex. 5s) → si la résolution de session échoue,
    fallback vers `/role-choice`.

## Écran 1 — Choix de rôle (hybride A+B)

- **Widgets** : `Container` plein écran (fond navy), `Column` centrale, 2×
  `RoleCard`.
- **Composants réutilisables** : `RoleCard`, `PrimaryButton`.
- **Variables d'état** : `selectedRole` (Page State, enum
  `passenger`/`driver`).
- **Actions** :
  - Carte Passager → `Continuer` : `selectedRole = passenger` → navigate
    `/onboarding?role=passenger`.
  - Carte Chauffeur → `Continuer` : `selectedRole = driver` → navigate
    `/onboarding?role=driver`.
- **Routes** : `/role-choice`.
- **Tables Supabase** : aucune (rôle transmis en paramètre de navigation
  uniquement).
- **Règles de visibilité** : affiché uniquement si pas de session valide
  (cf. Splash) ; ré-accessible depuis l'écran Profil pour changer de rôle
  actif (`active_role`) si `has_driver_profile = true`.
- **Responsive mobile** : cartes empilées en `Column`, padding horizontal
  16px, cible 375×667 minimum sans scroll.
- **Critères d'acceptation** :
  - [ ] Cartes cliquables sur toute leur surface.
  - [ ] Bénéfice chiffré chauffeur visible sans scroll sur iPhone SE.
  - [ ] Navigation déclenchée en moins de 300ms (pas d'appel réseau
    bloquant).

## Écran 2 — Onboarding (numéro de téléphone)

- **Widgets** : `Column`, logo, titre, sous-titre, `PhoneInput`, texte
  légal (CGU/politique de confidentialité), `PrimaryButton` "Recevoir le
  code SMS".
- **Composants réutilisables** : `PhoneInput`, `PrimaryButton`.
- **Variables d'état** : `phoneNumber` (Page State), `role` (paramètre reçu
  de l'écran précédent, propagé).
- **Actions** :
  - `Recevoir le code SMS` : appel Supabase Auth `signInWithOtp({ phone })`
    → navigate `/otp?phone=...&role=...`. Bouton `disabled` tant que
    `phoneNumber` invalide.
- **Routes** : `/onboarding`.
- **Tables Supabase** : aucune écriture directe — `auth.users` géré par
  Supabase Auth.
- **Règles de visibilité** : accessible seulement avec `role` défini en
  paramètre (sinon redirect `/role-choice`).
- **Responsive mobile** : clavier numérique natif à l'ouverture du champ,
  bouton principal reste visible au-dessus du clavier (pas caché derrière).
- **Critères d'acceptation** :
  - [ ] Validation format téléphone ivoirien avant activation du bouton.
  - [ ] Message d'erreur clair si l'envoi SMS échoue (réseau, quota).
  - [ ] Le paramètre `role` est bien transmis à l'écran OTP.

## Écran 3 — Vérification OTP

*(v2 — ne crée plus le profil directement, cf. Écran 3bis)*

- **Widgets** : `Column`, titre, sous-titre (numéro affiché), `OtpInput`,
  minuteur de renvoi, lien "Renvoyer le code", `PrimaryButton` "Vérifier".
- **Composants réutilisables** : `OtpInput`, `PrimaryButton`.
- **Variables d'état** : `otpCode` (Page State), `resendCooldown` (Page
  State, secondes).
- **Actions** :
  - `Vérifier` : appel Supabase Auth `verifyOtp({ phone, token })`.
    - Succès → navigate `/complete-profile?role=...` (systématique : la
      création du profil se fait toujours à l'écran suivant, qu'il
      s'agisse d'une première connexion ou non — l'écran 3bis vérifie
      lui-même si un profil existe déjà et skip si oui).
    - Échec → message d'erreur inline, champ vidé.
  - `Renvoyer le code` : rappel `signInWithOtp`, actif seulement quand
    `resendCooldown = 0` (cooldown 30s après chaque envoi).
- **Routes** : `/otp`.
- **Tables Supabase** : aucune (déplacé vers Écran 3bis).
- **Règles de visibilité** : accessible seulement avec `phone` et `role` en
  paramètres (sinon redirect `/onboarding`).
- **Responsive mobile** : `OtpInput` avec cases suffisamment grandes pour le
  tactile (min 44×44px par case), clavier numérique auto-focus.
- **Critères d'acceptation** :
  - [ ] Code à 6 chiffres, soumission auto dès la 6e case remplie.
  - [ ] Cooldown de renvoi visible et respecté (pas de spam SMS).
  - [ ] Navigation systématique vers `/complete-profile` après succès.

## Écran 3bis — Compléter le profil *(nouveau — v2)*

Corrige le point de la revue : `profiles.full_name` est `not null`, mais
rien avant v2 ne garantissait sa saisie avant l'`insert`.

**v3** : les RLS du schéma n'autorisent plus aucun `insert` client direct
sur `profiles`/`driver_profiles`/`driver_wallets` (bloquant #4 de la 2e
revue). La création passe désormais par une Edge Function transactionnelle.

- **Widgets** : `Column`, titre "Comment on vous appelle ?", champ texte
  nom complet, `PrimaryButton` "Continuer".
- **Composants réutilisables** : `PrimaryButton`.
- **Variables d'état** : `fullName` (Page State), `role` (paramètre
  propagé depuis OTP).
- **Actions** :
  - Au chargement de l'écran : `select` sur `profiles` pour
    `id = auth.uid()`. Si une ligne existe déjà → skip immédiat vers
    `/client/home` ou `/driver/online` selon `active_role` (cas d'un
    utilisateur déjà inscrit qui repasse par ce flux, ou retour arrière).
  - `Continuer` : appel Edge Function `complete-profile`
    (`full_name`, `role`), `service_role`, transaction unique :
    `insert` dans `profiles` ; si `role = 'driver'`, `insert` dans
    `driver_profiles` (`verification_status = 'pending'`) **et**
    `insert` dans `driver_wallets` (`balance = 0`). Succès → navigate
    `/client/home` ou `/driver/online`.
- **Routes** : `/complete-profile`.
- **Tables Supabase** : `select` client sur `profiles` (vérification
  d'existence) ; tous les `insert` (`profiles`, `driver_profiles`,
  `driver_wallets`) passent par `complete-profile` (`service_role`,
  aucune policy `insert` client sur ces tables).
- **Règles de visibilité** : accessible uniquement avec une session Auth
  valide (sinon redirect `/role-choice`).
- **Responsive mobile** : champ texte avec clavier standard, bouton
  `disabled` tant que le nom est vide.
- **Critères d'acceptation** :
  - [ ] Impossible de créer un profil avec un nom vide.
  - [ ] Un utilisateur avec profil déjà existant ne repasse jamais par la
    création (skip automatique).
  - [ ] `driver_wallets` initialisé à 0 pour tout nouveau chauffeur.
  - [ ] Appel en double de `complete-profile` (retry réseau) ne crée pas
    deux profils (contrainte `primary key` sur `profiles.id = auth.uid()`
    protège déjà nativement ce cas).

## Écran 4 — Profil (commun, sections conditionnelles par rôle)

- **Widgets** : `Column`, avatar + nom + note, `BottomNavBar`, liste de
  `ListTile` (infos personnelles, moyens de paiement, historique, aide,
  déconnexion). Si `has_driver_profile = true` : section supplémentaire
  "Basculer en mode chauffeur/passager" + bloc véhicule + statut de
  vérification.
- **Composants réutilisables** : `RatingStars` (lecture seule),
  `BottomNavBar`.
- **Variables d'état** : `profile` (App State, chargé depuis `profiles` +
  `driver_profiles`/`vehicles` si applicable).
- **Actions** :
  - `Basculer de rôle` : update `profiles.active_role`, navigate vers
    `/client/home` ou `/driver/online`.
  - `Moyens de paiement` → navigate `/payment-methods`.
  - `Historique` → navigate `/ride-history`.
  - `Déconnexion` : `supabase.auth.signOut()` → navigate `/role-choice`.
- **Routes** : `/profile`.
- **Tables Supabase** : `select`/`update` sur `profiles`, `select` sur
  `driver_profiles` + `vehicles` si le profil chauffeur existe.
- **Règles de visibilité** : le bloc "Basculer de rôle" et les infos
  véhicule ne s'affichent que si `has_driver_profile = true` ; le statut de
  vérification chauffeur (`pending`/`verified`/`rejected`) conditionne
  l'affichage d'un bandeau d'alerte si `pending` ou `rejected`.
- **Responsive mobile** : liste scrollable, avatar/nom/note fixes en haut.
- **Critères d'acceptation** :
  - [ ] Rôle actif affiché correctement et bascule fonctionnelle sans
    recharger toute l'app.
  - [ ] Bandeau de vérification chauffeur visible uniquement si pertinent.

## Écran 5 — Historique des courses (commun)

- **Widgets** : `Column`, filtre par statut (optionnel MVP : liste unique
  triée par date desc), `ListView` de `RideHistoryTile`, `EmptyState` si
  vide.
- **Composants réutilisables** : `EmptyState`, `RideHistoryTile`.
- **Variables d'état** : `rides` (Page State, liste chargée à l'ouverture).
- **Actions** :
  - Tap sur une ligne → navigate `/ride-detail?ride_id=...` (écran de
    détail non spécifié ici, hors scope MVP).
- **Routes** : `/ride-history`.
- **Tables Supabase** : `select` sur `rides` où `status = 'completed'`,
  filtré `passenger_id = auth.uid()` (mode passager) ou
  `driver_id = auth.uid()` (mode chauffeur), selon `active_role`. Montant
  affiché : `total_fare` (passager) vs les lignes `wallet_transactions`
  `type = 'ride_earning'` liées (chauffeur — montant net déjà figé
  serveur, plus de calcul 85% côté client).
- **Règles de visibilité** : le contenu (prix payé vs gain net) dépend de
  `active_role`, pas d'écran séparé.
- **Responsive mobile** : liste scrollable standard, pagination simple
  (20 dernières courses au MVP, pas d'infinite scroll).
- **Critères d'acceptation** :
  - [ ] Liste correctement filtrée par rôle actif.
  - [ ] `EmptyState` affiché si aucune course terminée.
  - [ ] Montant affiché cohérent avec le rôle (payé vs net, lu depuis les
    tables serveur, jamais recalculé côté client).

## Écran 6 — Moyens de paiement / retrait (commun)

- **Widgets** : `Column`, `BottomNavBar`, liste de `PaymentMethodTile`,
  `PrimaryButton` "Ajouter un moyen de paiement", modal d'ajout (provider +
  numéro).
- **Composants réutilisables** : `PrimaryButton`, `PaymentMethodTile`,
  `BottomNavBar`.
- **Variables d'état** : `paymentMethods` (Page State).
- **Actions** :
  - `Ajouter` : ouvre modal, `insert` dans `payment_methods`.
  - `Définir par défaut` : update `is_default` (reset des autres pour ce
    profil).
  - `Supprimer` : `delete`, avec confirmation si c'est le moyen par défaut.
- **Routes** : `/payment-methods`.
- **Tables Supabase** : `select`/`insert`/`update`/`delete` sur
  `payment_methods` ; si `active_role = driver`, update éventuel de
  `driver_profiles.default_payout_method_id`.
- **Règles de visibilité** : libellé contextuel ("Payer avec" côté
  passager, "Recevoir mes gains sur" côté chauffeur), même table sous-jacente.
- **Responsive mobile** : modal d'ajout en bottom sheet, clavier numérique
  pour le champ numéro.
- **Critères d'acceptation** :
  - [ ] Un seul moyen "par défaut" actif à la fois.
  - [ ] Suppression du moyen par défaut force la sélection d'un nouveau
    défaut (ou bloque si c'est le seul moyen enregistré côté chauffeur).

---

## Parcours Client

## Écran 7 — Accueil

*(v2 — favoris branchés sur `saved_places`)*

- **Widgets** : `MapView` (position actuelle), barre "Où on va
  aujourd'hui ?", liste de destinations favorites (`ListTile` icône +
  libellé + sous-adresse), `BottomNavBar`.
- **Composants réutilisables** : `MapView`, `EmptyState` (si aucune
  destination favorite), `BottomNavBar`.
- **Variables d'état** : `currentPosition` (App State, géoloc device),
  `favoriteDestinations` (Page State, chargé depuis `saved_places`).
- **Actions** :
  - Tap barre destination → navigate `/client/estimate` (champ destination
    en focus).
  - Tap destination favorite → navigate `/client/estimate?dropoff=...`
    (pré-rempli).
- **Routes** : `/client/home`.
- **Tables Supabase** : `select` sur `saved_places` (`profile_id =
  auth.uid()`) ; lecture de `profiles.full_name` pour la salutation.
- **Règles de visibilité** : nécessite permission de géolocalisation ;
  si refusée, `MapView` affiche un état par défaut avec message d'invite à
  activer la géoloc.
- **Responsive mobile** : carte occupe ~55% de l'écran, panneau destination
  en bottom sheet fixe.
- **Critères d'acceptation** :
  - [ ] Salutation personnalisée (prénom) affichée correctement.
  - [ ] Favoris chargés depuis `saved_places`, `EmptyState` si aucun.
  - [ ] Navigation vers Estimation avec destination pré-remplie quand
    applicable.
  - [ ] Comportement correct si permission géoloc refusée.

## Écran 8 — Estimation

*(v3 — création de course déplacée dans l'Edge Function `request-ride`,
plus d'`insert` client direct : le prix restait falsifiable en v2 puisque
le client renvoyait dans l'`insert` les valeurs qu'il avait lui-même
reçues d'`estimate-fare`, sans revérification serveur à la création)*

- **Widgets** : `MapView` (tracé pickup→dropoff), en-tête trajet
  (adresses + bouton retour), `ListView` de `RideOptionCard` (Go, Partage,
  Family, Confort), sélecteur moyen de paiement, `PrimaryButton`
  "Commander · {prix}".
- **Composants réutilisables** : `MapView`, `RideOptionCard`,
  `PrimaryButton`.
- **Variables d'état** : `selectedCategory` (Page State), `fareEstimates`
  (Page State, calculées via Edge Function `estimate-fare` à l'ouverture,
  affichage uniquement), `selectedPaymentMethodId` (Page State, initialisé
  au moyen par défaut).
- **Actions** :
  - Tap `RideOptionCard` : `selectedCategory = category`.
  - `Changer` (paiement) → navigate `/payment-methods` (retour ensuite).
  - `Commander` : appel Edge Function `request-ride` (`pickup_position`,
    `pickup_address`, `dropoff_position`, `dropoff_address`,
    `selectedCategory`, `selectedPaymentMethodId`) — la fonction vérifie
    la propriété du moyen de paiement, **recalcule** distance/durée/prix
    côté serveur (le client n'envoie ni prix ni distance), crée la ligne
    `rides` et retourne `ride_id` → navigate
    `/client/active-ride?ride_id=...`.
- **Routes** : `/client/estimate`.
- **Tables Supabase** : appel Edge Function `estimate-fare` (affichage) ;
  appel Edge Function `request-ride` (création — aucune policy `insert`
  client sur `rides`) ; lecture de `payment_methods` pour le sélecteur.
- **Règles de visibilité** : bouton `Commander` `disabled` si aucune
  catégorie sélectionnée ou aucun moyen de paiement enregistré (dans ce
  cas, message incitant à en ajouter un).
- **Responsive mobile** : liste des options scrollable si plus de 4
  catégories à l'avenir ; bouton `Commander` toujours visible en bas
  (sticky).
- **Critères d'acceptation** :
  - [ ] Le prix stocké sur `rides` est celui recalculé par `request-ride`,
    jamais une valeur transmise telle quelle par le client.
  - [ ] `request-ride` rejette la commande si `payment_method_id` ne
    appartient pas à l'appelant.
  - [ ] Impossible de commander sans moyen de paiement valide.
  - [ ] La ligne `rides` créée contient `payment_method_id` correctement
    renseigné.

## Écran 9 — Course active

*(v2 — bandeau de statut aligné sur `driver_en_route`)*

- **Widgets** : bandeau de statut ("Chauffeur en approche · X min"),
  `MapView` (position chauffeur temps réel), `DriverInfoCard`, détail
  trajet (pickup/dropoff avec ETA), `PrimaryButton` "Partager le trajet"
  (secondaire) + action selon statut.
- **Composants réutilisables** : `MapView`, `DriverInfoCard`.
- **Variables d'état** : `ride` (Page State, souscrit en Realtime sur
  `rides` filtré `id = ride_id`), `driverPosition` (Page State, souscrit en
  Realtime sur `driver_locations`).
- **Actions** :
  - `Appeler`/`Message` (sur `DriverInfoCard`) : lien téléphonique natif /
    écran de chat (hors scope détail).
  - `Partager le trajet` : génère un lien de suivi (hors scope backend
    détaillé).
  - Annulation (bouton secondaire, si `status = 'searching'`) : update
    `rides.status = 'cancelled'`.
- **Routes** : `/client/active-ride?ride_id=...`.
- **Tables Supabase** : `select` + souscription Realtime sur `rides` et
  `driver_locations` ; infos chauffeur (`DriverInfoCard`) chargées via
  l'appel RPC `get_active_driver_info(ride_id)` *(v3 — remplace la vue
  `active_driver_public`, devenue inutilisable avec `security_invoker`
  combiné aux RLS restrictives de `profiles`/`driver_profiles`/`vehicles`)*.
- **Règles de visibilité** : le bandeau de statut et les actions
  disponibles changent selon `rides.status`
  (`driver_en_route`→"en approche", `arrived`→"chauffeur arrivé",
  `in_progress`→"course en cours" avec ETA destination). L'option
  d'annulation disparaît dès que `status != 'searching'` (plus possible
  une fois un chauffeur assigné, cohérent avec le fait que
  l'assignation ne se fait qu'à l'acceptation d'une offre).
- **Responsive mobile** : carte prend le haut de l'écran, `DriverInfoCard`
  en bottom sheet fixe.
- **Critères d'acceptation** :
  - [ ] Position chauffeur mise à jour en temps réel sans rafraîchissement
    manuel, y compris pendant `in_progress` (corrige la coupure de suivi
    identifiée en revue).
  - [ ] Transition automatique vers l'écran Fin de course quand
    `status = 'completed'`.
  - [ ] Annulation possible uniquement au statut `searching`.

## Écran 10 — Fin de course

- **Widgets** : icône succès, titre "Arrivé à bon port", récapitulatif prix
  (détail base/distance/frais via `AmountTile`), moyen de paiement utilisé
  + statut, `RatingStars`, tags de feedback rapide (`Chip` multi-sélection),
  `PrimaryButton` "Envoyer & terminer", lien "Reçu PDF".
- **Composants réutilisables** : `AmountTile`, `RatingStars`.
- **Variables d'état** : `ride` (Page State, déjà chargé), `stars` (Page
  State), `selectedTags` (Page State), `comment` (Page State, optionnel).
- **Actions** :
  - `Envoyer & terminer` : `insert` dans `ratings`, puis navigate
    `/client/home`. Bouton `disabled` immédiatement après premier envoi
    (empêche double-soumission en plus de la contrainte `unique` en base).
  - `Reçu PDF` : génération/téléchargement (hors scope détail).
- **Routes** : `/client/ride-end?ride_id=...`.
- **Tables Supabase** : `select` sur `rides` + `payments` (statut paiement) ;
  `insert` sur `ratings`.
- **Règles de visibilité** : accessible uniquement si `rides.status =
  'completed'` et que l'utilisateur en est le passager (sinon redirect
  `/client/home`).
- **Responsive mobile** : contenu scrollable si le détail prix + notation
  dépasse la hauteur d'écran.
- **Critères d'acceptation** :
  - [ ] Impossible de noter deux fois la même course (contrainte `unique`
    en base + désactivation du bouton après envoi).
  - [ ] Montant total affiché = somme des lignes de détail.
  - [ ] Retour à l'Accueil après soumission.

---

## Parcours Chauffeur

## Écran 11 — En ligne

- **Widgets** : en-tête (avatar, "Bonjour, {prénom}", badge statut),
  `MapView` de fond avec anneau de pulsation, bloc gains du jour
  (`AmountTile` gros format + stats), `Switch` "Disponible pour course",
  bloc bonus de série, `BottomNavBar`.
- **Composants réutilisables** : `MapView`, `AmountTile`, `BottomNavBar`.
- **Variables d'état** : `isAvailable` (Page State, lié à
  `driver_profiles.is_available`), `todayStats` (Page State, calculées via
  requête agrégée sur `wallet_transactions` du jour).
- **Actions** :
  - `Switch` disponibilité : update `driver_profiles.is_available` ;
    si `true`, démarre l'upsert périodique de position dans
    `driver_locations` (toutes les ~5s, **premier plan uniquement** — cf.
    risque ouvert "arrière-plan" dans le schéma Supabase).
- **Routes** : `/driver/online`.
- **Tables Supabase** : `select`/`update` sur `driver_profiles` ;
  `insert`/`update` sur `driver_locations` ; `select` sur `driver_wallets`
  (solde) et `wallet_transactions` (agrégats du jour).
- **Règles de visibilité** : si `driver_profiles.verification_status !=
  'verified'`, le `Switch` est `disabled` avec message "Vérification en
  cours".
- **Responsive mobile** : bloc gains fixe en bas (bottom sheet), carte en
  arrière-plan plein écran.
- **Critères d'acceptation** :
  - [ ] Bascule disponible ↔ indisponible reflétée en base immédiatement.
  - [ ] Chauffeur non vérifié ne peut pas passer disponible.
  - [ ] Réception d'une offre (`ride_offers`) uniquement si
    `isAvailable = true`.

## Écran 12 — Demande entrante

*(v2 — branché sur `ride_offers`, plus sur un événement Realtime "brut")*

- **Widgets** : bandeau "Nouvelle demande", `MapView` avec marqueur
  distance, bloc gain ("Tu gagnes {montant}") + `CircularProgressIndicator`
  compte à rebours (synchronisé sur `ride_offers.expires_at`), stats course
  (distance, durée, note client, temps pickup), détail pickup/destination,
  `PrimaryButton` "Accepter · {montant}" + bouton secondaire "Refuser".
- **Composants réutilisables** : `MapView`, `PrimaryButton`.
- **Variables d'état** : `incomingOffer` (Page State, reçu via canal
  Realtime privé `driver:{driver_id}` — cf. schéma §Realtime — puis
  enrichi par lecture de la ligne `ride_offers` + `rides` correspondante),
  `countdown` (Page State, calculé en continu à partir de
  `incomingOffer.expires_at - now()`, pas un timer fixe indépendant du
  serveur).
- **Actions** :
  - `Accepter` : appel Edge Function `accept-ride`
    (`ride_id`, `driver_id`). Succès → navigate
    `/driver/navigation?ride_id=...`. Échec (offre expirée ou course déjà
    prise) → message explicite + retour `/driver/online`.
  - `Refuser` : update direct `ride_offers.status = 'refused'` (autorisé
    par RLS, transition simple sans risque de concurrence) → retour
    `/driver/online`.
  - Expiration du `countdown` à 0 : comportement identique à `Refuser`
    côté UI (l'expiration effective en base est gérée par le job
    `pg_cron`, cf. schéma).
- **Routes** : `/driver/incoming-request`.
- **Tables Supabase** : `select` sur `ride_offers` + `rides` (lecture —
  possible *(v3)* grâce à la policy `rides_select_via_offer`, qui autorise
  la lecture d'une course tant qu'une offre `sent` non expirée existe pour
  ce chauffeur, même si `rides.driver_id` est encore `null`) ; `update`
  sur `ride_offers` (refus) ; `accept-ride` (Edge Function) pour
  l'acceptation.
- **Règles de visibilité** : écran présenté uniquement en overlay/push
  quand un événement Realtime `driver:{driver_id}` est reçu et
  `isAvailable = true` ; disparaît automatiquement si `ride_offers.status`
  passe à `expired` (course prise par un autre chauffeur ou expirée)
  entre-temps.
- **Responsive mobile** : compte à rebours et bouton `Accepter` toujours
  visibles sans scroll.
- **Critères d'acceptation** :
  - [ ] Compte à rebours synchronisé sur `expires_at` serveur (pas un
    simple timer local désynchronisable).
  - [ ] Gestion correcte du cas "course déjà prise par un autre chauffeur"
    (message clair, retour automatique).
  - [ ] Montant affiché = part nette de `total_fare` déjà calculée côté
    serveur (barème non détaillé ici).

## Écran 13 — Navigation

*(v2 — statut de départ `driver_en_route`, réellement atteint désormais)*

- **Widgets** : bandeau instruction de guidage ("200m, Tout droit sur
  Bd Latrille"), ETA résumé, `MapView` avec itinéraire vers le pickup,
  infos passager (nom, note, tag "cliente régulière"), bouton
  "Itinéraire", `PrimaryButton` "Je suis arrivé · démarrer course".
- **Composants réutilisables** : `MapView`.
- **Variables d'état** : `ride` (Page State, souscription Realtime sur
  `rides`, statut initial `driver_en_route`).
- **Actions** :
  - `Je suis arrivé` (visible si `status = 'driver_en_route'`) : update
    `rides.status = 'arrived'`, le bouton se relabellise "Démarrer course".
  - `Démarrer course` (visible si `status = 'arrived'`) : update
    `rides.status = 'in_progress'`, `started_at = now()` → navigate
    `/driver/ride-in-progress?ride_id=...`.
- **Routes** : `/driver/navigation?ride_id=...`.
- **Tables Supabase** : `select`/`update` sur `rides`.
- **Règles de visibilité** : accessible uniquement si `driver_id =
  auth.uid()` et `status in ('driver_en_route','arrived')`.
- **Responsive mobile** : bandeau d'instruction fixe en haut, bouton
  d'action principal fixe en bas.
- **Critères d'acceptation** :
  - [ ] Écran atteint directement avec `status = 'driver_en_route'` après
    acceptation (plus de statut intermédiaire manquant).
  - [ ] Bouton passe correctement de "Je suis arrivé" à "Démarrer course".
  - [ ] `started_at` renseigné au démarrage effectif de la course.
  - [ ] Écran inaccessible si la course n'appartient pas au chauffeur
    courant.

## Écran 14 — Course en cours

- **Widgets** : bandeau "Course en cours · {passager} à bord", instruction
  de guidage, badge gain ("Ton gain {montant}"), `MapView` avec tracé vers
  destination, barre de progression trajet, stats (temps restant, vitesse,
  trafic, heure d'arrivée), bouton "Urgence" (secondaire), `PrimaryButton`
  "Terminer la course".
- **Composants réutilisables** : `MapView`.
- **Variables d'état** : `ride` (Page State, souscription Realtime),
  `progressRatio` (calculé côté client à partir de la position vs
  distance totale — affichage seulement, ne modifie aucune donnée
  financière).
*(v3 — "Terminer la course" appelle l'Edge Function `complete-ride` au
lieu d'un `update` client direct : RLS n'autorise plus le client à
positionner `status = 'completed'`, seules les transitions non financières
`arrived`/`in_progress` restent en écriture directe, cf. schéma
§RLS `rides`)*

- **Actions** :
  - `Terminer la course` : appel Edge Function `complete-ride`
    (`ride_id`) — transaction serveur : `rides.status = 'completed'`,
    `completed_at = now()`, création de la ligne `wallet_transactions`
    (`type = 'ride_earning'`, protégée par l'index unique partiel
    `wallet_transactions_ride_earning_once` contre un double crédit en
    cas de retry), incrément de `driver_wallets.balance`. Succès →
    navigate `/driver/payout-recap?ride_id=...`.
  - `Urgence` : ouverture d'un flux d'assistance (hors scope détail).
- **Routes** : `/driver/ride-in-progress?ride_id=...`.
- **Tables Supabase** : aucune écriture directe sur `rides` pour cette
  transition — tout passe par `complete-ride` (`service_role`) : `rides`,
  `payments`, `driver_wallets`, `wallet_transactions`.
- **Règles de visibilité** : accessible uniquement si `driver_id =
  auth.uid()` et `status = 'in_progress'`.
- **Responsive mobile** : badge gain et bouton principal toujours visibles.
- **Critères d'acceptation** :
  - [ ] `complete-ride` déclenche bien la création serveur de la ligne
    `wallet_transactions` et l'incrément de `driver_wallets.balance`
    (vérifiable en relisant le solde après coup, pas de calcul client).
  - [ ] Un double appel de `complete-ride` pour la même course (retry
    réseau, double-tap) ne crédite le wallet qu'une seule fois.
  - [ ] Impossible de terminer une course qui n'est pas `in_progress`.
  - [ ] Navigation automatique vers Récap & retrait après complétion.

## Écran 15 — Récap & retrait

*(v2 — solde lu depuis `driver_wallets`, retrait avec idempotence)*

- **Widgets** : bandeau "Course terminée", titre félicitations, bloc solde
  disponible (`AmountTile` gros format), détail dernière course, section
  "Retrait mobile money" (liste `PaymentMethodTile`, `PrimaryButton`
  "Retirer {montant} sur {provider}"), bouton secondaire "Reprendre en
  ligne".
- **Composants réutilisables** : `AmountTile`, `PaymentMethodTile`.
- **Variables d'état** : `walletBalance` (Page State, lu directement depuis
  `driver_wallets.balance` — **jamais recalculé côté client**), `lastRide`
  (Page State), `payoutIdempotencyKey` (Page State, UUID généré une fois à
  l'ouverture de l'écran, réutilisé tel quel si l'appel de retrait est
  relancé après une erreur réseau).
- **Actions** :
  - `Retirer {montant} sur {provider}` : appel Edge Function `payout`
    (`amount`, `provider`, `payoutIdempotencyKey`). Bouton passe en
    `loading` ; en cas de retry (perte réseau), la même clé est renvoyée
    (pas de nouvelle génération), garantissant qu'un seul retrait est
    effectivement créé côté serveur même en cas de double-tap.
  - `Reprendre en ligne` : navigate `/driver/online`.
- **Routes** : `/driver/payout-recap?ride_id=...`.
- **Tables Supabase** : `select` sur `driver_wallets` (solde) ; appel
  Edge Function `payout` (qui écrit `payouts`/`wallet_transactions`/
  `driver_wallets` côté serveur — le client n'écrit directement aucune de
  ces tables).
- **Règles de visibilité** : bouton de retrait `disabled` si
  `walletBalance <= 0` ou si aucun moyen de paiement enregistré.
- **Responsive mobile** : bouton de retrait principal toujours visible en
  bas, contenu scrollable au-dessus.
- **Critères d'acceptation** :
  - [ ] Solde affiché = valeur exacte de `driver_wallets.balance` (source
    serveur), rafraîchi après un retrait réussi.
  - [ ] Retrait impossible si solde nul.
  - [ ] Un double-tap sur "Retirer" ne crée qu'un seul `payouts` (vérifié
    via la contrainte `unique` sur `idempotency_key`).

---

## Hors scope de ce document (nécessite un spec dédié avant implémentation)

- Écran de détail d'une course individuelle depuis l'historique (référencé
  mais non spécifié).
- Flux de chat in-app entre passager et chauffeur (bouton présent, contenu
  non détaillé).
- Flux "Urgence"/assistance.
- Génération effective du reçu PDF.
- Intégration technique réelle des paiements mobile money (Orange
  Money/Wave) — le contrat interne est fixé (schéma §Paiements & retraits),
  pas l'appel HTTP au fournisseur.
- Suivi de position en arrière-plan (app fermée/minimisée) — risque ouvert,
  cf. schéma Supabase.

## Changelog

Voir le changelog détaillé dans `2026-08-24-taga-supabase-schema.md`
(section correspondante) pour la correspondance complète entre chaque
point soulevé et sa correction. Résumé côté écrans :

**v1 → v2**

| Écran | Changement |
|---|---|
| OTP (3) | Ne crée plus le profil directement |
| **Nouveau** 3bis | "Compléter le profil" — garantit `full_name` avant création |
| Estimation (8) | Enregistre `payment_method_id` sur la course, prix lu depuis `estimate-fare` (serveur) |
| Course active (9) | Bandeau aligné sur `driver_en_route`, suivi position étendu à `in_progress` |
| Demande entrante (12) | Branché sur `ride_offers`, countdown synchronisé serveur, gestion "déjà prise" |
| Navigation (13) | Démarre bien à `driver_en_route` (plus de statut manquant) |
| Course en cours (14) | Écritures financières déplacées côté serveur exclusivement |
| Récap & retrait (15) | Solde lu depuis `driver_wallets`, retrait avec clé d'idempotence |

**v2 → v3**

| Écran | Changement |
|---|---|
| Compléter le profil (3bis) | `insert` directs remplacés par l'appel Edge Function `complete-profile` (RLS n'autorise plus l'`insert` client sur `profiles`/`driver_profiles`/`driver_wallets`) |
| Estimation (8) | Création de course déplacée dans l'Edge Function `request-ride` (prix recalculé serveur, plus falsifiable) |
| Course active (9) | Infos chauffeur lues via RPC `get_active_driver_info` au lieu de la vue `active_driver_public` (devenue inutilisable) |
| Demande entrante (12) | Lecture de la course avant acceptation désormais possible (policy `rides_select_via_offer`) |
| Course en cours (14) | "Terminer la course" appelle l'Edge Function `complete-ride` (crédit idempotent) au lieu d'un `update` client direct |
| Transverse | Ajout composants `PaymentMethodTile`, `RideHistoryTile`, `BottomNavBar` ; Accueil branché sur `saved_places` |
