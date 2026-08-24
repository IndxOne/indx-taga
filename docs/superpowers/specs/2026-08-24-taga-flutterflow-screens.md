# TAGA — Spec d'implémentation FlutterFlow (écran par écran)

Date : 2026-08-24
Statut : approuvé (design), à construire dans FlutterFlow.

## Portée

Ce document documente, écran par écran, la réalisation finale dans
FlutterFlow : widgets, composants réutilisables, variables d'état, actions
par bouton, routes, tables Supabase concernées (voir
`2026-08-24-taga-supabase-schema.md`), règles de visibilité, comportement
responsive mobile, et critères d'acceptation.

Base UX : `2026-08-24-taga-prototype-design.md` (prototype React) et les
maquettes dans `docs/mockups/`. 16 écrans au total : 6 écrans communs, 4
écrans client, 5 écrans chauffeur, plus l'écran de rôle.

Conventions transverses :
- App mobile uniquement (portrait), largeur cible 375–430px, pas de layout
  tablette au MVP.
- Composants réutilisables partagés listés une fois (section suivante), puis
  référencés par nom dans chaque écran.
- Toute donnée affichée provient de Supabase (plus de mock à ce stade —
  contrairement au prototype React).

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
  (alimenté par la vue `active_driver_public`).
- **`RideOptionCard`** : catégorie de course, icône, prix, temps d'attente,
  état sélectionné/non sélectionné.
- **`RatingStars`** : sélecteur 1–5 étoiles interactif.
- **`AmountTile`** : libellé + montant formaté FCFA.
- **`EmptyState`** : icône + message, pour listes vides (historique sans
  course, etc.).

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
  - Session valide, `has_driver_profile = false` → `/client/home`.
  - Session valide, `has_driver_profile = true`, `active_role = 'driver'`
    → `/driver/online`.
  - Session valide, `active_role = 'passenger'` → `/client/home`.
- **Tables Supabase** : `profiles` (lecture de `active_role`,
  `has_driver_profile` via la session).
- **Règles de visibilité** : jamais accessible manuellement (pas de bouton
  retour vers cet écran).
- **Responsive mobile** : contenu centré verticalement et horizontalement,
  aucune variation nécessaire.
- **Critères d'acceptation** :
  - [ ] Redirection correcte selon les 3 cas de session ci-dessus.
  - [ ] Timeout de sécurité (ex. 5s) → si la résolution de session échoue,
    fallback vers `/role-choice`.

## Écran 1 — Choix de rôle (hybride A+B)

*(Déjà détaillé lors du cadrage — repris ici pour la complétude du document.)*

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
  Supabase Auth (le profil `profiles` est créé après vérification OTP,
  écran suivant).
- **Règles de visibilité** : accessible seulement avec `role` défini en
  paramètre (sinon redirect `/role-choice`).
- **Responsive mobile** : clavier numérique natif à l'ouverture du champ,
  bouton principal reste visible au-dessus du clavier (pas caché derrière).
- **Critères d'acceptation** :
  - [ ] Validation format téléphone ivoirien avant activation du bouton.
  - [ ] Message d'erreur clair si l'envoi SMS échoue (réseau, quota).
  - [ ] Le paramètre `role` est bien transmis à l'écran OTP.

## Écran 3 — Vérification OTP

- **Widgets** : `Column`, titre, sous-titre (numéro affiché), `OtpInput`,
  minuteur de renvoi, lien "Renvoyer le code", `PrimaryButton` "Vérifier".
- **Composants réutilisables** : `OtpInput`, `PrimaryButton`.
- **Variables d'état** : `otpCode` (Page State), `resendCooldown` (Page
  State, secondes).
- **Actions** :
  - `Vérifier` : appel Supabase Auth `verifyOtp({ phone, token })`.
    - Succès + profil `profiles` inexistant → création du profil
      (`full_name` demandé si absent — cf. note ci-dessous) puis navigate
      `/client/home` ou `/driver/online` selon `role`.
    - Échec → message d'erreur inline, champ vidé.
  - `Renvoyer le code` : rappel `signInWithOtp`, actif seulement quand
    `resendCooldown = 0` (cooldown 30s après chaque envoi).
- **Routes** : `/otp`.
- **Tables Supabase** : `insert` dans `profiles` (première connexion) avec
  `active_role = role`, `has_driver_profile = (role == 'driver')` ; si
  `role = 'driver'`, `insert` correspondant dans `driver_profiles`
  (`verification_status = 'pending'`).
- **Règles de visibilité** : accessible seulement avec `phone` et `role` en
  paramètres (sinon redirect `/onboarding`).
