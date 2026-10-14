# TAGA — Lot 4A : géolocalisation et suivi temps réel

## Périmètre

Lot 4A couvre la géolocalisation du navigateur, la conservation serveur de la
dernière position chauffeur, le suivi Realtime Supabase et le contrat de
cartographie `MapProvider`. Le rendu actuel est volontairement SVG : il ne
prétend pas fournir un géocodage, un itinéraire ou un fond cartographique réel.

Google Maps, Places, Routes et les clés FlutterFlow restent dans le Lot 4B.
Aucun fournisseur temporaire n'est ajouté dans 4A.

## Contrat backend

La migration `005_live_driver_locations.sql` crée `driver_locations`, avec une
ligne par course active :

- `latitude`, `longitude` : coordonnées validées côté PostgreSQL ;
- `accuracy_m`, `heading_deg`, `speed_mps` : métadonnées facultatives ;
- `recorded_at` et `updated_at` : horodatage serveur ;
- `ride_id` : clé primaire, donc une seule dernière position par course.

`publish_driver_location(ride_id, latitude, longitude, ...)` est la seule
écriture exposée au client authentifié. Le serveur dérive le chauffeur depuis
`auth.uid()`, vérifie son rôle, son état actif, son rattachement à la course et
le statut actif de celle-ci. Une position n'est lisible que par le passager ou
le chauffeur de cette course pendant les statuts `assigned`, `arriving`,
`arrived` et `in_progress`.

La migration additive `006_live_driver_location_freshness.sql` renforce cette
lecture : une position de plus de 60 secondes est filtrée par PostgreSQL. Le
service frontend applique le même TTL avant l'affichage et efface la position
sur une suppression Realtime ou dès que la course quitte un statut actif.

Une recherche `requested` ou `searching` peut être annulée par son passager via
`cancel_ride_search`. La RPC verrouille la course, ferme les offres encore
`offered`, passe la course à `cancelled` et écrit l'historique. Après expiration
du délai de recherche, `retry_ride_search` remet uniquement une course
`no_driver` à `requested`; le client relance ensuite la recherche normale.
Les migrations `007_dispatch_offer_cancellation.sql` puis
`008_cancel_ride_search.sql` doivent être appliquées dans cet ordre après la
migration 006.

La publication Realtime porte sur `rides`, `driver_locations` et
`ride_dispatch_offers`. La migration `009_driver_dispatch_realtime.sql` ajoute
la réception des offres côté chauffeur et la RPC sécurisée
`get_driver_active_offer()`, qui renvoie uniquement l'offre du chauffeur
connecté avec sa course associée. Avant de tester une offre réelle, suivre
[`staging-recette.md`](./staging-recette.md) : inventaire des migrations déjà appliquées
sur le projet de recette d'abord, aucune migration appliquée ou rejouée sans lui.

## Contrat frontend réutilisable

`geolocationService.js` masque l'API navigateur et expose :

- `getCurrentPosition(options)` ;
- `watchPosition(onSuccess, onError, options)` avec fonction d'arrêt.

`driverLocationService.js` publie vers la RPC et limite les écritures à une
position toutes les 3 secondes au maximum, en conservant uniquement la dernière
position en attente. En mode démo, aucune écriture Supabase n'est effectuée.

`rideRealtimeService.js` expose :

- `getRide(rideId)` ;
- `getActiveRide()` pour restaurer, après un refresh, la dernière course du
  passager dans un statut encore actif ou en attente de nouvelle tentative ;
- `getDriverLocation(rideId)` ;
- `subscribeToRide(rideId, handlers)`.
- `getActiveDriverOffer()` ;
- `subscribeToDriverOffers(handlers)`.

À l’ouverture de l’écran de course active, le client appelle d’abord
`getActiveRide()`. Le résultat serveur devient la source du `ride_id`, puis le
client charge la dernière position et s’abonne au canal Realtime de cette
course. Une course terminée, annulée ou absente redirige vers l’accueil ; une
course `no_driver` reste restaurable afin d’afficher la nouvelle tentative. Le
bouton d’annulation est rendu uniquement pour `requested` et `searching`, selon
le statut reçu du serveur.

React ne calcule pas de prix, n'impose pas de statut et ne choisit pas
l'identité du chauffeur. Zustand ne sert qu'à refléter le cache UI des données
retournées par les services.

## Cartographie

`MapProvider` accepte déjà le point d'extension `provider`. Le seul fournisseur
implémenté est `svg`. Une valeur non supportée retombe explicitement sur SVG via
`data-map-fallback="true"`. Le composant Google de 4B pourra remplacer cette
implémentation sans modifier les écrans consommateurs.

## Limites connues

Le parcours chauffeur réel affiche maintenant une offre active, la récupère
après un refresh, écoute les nouvelles offres Realtime et répond via
`respond_to_ride_offer`. Les montants, distances et notes restent affichés
comme indisponibles tant que le backend ne les retourne pas ; le frontend ne
fabrique pas ces valeurs.
