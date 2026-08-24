# TAGA Prototype — QA Follow-up Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Corriger l'écart trouvé en QA (tags de feedback manquants sur Fin de course) et lever le blocage de push GitLab, seuls points ouverts après validation des 16 écrans (voir `2026-08-24-taga-qa-report.md`).

**Architecture:** Pas de changement structurel — un ajout localisé dans un écran existant (état local + rendu), et une procédure opérationnelle (pas de code) pour le push.

**Tech Stack:** Identique au reste du prototype (React 19, Tailwind).

## Global Constraints

- Aucun test automatisé (scope du prototype, cf. spec UX).
- Vérifier `npm run build && npm run lint` après chaque tâche.
- **Coordination avec Codex** : avant de commencer la Tâche 1, vérifier `git status` — si `src/screens/client/RideEnd.jsx` est en cours d'édition par une autre session, attendre qu'elle committe avant de modifier ce fichier (fichier partagé, pas de répartition formelle actuellement).

---

## Tâche 1 — Tags de feedback rapide sur Fin de course

**Files:**
- Modify: `src/screens/client/RideEnd.jsx`

**Interfaces:**
- Consumes: aucune nouvelle dépendance (état local au composant, comme
  `rating`/`setRating` déjà présents dans le store).
- Produces: aucune interface exportée nouvelle — ajout purement visuel/état
  local `selectedTags`.

- [ ] **Step 1: Ajouter l'état local et la liste de tags**

Dans `src/screens/client/RideEnd.jsx`, ajouter en haut du fichier (à côté
des autres imports `useState` s'il n'est pas déjà importé) :

```jsx
import { useState } from 'react'
```

Puis dans le composant, avant le `return` :

```jsx
const TAGS = ['Conduite 🚗', 'À l\'heure 🕒', 'Voiture propre ✨']
const [selectedTags, setSelectedTags] = useState([])

const toggleTag = (tag) => {
  setSelectedTags((prev) =>
    prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
  )
}
```

- [ ] **Step 2: Ajouter les chips dans le rendu**

Insérer le bloc suivant juste après le composant `RatingStars` (sous la
ligne `<RatingStars value={rating} onChange={setRating} />`) :

```jsx
<div className="flex flex-wrap gap-2 mt-3">
  {TAGS.map((tag) => (
    <button
      key={tag}
      type="button"
      onClick={() => toggleTag(tag)}
      className={`text-xs font-semibold px-3 py-1.5 rounded-full border transition-colors ${
        selectedTags.includes(tag)
          ? 'bg-taga-green text-white border-taga-green'
          : 'bg-white text-gray-500 border-gray-200'
      }`}
    >
      {tag}
    </button>
  ))}
</div>
```

- [ ] **Step 3: Vérifier build + lint**

Run: `npm run build && npm run lint`
Expected: les deux réussissent sans erreur.

- [ ] **Step 4: Vérification visuelle**

Démarrer `npm run dev`, naviguer jusqu'à `/client/ride-end`. Attendu : 3
chips ("Conduite 🚗", "À l'heure 🕒", "Voiture propre ✨") sous les
étoiles, cliquables individuellement, bascule visuelle vert/blanc au clic.

- [ ] **Step 5: Commit**

```bash
git add src/screens/client/RideEnd.jsx
git commit -m "feat: add quick feedback tags to RideEnd screen (QA finding)"
```

---

## Tâche 2 — Débloquer le push GitLab

**Pas une tâche de code.** Prérequis pour toute suite (dispatch multi-agent
réel, sauvegarde du travail, phase FlutterFlow).

- [ ] **Step 1: Obtenir un PAT GitLab**

Demander à l'utilisateur un Personal Access Token GitLab avec le scope
`write_repository`, pour le projet `indxone-group/taga-prototype`.

- [ ] **Step 2: Configurer l'URL origin avec le PAT**

```bash
git remote set-url origin https://oauth2:<PAT>@gitlab.com/indxone-group/taga-prototype.git
```

- [ ] **Step 3: Pousser**

```bash
git push origin main
```

Expected: succès, plus de commits locaux en avance sur `origin/main`.

- [ ] **Step 4: Revert de l'URL pour ne pas laisser le PAT en clair dans `.git/config`** *(recommandé)*

Une fois le push réussi, envisager un credential helper (`git config
credential.helper store` ou équivalent) plutôt que de garder le PAT en
dur dans l'URL remote, pour éviter qu'il traîne dans un fichier local non
chiffré.

---

## Self-Review

**Couverture** : les deux seuls points ouverts identifiés en QA
(`2026-08-24-taga-qa-report.md`) sont couverts — le point emoji/tofu est
explicitement noté comme non-bug (pas de tâche associée, cf. rapport QA).
**Placeholders** : aucun.
**Cohérence des types** : `selectedTags`/`toggleTag` sont locaux au
composant, pas d'impact sur le store partagé ni sur d'autres écrans.