- **Responsive mobile** : `OtpInput` avec cases suffisamment grandes pour le
  tactile (min 44×44px par case), clavier numérique auto-focus.
- **Critères d'acceptation** :
  - [ ] Code à 6 chiffres, soumission auto dès la 6e case remplie.
  - [ ] Cooldown de renvoi visible et respecté (pas de spam SMS).
  - [ ] Création correcte du profil (et `driver_profiles` si applicable) en
    une seule vérification réussie, pas de doublon en cas de double-tap.

## Écran 4 — Profil (commun, sections conditionnelles par rôle)

- **Widgets** : `Column`, avatar + nom + note (`AmountTile`-like), liste de
  `ListTile` (infos personnelles, moyens de paiement, historique, aide,
  déconnexion). Si `has_driver_profile = true` : section supplémentaire
  "Basculer en mode chauffeur/passager" + bloc véhicule + statut de
  vérification.
- **Composants réutilisables** : `RatingStars` (lecture seule, affichage
  note moyenne).
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
- **Responsive mobile** : liste scrollable, avatar/nom/note fixes en haut
  (pas de sticky header nécessaire au MVP).
- **Critères d'acceptation** :
  - [ ] Rôle actif affiché correctement et bascule fonctionnelle sans
    recharger toute l'app.
  - [ ] Bandeau de vérification chauffeur visible uniquement si pertinent.

## Écran 5 — Historique des courses (commun)

- **Widgets** : `Column`, filtre par statut (optionnel MVP : liste unique
  triée par date desc), `ListView` de `RideHistoryTile` (date, trajet,
  montant), `EmptyState` si vide.
- **Composants réutilisables** : `EmptyState`, `AmountTile`.
- **Variables d'état** : `rides` (Page State, liste chargée à l'ouverture).
- **Actions** :
  - Tap sur une ligne → navigate `/ride-detail?ride_id=...` (écran de
    détail non spécifié ici, hors scope MVP — affichage simple en attendant).
- **Routes** : `/ride-history`.
- **Tables Supabase** : `select` sur `rides` où `status = 'completed'`,
  filtré `passenger_id = auth.uid()` (mode passager) ou
  `driver_id = auth.uid()` (mode chauffeur), selon `active_role`. Montant
  affiché : `total_fare` (passager) vs part nette calculée côté client
  (chauffeur, 85%).
- **Règles de visibilité** : le contenu (prix payé vs gain net) dépend de
  `active_role`, pas d'écran séparé.
- **Responsive mobile** : liste scrollable standard, pagination simple
  (chargement des 20 dernières courses au MVP, pas d'infinite scroll).
- **Critères d'acceptation** :
  - [ ] Liste correctement filtrée par rôle actif.
  - [ ] `EmptyState` affiché si aucune course terminée.
  - [ ] Montant affiché cohérent avec le rôle (payé vs net).

## Écran 6 — Moyens de paiement / retrait (commun)

- **Widgets** : `Column`, liste de `PaymentMethodTile` (logo provider,
  numéro masqué, badge "par défaut"), `PrimaryButton` "Ajouter un moyen de
  paiement", modal d'ajout (provider + numéro).
- **Composants réutilisables** : `PrimaryButton`.
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

- **Widgets** : `MapView` (position actuelle), barre "Où on va
  aujourd'hui ?", liste de destinations favorites (`ListTile` icône +
  libellé + sous-adresse), `BottomNavBar` (Accueil/Trajets/Paiements/Profil).
- **Composants réutilisables** : `MapView`, `EmptyState` (si aucune
  destination favorite).
- **Variables d'état** : `currentPosition` (App State, géoloc device),
  `favoriteDestinations` (Page State).
- **Actions** :
  - Tap barre destination → navigate `/client/estimate` (champ destination
    en focus).
  - Tap destination favorite → navigate `/client/estimate?dropoff=...`
    (pré-rempli).
- **Routes** : `/client/home`.
- **Tables Supabase** : pas de table dédiée aux favoris au MVP (hors
  scope — si nécessaire, ajouter une table `saved_places` dans une
  itération future) ; lecture de `profiles.full_name` pour la salutation.
- **Règles de visibilité** : nécessite permission de géolocalisation ;
  si refusée, `MapView` affiche un état par défaut (position non
  centrée) avec message d'invite à activer la géoloc.
- **Responsive mobile** : carte occupe ~55% de l'écran, panneau destination
  en bottom sheet fixe.
