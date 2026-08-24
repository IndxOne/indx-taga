# TAGA — Qui réalise quoi concrètement

Date : 24 août 2026  
Périmètre : prototype local actuel et prochaine phase OTP/Supabase

## Situation actuelle

Le dispatch initial prévu entre plusieurs intervenants n’a pas été exécuté sur des branches séparées. Le prototype React, ses écrans, son routing et sa navigation sont déjà présents localement.

La prochaine étape réelle est le remplacement de la simulation OTP par une authentification téléphone Supabase et un fournisseur SMS.

## Tableau de responsabilité

| Intervenant | Responsabilité concrète | Livrables attendus | Zone de travail | Dépend de |
|---|---|---|---|---|
| Claude Code | Socle frontend du prototype | Écrans, composants, routing, store mocké, parcours client/chauffeur | `src/App.jsx`, `src/components/`, `src/screens/`, `src/store/` | Maquettes et backlog |
| Codex | QA technique et intégration frontend/backend | Client Supabase, appels OTP, états de chargement/erreur, tests du parcours onboarding/OTP, documentation QA | `src/`, `docs/qa/`, tests frontend | Contrat API et variables d’environnement |
| Copilot | Contrôle visuel et accessibilité | Revue responsive, navigation clavier, labels OTP, cohérence des écrans chauffeur/client, corrections UI ciblées | `src/components/`, `src/screens/`, QA visuelle | Prototype fonctionnel |
| Backend Supabase | Authentification et sécurité serveur | Auth téléphone, Edge Functions si nécessaires, normalisation E.164, rate limiting, vérification OTP, sessions | `supabase/functions/`, migrations, policies | Projet Supabase et fournisseur SMS |
| Fournisseur SMS | Transport des messages | Envoi réel des codes, statuts d’envoi, quotas et logs fournisseur | Configuration externe | Compte et clés validés |
| Product owner | Décisions métier et accès externes | Choix du fournisseur SMS, validation du numéro dev, secrets, critères d’acceptation, validation finale | Dashboard Supabase/SMS, GitLab | Proposition technique |

## Répartition de la prochaine phase OTP

| Étape | Responsable principal | Contribution | Critère de sortie |
|---|---|---|---|
| 1. Choisir et configurer le fournisseur SMS | Product owner + Backend Supabase | Fournir accès et variables secrètes ; configurer le provider | SMS de sandbox accepté |
| 2. Définir le contrat OTP | Backend Supabase | Définir `send`, `verify`, `resend`, erreurs et cooldown | Contrat documenté et stable |
| 3. Implémenter l’envoi et la vérification serveur | Backend Supabase | Auth téléphone, session, expiration, tentatives et rate limiting | Tests backend passants |
| 4. Déplacer le routage du numéro dev côté serveur | Backend Supabase | Override uniquement en environnement dev contrôlé | Aucun numéro de test exposé en production |
| 5. Brancher l’onboarding React | Codex | Remplacer le store local par les appels OTP ; gérer états et erreurs | `/onboarding` → `/otp` réel |
| 6. Finaliser accessibilité et responsive | Copilot | Labels, focus, OTP automatique, petits écrans et clavier | Revue UI validée |
| 7. Exécuter la QA complète | Codex + Product owner | Tests dev, staging et production simulée ; vérification réception SMS | QA sans bloquant |
| 8. Valider et pousser | Product owner | Revue finale, secrets configurés, push GitLab | Version acceptée et récupérable |

## Règles de collaboration

- Le backend ne doit pas être contourné par une validation OTP uniquement côté client.
- Le numéro de test doit être une configuration serveur de développement, jamais une règle métier embarquée dans le bundle de production.
- Une seule personne modifie le contrat OTP à la fois ; toute modification doit mettre à jour la QA et le plan.
- Les secrets restent hors Git et dans les variables d’environnement du fournisseur concerné.
- Chaque intervenant valide son périmètre avec un résultat reproductible avant transmission.

## Ordre d’exécution recommandé

1. Product owner : choix du fournisseur et accès Supabase.
2. Backend Supabase : contrat et implémentation OTP.
3. Codex : branchement frontend.
4. Copilot : revue visuelle/accessibilité.
5. Codex + Product owner : QA réelle avec réception du SMS.
6. Product owner : validation finale et push.

