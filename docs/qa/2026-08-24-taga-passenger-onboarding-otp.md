# QA — Onboarding passager et OTP

Date : 24 août 2026  
Périmètre : onboarding passager, routage du numéro de test et écran OTP  
Environnement : prototype React/Vite local

## Verdict

**Prototype validé pour les tests locaux, intégration SMS non validée.**

Le parcours passager accepte un numéro non vide en développement, remplace ce numéro par `+33 07 75 67 90 67` dans le store local, puis l’affiche comme destinataire de l’OTP. Le parcours chauffeur conserve son comportement existant.

Ce comportement ne déclenche pas encore de SMS : aucun fournisseur SMS ni appel Supabase n’est présent dans le prototype.

Dernière exécution : 24 août 2026 — `npm run build`, `npm run lint` et `git diff --check` passent.

## Cas de test

| ID | Scénario | Résultat attendu | Résultat actuel | Statut |
|---|---|---|---|---|
| QA-01 | Ouvrir `/` sans rôle | Le Splash redirige vers le choix de rôle | Route définie dans `src/App.jsx`, redirection par `Splash` | ✅ |
| QA-02 | Choisir « Passager » | Ouverture de `/onboarding` et rôle `passenger` | Implémenté dans `RoleChoice` | ✅ |
| QA-03 | Laisser le numéro vide | Le bouton reste désactivé | Validation passager sur valeur non vide | ✅ |
| QA-04 | Saisir n’importe quel numéro non vide en développement | Le bouton devient actif | `import.meta.env.DEV` autorise la saisie de test | ✅ |
| QA-05 | Continuer l’onboarding passager | Le numéro stocké devient `+330775679067` | `setPhone(DEV_TEST_PASSENGER_PHONE)` | ✅ |
| QA-06 | Arriver sur `/otp` | Le numéro de test est affiché comme destinataire | Lecture de `phone` depuis Zustand | ✅ |
| QA-07 | Saisir 6 chiffres | Le bouton « Vérifier » devient actif | `OtpInput` et validation `code.length === 6` | ✅ |
| QA-08 | Vérifier un code quelconque | Navigation vers `/client/home` | Navigation locale sans vérification serveur | ⚠️ simulation uniquement |
| QA-09 | Parcours chauffeur | Le numéro chauffeur n’est pas remplacé | Override limité à `role === 'passenger'` et `DEV` | ✅ |
| QA-10 | Build de production | Le numéro réel doit être conservé | Override désactivé quand `import.meta.env.DEV === false` | ✅ vérifié par le code |

## Contrôles automatisés

- `npm run build` : ✅
- `npm run lint` : ✅
- `git diff --check` : ✅
- Tests unitaires/e2e : ⚠️ aucun script de test n’est défini dans `package.json`.
- Smoke test navigateur : ⚠️ non exécuté dans cette session ; aucun outil navigateur pilotable n’est disponible.

## Points bloquants avant SMS réel

1. Aucun SMS n’est envoyé actuellement.
2. Le code OTP est accepté sans validation serveur.
3. Le numéro de test est présent côté client dans `useAppStore.js` ; il ne doit pas servir de mécanisme de sécurité.
4. Le téléphone est conservé uniquement en mémoire Zustand et n’est pas persisté dans une session d’authentification.
5. Le champ `PhoneInput` affiche encore l’indicatif CI `+225`, alors que le numéro de test est français.

## Risques accessibilité à traiter

- Les six champs OTP n’ont pas de libellé accessible individuel.
- `OtpInput` devrait exposer `autocomplete="one-time-code"` sur le premier champ.
- La QA clavier et lecteur d’écran n’a pas pu être exécutée sans navigateur pilotable.

## Limites de cette QA

Cette QA est statique et automatisée. Aucun screenshot ni test navigateur interactif n’a été capturé dans cette session, car aucun outil navigateur pilotable n’est disponible dans l’environnement courant. La réception réelle du SMS, les erreurs réseau, le rate limiting et la vérification Supabase restent donc à tester après implémentation backend.