- **Critères d'acceptation** :
  - [ ] Salutation personnalisée (prénom) affichée correctement.
  - [ ] Navigation vers Estimation avec destination pré-remplie quand
    applicable.
  - [ ] Comportement correct si permission géoloc refusée.

## Écran 8 — Estimation

- **Widgets** : `MapView` (tracé pickup→dropoff), en-tête trajet
  (adresses + bouton retour), `ListView` de `RideOptionCard` (Go, Partage,
  Family, Confort), sélecteur moyen de paiement, `PrimaryButton`
  "Commander · {prix}".
- **Composants réutilisables** : `MapView`, `RideOptionCard`,
  `PrimaryButton`.
- **Variables d'état** : `selectedCategory` (Page State), `fareEstimates`
  (Page State, calculées via Edge Function `estimate-fare` à l'ouverture),
  `selectedPaymentMethod` (Page State, initialisé au moyen par défaut).
- **Actions** :
  - Tap `RideOptionCard` : `selectedCategory = category`.
  - `Changer` (paiement) → navigate `/payment-methods` (retour ensuite).
  - `Commander` : `insert` dans `rides` (`status = 'searching'`) → navigate
    `/client/active-ride?ride_id=...`.
- **Routes** : `/client/estimate`.
- **Tables Supabase** : `insert` sur `rides` ; lecture de
  `payment_methods` pour le sélecteur.
- **Règles de visibilité** : bouton `Commander` `disabled` si aucune
  catégorie sélectionnée ou aucun moyen de paiement enregistré (dans ce
  cas, message incitant à en ajouter un).
- **Responsive mobile** : liste des options scrollable si plus de 4
  catégories à l'avenir ; bouton `Commander` toujours visible en bas
  (sticky).
- **Critères d'acceptation** :
  - [ ] Prix affiché cohérent avec la catégorie sélectionnée.
  - [ ] Impossible de commander sans moyen de paiement valide.
  - [ ] La ligne `rides` créée contient bien pickup/dropoff/catégorie/prix
    corrects.

## Écran 9 — Course active

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
    écran de chat (hors scope détail ici).
  - `Partager le trajet` : génère un lien de suivi (hors scope backend
    détaillé ici).
  - Annulation (bouton secondaire, si `status in ('searching','offered')`) :
    update `rides.status = 'cancelled'`.
- **Routes** : `/client/active-ride?ride_id=...`.
- **Tables Supabase** : `select` + souscription Realtime sur `rides` et
  `driver_locations` (via la vue `active_driver_public` pour les infos
  chauffeur, cf. schéma).
- **Règles de visibilité** : le bandeau de statut et les actions
  disponibles changent selon `rides.status`
  (`accepted`→"en approche", `arrived`→"chauffeur arrivé",
  `in_progress`→"course en cours" avec ETA destination).
- **Responsive mobile** : carte prend le haut de l'écran, `DriverInfoCard`
  en bottom sheet fixe, doit rester lisible même avec notifications
  système affichées.
- **Critères d'acceptation** :
  - [ ] Position chauffeur mise à jour en temps réel sans rafraîchissement
    manuel.
  - [ ] Transition automatique vers l'écran Fin de course quand
    `status = 'completed'`.
  - [ ] Annulation possible uniquement aux statuts autorisés.

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
    `/client/home`.
  - `Reçu PDF` : génération/téléchargement (hors scope détail — Edge
    Function future).
- **Routes** : `/client/ride-end?ride_id=...`.
- **Tables Supabase** : `select` sur `rides` + `payments` (statut paiement) ;
  `insert` sur `ratings`.
- **Règles de visibilité** : accessible uniquement si `rides.status =
  'completed'` et que l'utilisateur en est le passager (sinon redirect
  `/client/home`).
- **Responsive mobile** : contenu scrollable si le détail prix + notation
  dépasse la hauteur d'écran (petits appareils).
- **Critères d'acceptation** :
  - [ ] Impossible de noter deux fois la même course (contrainte `unique`
    déjà en base, mais le bouton doit aussi se désactiver après envoi).
  - [ ] Montant total affiché = somme des lignes de détail.
  - [ ] Retour à l'Accueil après soumission.

---

## Parcours Chauffeur

## Écran 11 — En ligne

- **Widgets** : en-tête (avatar, "Bonjour, {prénom}", badge statut),
  `MapView` de fond avec anneau de pulsation (indicateur disponibilité),
  bloc gains du jour (`AmountTile` gros format + stats courses/heures en
  ligne/note), `Switch` "Disponible pour course", bloc bonus de série
  (barre de progression).
- **Composants réutilisables** : `MapView`, `AmountTile`.
- **Variables d'état** : `isAvailable` (Page State, lié à
  `driver_profiles.is_available`), `todayStats` (Page State, calculées via
  requête agrégée sur `wallet_transactions`/`rides` du jour).
- **Actions** :
  - `Switch` disponibilité : update `driver_profiles.is_available` ;
    si `true`, démarre l'upsert périodique de position dans
    `driver_locations` (toutes les ~5s tant que l'écran est actif ou
    l'app en foreground).
- **Routes** : `/driver/online`.
- **Tables Supabase** : `select`/`update` sur `driver_profiles` ;
  `insert`/`update` sur `driver_locations` ; agrégats en lecture sur
  `rides`/`wallet_transactions` pour les stats du jour.
- **Règles de visibilité** : si `driver_profiles.verification_status !=
  'verified'`, le `Switch` est `disabled` avec message "Vérification en
  cours".
- **Responsive mobile** : bloc gains fixe en bas (bottom sheet), carte en
  arrière-plan plein écran.
- **Critères d'acceptation** :
  - [ ] Bascule disponible ↔ indisponible reflétée en base immédiatement.
  - [ ] Chauffeur non vérifié ne peut pas passer disponible.
  - [ ] Réception d'une demande entrante uniquement si `isAvailable = true`.

## Écran 12 — Demande entrante

- **Widgets** : bandeau "Nouvelle demande", `MapView` avec marqueur
  distance, bloc gain ("Tu gagnes {montant}") + `CircularProgressIndicator`
  compte à rebours 9s, stats course (distance, durée, note client, temps
  pickup), détail pickup/destination, `PrimaryButton` "Accepter · {montant}"
  + bouton secondaire "Refuser".
- **Composants réutilisables** : `MapView`, `PrimaryButton`.
- **Variables d'état** : `incomingRide` (Page State, reçu via canal
  Realtime `driver:{driver_id}`), `countdown` (Page State, timer local 9s).
- **Actions** :
  - `Accepter` : appel Edge Function `accept-ride` (update atomique, cf.
    schéma). Succès → navigate `/driver/navigation?ride_id=...`. Échec
    (déjà pris) → message + retour `/driver/online`.
  - `Refuser` / expiration du `countdown` : ferme l'écran, retour
    `/driver/online`, aucune écriture en base (la course reste
    `searching` pour un autre chauffeur).
- **Routes** : `/driver/incoming-request`.
- **Tables Supabase** : `select` (lecture initiale via l'événement
  Realtime, pas de requête directe) ; `update` conditionnel via Edge
  Function à l'acceptation.
- **Règles de visibilité** : écran présenté uniquement en overlay/push
  quand un événement Realtime est reçu et `isAvailable = true` ; disparaît
  automatiquement si la course est prise par un autre chauffeur entre
  temps (écoute du statut).
- **Responsive mobile** : compte à rebours et bouton `Accepter` toujours
  visibles sans scroll (priorité absolue à l'action rapide).
- **Critères d'acceptation** :
  - [ ] Compte à rebours précis à la seconde, auto-refus à 0.
  - [ ] Gestion correcte du cas "course déjà prise par un autre chauffeur".
  - [ ] Montant affiché = 85% du `total_fare` de la course.

## Écran 13 — Navigation

- **Widgets** : bandeau instruction de guidage ("200m, Tout droit sur
  Bd Latrille"), ETA résumé, `MapView` avec itinéraire vers le pickup,
  `DriverInfoCard`-like inversé (infos passager : nom, note, tag
  "cliente régulière"), bouton "Itinéraire" (ouvre app de nav externe si
  souhaité), `PrimaryButton` "Je suis arrivé · démarrer course".
- **Composants réutilisables** : `MapView`.
- **Variables d'état** : `ride` (Page State, souscription Realtime sur
  `rides`).
- **Actions** :
  - `Je suis arrivé · démarrer course` : update `rides.status = 'arrived'`
    puis, une fois le passager à bord confirmé (même bouton réutilisé,
    libellé change), `status = 'in_progress'`, `started_at = now()` →
    navigate `/driver/ride-in-progress?ride_id=...`.
    - *Note d'implémentation* : deux sous-états (`arrived` puis
      `in_progress`) sur le même écran, le bouton change de libellé selon
      `ride.status`.
- **Routes** : `/driver/navigation?ride_id=...`.
- **Tables Supabase** : `select`/`update` sur `rides`.
- **Règles de visibilité** : accessible uniquement si `driver_id =
  auth.uid()` et `status in ('accepted','driver_en_route','arrived')`.
- **Responsive mobile** : bandeau d'instruction fixe en haut, bouton
  d'action principal fixe en bas, carte occupe l'espace restant.
- **Critères d'acceptation** :
  - [ ] Bouton passe correctement de "Je suis arrivé" à "Démarrer course".
  - [ ] `started_at` renseigné au démarrage effectif de la course.
  - [ ] Écran inaccessible si la course n'appartient pas au chauffeur
    courant.

## Écran 14 — Course en cours

- **Widgets** : bandeau "Course en cours · {passager} à bord", instruction
  de guidage, badge gain ("Ton gain {montant}"), `MapView` avec tracé vers
  destination, barre de progression trajet (km parcourus / total), stats
  (temps restant, vitesse, trafic, heure d'arrivée), bouton "Urgence"
  (secondaire), `PrimaryButton` "Terminer la course".
- **Composants réutilisables** : `MapView`.
- **Variables d'état** : `ride` (Page State, souscription Realtime),
  `progressRatio` (calculé côté client à partir de la position vs
  distance totale).
- **Actions** :
  - `Terminer la course` : update `rides.status = 'completed'`,
    `completed_at = now()` ; déclenche (via trigger DB ou Edge Function)
    la création de la ligne `payments` et de la ligne
    `wallet_transactions` (`type = 'ride_earning'`, montant = 85% du
    `total_fare`) → navigate `/driver/payout-recap?ride_id=...`.
  - `Urgence` : ouverture d'un flux d'assistance (hors scope détail ici).
- **Routes** : `/driver/ride-in-progress?ride_id=...`.
- **Tables Supabase** : `update` sur `rides` ; `insert` (via trigger/Edge
  Function) sur `payments` et `wallet_transactions`.
- **Règles de visibilité** : accessible uniquement si `driver_id =
  auth.uid()` et `status = 'in_progress'`.
- **Responsive mobile** : badge gain et bouton principal toujours visibles,
  pas de contenu critique caché par la barre système.
- **Critères d'acceptation** :
  - [ ] `Terminer la course` crée bien une ligne `wallet_transactions` avec
    le bon montant (85%).
  - [ ] Impossible de terminer une course qui n'est pas `in_progress`.
  - [ ] Navigation automatique vers Récap & retrait après complétion.

## Écran 15 — Récap & retrait

- **Widgets** : bandeau "Course terminée", titre félicitations (note
  reçue), bloc solde disponible (`AmountTile` gros format + stats jour),
  détail dernière course (trajet, gain net), section "Retrait mobile
  money" (liste `PaymentMethodTile`, `PrimaryButton` "Retirer {montant}
  sur {provider}"), bouton secondaire "Reprendre en ligne".
- **Composants réutilisables** : `AmountTile`, `PaymentMethodTile`
  (référence croisée avec l'écran Moyens de paiement).
- **Variables d'état** : `walletBalance` (Page State, somme des
  `wallet_transactions` non retirées), `lastRide` (Page State).
- **Actions** :
  - `Retirer {montant} sur {provider}` : appel Edge Function `payout`
    (déclenche le virement mobile money côté fournisseur — intégration
    hors scope détail ici), puis `insert` dans `wallet_transactions`
    (`type = 'payout'`, montant négatif) une fois confirmé.
  - `Reprendre en ligne` : navigate `/driver/online`.
- **Routes** : `/driver/payout-recap?ride_id=...`.
- **Tables Supabase** : `select` agrégé sur `wallet_transactions` (solde) ;
  `insert` sur `wallet_transactions` (`type = 'payout'`).
- **Règles de visibilité** : bouton de retrait `disabled` si
  `walletBalance <= 0` ou si aucun moyen de paiement enregistré.
- **Responsive mobile** : bouton de retrait principal toujours visible en
  bas, contenu scrollable au-dessus.
- **Critères d'acceptation** :
  - [ ] Solde affiché = somme exacte des `wallet_transactions` du chauffeur
    (`ride_earning` + `bonus` − `payout`).
  - [ ] Retrait impossible si solde nul.
  - [ ] Après retrait réussi, le solde affiché se met à jour immédiatement.

---

## Hors scope de ce document

- Écran de détail d'une course individuelle depuis l'historique (référencé
  mais non spécifié).
- Flux de chat in-app entre passager et chauffeur (bouton présent, contenu
  non détaillé).
- Flux "Urgence"/assistance.
- Génération effective du reçu PDF.
- Intégration technique réelle des paiements mobile money (Orange
  Money/Wave) — ce document suppose une Edge Function `payout` déjà
  fonctionnelle, dont la conception fait l'objet d'un spec dédié.
