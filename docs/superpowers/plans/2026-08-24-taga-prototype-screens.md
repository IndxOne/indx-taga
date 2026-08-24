# TAGA Prototype — Implémentation des 17 écrans (React) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Construire le prototype cliquable TAGA (11 écrans : choix de rôle, onboarding, parcours client à 4 écrans, parcours chauffeur à 5 écrans) dans le repo `taga-prototype`, avec données mockées en mémoire et navigation complète, fidèle aux maquettes et au spec UX approuvé.

**Architecture:** App React à page unique (SPA) avec React Router pour la navigation entre écrans, un store Zustand unique pour l'état partagé (rôle sélectionné, données de course/chauffeur mockées, statuts de course/disponibilité), et une bibliothèque de composants partagés stylés Tailwind (tokens `taga.navy/blue/green/mango` déjà configurés) réutilisés à travers les écrans. Chaque écran est un composant autonome dans `src/screens/`.

**Tech Stack:** React 19, Vite, React Router 6, Zustand 4, Tailwind CSS 3.

## Global Constraints

- Portée front-only : aucune donnée ne provient d'un réseau, tout est mocké en mémoire via le store Zustand (spec `docs/superpowers/specs/2026-08-24-taga-prototype-design.md`, section "Portée de ce prototype").
- 11 écrans exactement, ceux définis dans le spec UX approuvé : `RoleChoice` (hybride A+B), `Onboarding`, parcours client (`Home`, `Estimate`, `ActiveRide`, `RideEnd`), parcours chauffeur (`Online`, `IncomingRequest`, `Navigation`, `RideInProgress`, `PayoutRecap`). Le document `2026-08-24-taga-flutterflow-screens.md` (v4) sert uniquement de référence pour le contenu/les libellés des écrans qui se recoupent — ses écrans supplémentaires (Splash, OTP séparé, Compléter le profil, Profil, Historique, Moyens de paiement) et ses appels Edge Function/Supabase sont **hors scope** de ce plan.
- Aucun test automatisé (choix de scope explicite du spec). Chaque tâche est vérifiée par `npm run build` (erreurs de syntaxe/imports) et `npm run lint`, plus une vérification visuelle manuelle décrite dans chaque tâche (à confirmer via `npm run dev`).
- Couleurs : `taga.navy` (#0a1128), `taga.blue` (#0005D6), `taga.green` (#36AB52), `taga.mango` (#F97316) — déjà dans `tailwind.config.js`, ne pas en ajouter d'autres sans raison.
- Formatage monétaire : toujours `new Intl.NumberFormat('fr-FR').format(amount)` + suffixe `FCFA`/`F`, jamais de formatage ad hoc dupliqué.

---

## Vue d'ensemble des fichiers

```
src/
  store/
    useAppStore.js        # Task 1
  components/
    PhoneFrame.jsx         # Task 2
    PrimaryButton.jsx       # Task 3
    AmountTile.jsx          # Task 4
    RatingStars.jsx         # Task 5
    RoleCard.jsx             # Task 6
    PhoneInput.jsx           # Task 7
    MapView.jsx               # Task 8
    RideOptionCard.jsx        # Task 9
    DriverInfoCard.jsx        # Task 10
  screens/
    RoleChoice.jsx          # Task 11
    Onboarding.jsx           # Task 12
    client/
      Home.jsx                # Task 13
      Estimate.jsx             # Task 14
      ActiveRide.jsx            # Task 15
      RideEnd.jsx                # Task 16
    driver/
      Online.jsx                # Task 17
      IncomingRequest.jsx        # Task 18
      Navigation.jsx              # Task 19
      RideInProgress.jsx           # Task 20
      PayoutRecap.jsx                # Task 21
  App.jsx                   # Modified across Tasks 2, 11-21
```

---

### Task 1: Store Zustand (données mockées + état partagé)

**Files:**
- Create: `src/store/useAppStore.js`

**Interfaces:**
- Produces: `useAppStore` (default export nommé), hook Zustand avec l'état ci-dessous, utilisé par tous les écrans à partir de la Task 11.

- [ ] **Step 1: Créer le store avec les données mockées et les actions**

```js
// src/store/useAppStore.js
import { create } from 'zustand'

export const MOCK_DRIVER = {
  name: 'Mamadou Ndour',
  rating: 4.93,
  yearsExperience: 3,
  vehicle: { plate: 'TAGA-001', model: 'Ford Kia Rio', color: 'Blanc' },
}

export const MOCK_RIDE = {
  pickupLabel: 'Cocody, Riviera 3',
  pickupDetail: 'Rue M38, vers la station Total',
  dropoffLabel: 'Plateau, Imm. CAISTAB',
  distanceKm: 14.2,
  durationMin: 24,
  price: 3200,
  baseFare: 2600,
  distanceFee: 500,
  serviceFee: 100,
  driverEarning: 2720,
}

export const RIDE_OPTIONS = [
  { id: 'go', name: 'TAGA Go', badge: 'POPULAIRE', description: 'Standard · 4 pers. Corolla, Yaris...', price: 3200, originalPrice: 3800 },
  { id: 'partage', name: 'TAGA Partage', badge: '-40%', description: 'Covoiturage · 5 min d\'attente', price: 1900 },
  { id: 'family', name: 'TAGA Family', badge: null, description: 'Jusqu\'à 6 pers. Monospace', price: 4500 },
  { id: 'confort', name: 'TAGA Confort', badge: null, description: 'Premium · clim. Camry, Accord...', price: 4200 },
]

export const useAppStore = create((set) => ({
  role: null, // 'passenger' | 'driver'
  setRole: (role) => set({ role }),

  ride: MOCK_RIDE,
  driver: MOCK_DRIVER,

  selectedRideOptionId: 'go',
  setSelectedRideOptionId: (id) => set({ selectedRideOptionId: id }),

  rideStatus: 'idle', // idle | searching | driver_en_route | arrived | in_progress | completed
  setRideStatus: (rideStatus) => set({ rideStatus }),

  driverAvailable: false,
  setDriverAvailable: (driverAvailable) => set({ driverAvailable }),

  driverEarningsToday: 22400,
  driverRidesToday: 9,
  driverHoursOnline: '5h24',

  driverWalletBalance: 25120,
  creditRideEarning: (amount) =>
    set((state) => ({ driverWalletBalance: state.driverWalletBalance + amount })),

  rating: 0,
  setRating: (rating) => set({ rating }),
}))
```

- [ ] **Step 2: Vérifier la compilation**

Run: `npm run build`
Expected: build réussit sans erreur (le store n'est pas encore importé ailleurs, mais doit être syntaxiquement valide).

- [ ] **Step 3: Commit**

```bash
git add src/store/useAppStore.js
git commit -m "feat: add mocked app store (role, ride, driver state)"
```

---

### Task 2: Layout `PhoneFrame` + routing de base

**Files:**
- Create: `src/components/PhoneFrame.jsx`
- Modify: `src/App.jsx`

**Interfaces:**
- Consumes: rien.
- Produces: `PhoneFrame` (default export, prop `children`), routes React Router déclarées dans `App.jsx` : `/`, `/onboarding`, `/client/home`, `/client/estimate`, `/client/active-ride`, `/client/ride-end`, `/driver/online`, `/driver/incoming-request`, `/driver/navigation`, `/driver/ride-in-progress`, `/driver/payout-recap`. Chaque route pointe vers un composant stub minimal (remplacé écran par écran dans les tâches suivantes) créé inline dans ce fichier pour l'instant.

- [ ] **Step 1: Créer le composant `PhoneFrame`**

```jsx
// src/components/PhoneFrame.jsx
export default function PhoneFrame({ children }) {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center py-8 font-sans">
      <div className="w-full max-w-[430px] min-h-[700px] bg-white rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col">
        {children}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Installer le routing dans `App.jsx` avec des écrans stub temporaires**

```jsx
// src/App.jsx
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import PhoneFrame from './components/PhoneFrame'

function Stub({ name }) {
  return <div className="p-6 text-taga-navy font-semibold">{name} (à venir)</div>
}

function App() {
  return (
    <BrowserRouter>
      <PhoneFrame>
        <Routes>
          <Route path="/" element={<Stub name="Choix de rôle" />} />
          <Route path="/onboarding" element={<Stub name="Onboarding" />} />
          <Route path="/client/home" element={<Stub name="Accueil" />} />
          <Route path="/client/estimate" element={<Stub name="Estimation" />} />
          <Route path="/client/active-ride" element={<Stub name="Course active" />} />
          <Route path="/client/ride-end" element={<Stub name="Fin de course" />} />
          <Route path="/driver/online" element={<Stub name="En ligne" />} />
          <Route path="/driver/incoming-request" element={<Stub name="Demande entrante" />} />
          <Route path="/driver/navigation" element={<Stub name="Navigation" />} />
          <Route path="/driver/ride-in-progress" element={<Stub name="Course en cours" />} />
          <Route path="/driver/payout-recap" element={<Stub name="Récap & retrait" />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </PhoneFrame>
    </BrowserRouter>
  )
}

export default App
```

- [ ] **Step 3: Vérifier build + lint**

Run: `npm run build && npm run lint`
Expected: les deux commandes réussissent sans erreur.

- [ ] **Step 4: Vérification visuelle**

Run: `npm run dev`, ouvrir `http://localhost:5173/`, puis naviguer manuellement vers `/client/home` et `/driver/online` dans la barre d'adresse.
Attendu : le cadre de téléphone blanc centré s'affiche à chaque URL, avec le nom de l'écran correspondant.

- [ ] **Step 5: Commit**

```bash
git add src/components/PhoneFrame.jsx src/App.jsx
git commit -m "feat: add phone frame layout and route skeleton"
```

---

### Task 3: Composant `PrimaryButton`

**Files:**
- Create: `src/components/PrimaryButton.jsx`

**Interfaces:**
- Produces: `PrimaryButton` (default export), props `{ children, onClick, variant = 'navy' | 'green' | 'mango', disabled = false, type = 'button' | 'submit' }`.

- [ ] **Step 1: Créer le composant**

```jsx
// src/components/PrimaryButton.jsx
const VARIANTS = {
  navy: 'bg-taga-navy text-white',
  green: 'bg-taga-green text-white',
  mango: 'bg-taga-mango text-white',
}

export default function PrimaryButton({ children, onClick, variant = 'navy', disabled = false, type = 'button' }) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`w-full py-4 rounded-xl font-semibold text-base transition-opacity disabled:opacity-40 disabled:cursor-not-allowed ${VARIANTS[variant]}`}
    >
      {children}
    </button>
  )
}
```

- [ ] **Step 2: Vérifier build**

Run: `npm run build`
Expected: build réussit.

- [ ] **Step 3: Commit**

```bash
git add src/components/PrimaryButton.jsx
git commit -m "feat: add PrimaryButton shared component"
```

---

### Task 4: Composant `AmountTile`

**Files:**
- Create: `src/components/AmountTile.jsx`

**Interfaces:**
- Produces: `AmountTile` (default export), props `{ label, amount, size = 'md' | 'xl', tone = 'default' | 'light' }`.

- [ ] **Step 1: Créer le composant**

```jsx
// src/components/AmountTile.jsx
const SIZES = { md: 'text-lg', xl: 'text-4xl' }
const TONES = { default: 'text-gray-900', light: 'text-white' }

export default function AmountTile({ label, amount, size = 'md', tone = 'default' }) {
  const formatted = new Intl.NumberFormat('fr-FR').format(amount)
  return (
    <div>
      {label && <p className="text-xs uppercase tracking-wide text-gray-400 mb-1">{label}</p>}
      <p className={`font-bold ${SIZES[size]} ${TONES[tone]}`}>
        {formatted} <span className="text-sm font-normal">FCFA</span>
      </p>
    </div>
  )
}
```

- [ ] **Step 2: Vérifier build**

Run: `npm run build`
Expected: build réussit.

- [ ] **Step 3: Commit**

```bash
git add src/components/AmountTile.jsx
git commit -m "feat: add AmountTile shared component"
```

---

### Task 5: Composant `RatingStars`

**Files:**
- Create: `src/components/RatingStars.jsx`

**Interfaces:**
- Produces: `RatingStars` (default export), props `{ value: number, onChange?: (n: number) => void, readOnly = false }`.

- [ ] **Step 1: Créer le composant**

```jsx
// src/components/RatingStars.jsx
import { useState } from 'react'

export default function RatingStars({ value, onChange, readOnly = false }) {
  const [hover, setHover] = useState(0)
  const display = hover || value

  return (
    <div className="flex gap-2">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          disabled={readOnly}
          onClick={() => onChange?.(star)}
          onMouseEnter={() => !readOnly && setHover(star)}
          onMouseLeave={() => !readOnly && setHover(0)}
          className={`w-10 h-10 rounded-full flex items-center justify-center text-lg ${
            star <= display ? 'bg-taga-green text-white' : 'bg-gray-100 text-gray-400'
          }`}
        >
          ★
        </button>
      ))}
    </div>
  )
}
```

- [ ] **Step 2: Vérifier build**

Run: `npm run build`
Expected: build réussit.

- [ ] **Step 3: Commit**

```bash
git add src/components/RatingStars.jsx
git commit -m "feat: add RatingStars shared component"
```

---

### Task 6: Composant `RoleCard`

**Files:**
- Create: `src/components/RoleCard.jsx`

**Interfaces:**
- Produces: `RoleCard` (default export), props `{ icon, badge, badgeColor = 'bg-taga-mango', title, subtitle, onSelect }`.

- [ ] **Step 1: Créer le composant**

```jsx
// src/components/RoleCard.jsx
export default function RoleCard({ icon, badge, badgeColor = 'bg-taga-mango', title, subtitle, onSelect }) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className="w-full text-left bg-white/10 hover:bg-white/15 rounded-2xl p-5 flex items-start gap-4 transition-colors"
    >
      <div className="w-12 h-12 rounded-xl bg-white/10 flex items-center justify-center text-2xl shrink-0">
        {icon}
      </div>
      <div className="flex-1">
        <span className={`inline-block text-xs font-semibold text-white px-2 py-0.5 rounded-full mb-2 ${badgeColor}`}>
          {badge}
        </span>
        <h3 className="text-white font-bold text-lg">{title}</h3>
        <p className="text-white/70 text-sm mt-1">{subtitle}</p>
      </div>
      <span className="text-white/50 text-xl self-center">→</span>
    </button>
  )
}
```

- [ ] **Step 2: Vérifier build**

Run: `npm run build`
Expected: build réussit.

- [ ] **Step 3: Commit**

```bash
git add src/components/RoleCard.jsx
git commit -m "feat: add RoleCard shared component"
```

---

### Task 7: Composant `PhoneInput`

**Files:**
- Create: `src/components/PhoneInput.jsx`

**Interfaces:**
- Produces: `PhoneInput` (default export), props `{ value: string, onChange: (value: string) => void }`.

- [ ] **Step 1: Créer le composant**

```jsx
// src/components/PhoneInput.jsx
export default function PhoneInput({ value, onChange }) {
  return (
    <div className="flex items-center gap-2 border border-gray-200 rounded-xl px-4 py-3">
      <span className="text-sm text-gray-500 shrink-0">🇨🇮 +225</span>
      <input
        type="tel"
        inputMode="numeric"
        placeholder="07 07 12 34 56"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="flex-1 outline-none text-base"
      />
    </div>
  )
}
```

- [ ] **Step 2: Vérifier build**

Run: `npm run build`
Expected: build réussit.

- [ ] **Step 3: Commit**

```bash
git add src/components/PhoneInput.jsx
git commit -m "feat: add PhoneInput shared component"
```

---

### Task 8: Composant `MapView` (mock statique)

**Files:**
- Create: `src/components/MapView.jsx`

**Interfaces:**
- Produces: `MapView` (default export), props `{ children?, className = '' }` — fond quadrillé statique simulant une carte, `children` positionnés par-dessus (marqueurs, tracés) par l'appelant via `className` (ex. `absolute`).

- [ ] **Step 1: Créer le composant**

```jsx
// src/components/MapView.jsx
export default function MapView({ children, className = '' }) {
  return (
    <div
      className={`relative overflow-hidden bg-gray-100 ${className}`}
      style={{
        backgroundImage:
          'linear-gradient(to right, #e5e7eb 1px, transparent 1px), linear-gradient(to bottom, #e5e7eb 1px, transparent 1px)',
        backgroundSize: '24px 24px',
      }}
    >
      {children}
    </div>
  )
}
```

- [ ] **Step 2: Vérifier build**

Run: `npm run build`
Expected: build réussit.

- [ ] **Step 3: Commit**

```bash
git add src/components/MapView.jsx
git commit -m "feat: add MapView mock component"
```

---

### Task 9: Composant `RideOptionCard`

**Files:**
- Create: `src/components/RideOptionCard.jsx`

**Interfaces:**
- Consumes : forme des objets de `RIDE_OPTIONS` (Task 1) : `{ id, name, badge, description, price, originalPrice? }`.
- Produces: `RideOptionCard` (default export), props `{ name, badge, description, price, originalPrice, selected, onSelect }`.

- [ ] **Step 1: Créer le composant**

```jsx
// src/components/RideOptionCard.jsx
export default function RideOptionCard({ name, badge, description, price, originalPrice, selected, onSelect }) {
  const formatted = (n) => new Intl.NumberFormat('fr-FR').format(n)
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`w-full text-left border-2 rounded-xl p-4 flex items-center gap-3 transition-colors ${
        selected ? 'border-taga-blue bg-taga-blue/5' : 'border-gray-100'
      }`}
    >
      <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center text-xl shrink-0">🚗</div>
      <div className="flex-1">
        <div className="flex items-center gap-2">
          <span className="font-semibold">{name}</span>
          {badge && (
            <span className="text-xs font-semibold text-taga-green bg-taga-green/10 px-2 py-0.5 rounded-full">
              {badge}
            </span>
          )}
        </div>
        <p className="text-sm text-gray-500">{description}</p>
      </div>
      <div className="text-right shrink-0">
        {originalPrice && <p className="text-xs text-gray-400 line-through">{formatted(originalPrice)} F</p>}
        <p className="font-bold">{formatted(price)} F</p>
      </div>
    </button>
  )
}
```

- [ ] **Step 2: Vérifier build**

Run: `npm run build`
Expected: build réussit.

- [ ] **Step 3: Commit**

```bash
git add src/components/RideOptionCard.jsx
git commit -m "feat: add RideOptionCard shared component"
```

---

### Task 10: Composant `DriverInfoCard`

**Files:**
- Create: `src/components/DriverInfoCard.jsx`

**Interfaces:**
- Consumes: forme de `MOCK_DRIVER` (Task 1) : `{ name, rating, yearsExperience, vehicle: { plate, model, color } }`.
- Produces: `DriverInfoCard` (default export), props `{ driver }`.

- [ ] **Step 1: Créer le composant**

```jsx
// src/components/DriverInfoCard.jsx
export default function DriverInfoCard({ driver }) {
  const initials = driver.name
    .split(' ')
    .map((part) => part[0])
    .join('')
    .slice(0, 2)

  return (
    <div className="bg-white rounded-2xl p-4 shadow-lg">
      <div className="flex items-center gap-3">
        <div className="w-12 h-12 rounded-full bg-taga-blue text-white flex items-center justify-center font-bold shrink-0">
          {initials}
        </div>
        <div className="flex-1">
          <p className="font-bold">{driver.name}</p>
          <p className="text-sm text-gray-500">
            ★ {driver.rating} · {driver.yearsExperience} ans
          </p>
        </div>
        <button type="button" aria-label="Message" className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center">
          💬
        </button>
        <button type="button" aria-label="Appeler" className="w-10 h-10 rounded-full bg-taga-green text-white flex items-center justify-center">
          📞
        </button>
      </div>
      <div className="mt-3 pt-3 border-t border-gray-100 flex items-center justify-between text-sm">
        <span className="text-gray-500">Véhicule</span>
        <span className="font-semibold">
          {driver.vehicle.model} · {driver.vehicle.color}
        </span>
        <span className="text-xs font-mono border border-gray-200 rounded px-2 py-0.5">{driver.vehicle.plate}</span>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Vérifier build**

Run: `npm run build`
Expected: build réussit.

- [ ] **Step 3: Commit**

```bash
git add src/components/DriverInfoCard.jsx
git commit -m "feat: add DriverInfoCard shared component"
```

---

### Task 11: Écran `RoleChoice` (hybride A+B)

**Files:**
- Create: `src/screens/RoleChoice.jsx`
- Modify: `src/App.jsx` (remplacer la route `/` par le vrai composant)

**Interfaces:**
- Consumes: `useAppStore` (`setRole`), `RoleCard`, `PrimaryButton` (aucun `PrimaryButton` réellement requis ici — le bouton "Continuer" est intégré à `RoleCard`).
- Produces: `RoleChoice` (default export), navigue vers `/onboarding` après sélection.

- [ ] **Step 1: Créer l'écran**

```jsx
// src/screens/RoleChoice.jsx
import { useNavigate } from 'react-router-dom'
import { useAppStore } from '../store/useAppStore'
import RoleCard from '../components/RoleCard'

export default function RoleChoice() {
  const navigate = useNavigate()
  const setRole = useAppStore((state) => state.setRole)

  const selectRole = (role) => {
    setRole(role)
    navigate('/onboarding')
  }

  return (
    <div className="flex-1 bg-taga-navy px-5 py-8 flex flex-col">
      <div className="text-center mb-8">
        <div className="w-10 h-10 mx-auto rounded-lg bg-white/10 text-white flex items-center justify-center font-bold mb-3">
          T
        </div>
        <p className="text-white/60 text-xs">ABIDJAN</p>
        <h1 className="text-white text-2xl font-bold mt-3">Bienvenue.</h1>
        <p className="text-taga-mango text-2xl font-bold">Tu es ici pour quoi ?</p>
      </div>

      <div className="flex flex-col gap-4">
        <RoleCard
          icon="🚕"
          badge="PASSAGER"
          badgeColor="bg-taga-mango"
          title="Je commande une course"
          subtitle="Trouve un VTC ou rejoins un covoiturage"
          onSelect={() => selectRole('passenger')}
        />
        <RoleCard
          icon="🚗"
          badge="CHAUFFEUR"
          badgeColor="bg-taga-green"
          title="Je suis chauffeur"
          subtitle="85% net · Retrait instantané"
          onSelect={() => selectRole('driver')}
        />
      </div>

      <p className="text-white/40 text-xs text-center mt-auto pt-8">Tu peux changer plus tard dans ton profil.</p>
    </div>
  )
}
```

- [ ] **Step 2: Câbler la route dans `App.jsx`**

Dans `src/App.jsx`, ajouter l'import `import RoleChoice from './screens/RoleChoice'` et remplacer `<Route path="/" element={<Stub name="Choix de rôle" />} />` par `<Route path="/" element={<RoleChoice />} />`.

- [ ] **Step 3: Vérifier build + lint**

Run: `npm run build && npm run lint`
Expected: les deux réussissent.

- [ ] **Step 4: Vérification visuelle**

Run: `npm run dev`, ouvrir `http://localhost:5173/`.
Attendu : fond navy, les deux cartes passager/chauffeur visibles sans scroll, la carte chauffeur affiche "85% net · Retrait instantané". Cliquer sur une carte navigue vers `/onboarding` (stub à ce stade).

- [ ] **Step 5: Commit**

```bash
git add src/screens/RoleChoice.jsx src/App.jsx
git commit -m "feat: implement RoleChoice screen (hybrid A+B)"
```

---

### Task 12: Écran `Onboarding`

**Files:**
- Create: `src/screens/Onboarding.jsx`
- Modify: `src/App.jsx`

**Interfaces:**
- Consumes: `useAppStore` (`role`), `PhoneInput`, `PrimaryButton`.
- Produces: `Onboarding` (default export), navigue vers `/client/home` si `role === 'passenger'`, sinon `/driver/online`.

- [ ] **Step 1: Créer l'écran**

```jsx
// src/screens/Onboarding.jsx
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAppStore } from '../store/useAppStore'
import PhoneInput from '../components/PhoneInput'
import PrimaryButton from '../components/PrimaryButton'

export default function Onboarding() {
  const navigate = useNavigate()
  const role = useAppStore((state) => state.role)
  const [phone, setPhone] = useState('')

  const isValid = phone.replace(/\D/g, '').length >= 10

  const handleContinue = () => {
    navigate(role === 'driver' ? '/driver/online' : '/client/home')
  }

  return (
    <div className="flex-1 bg-gradient-to-b from-taga-blue to-taga-navy px-5 py-8 flex flex-col text-white">
      <div className="flex items-center gap-2 mb-8">
        <span className="text-taga-green text-2xl">⊤</span>
        <span className="font-bold text-lg">aga</span>
      </div>

      <h1 className="text-3xl font-bold leading-tight">Déplacez-vous en toute simplicité.</h1>
      <p className="text-white/70 mt-3 text-sm">VTC à Abidjan. Chauffeurs professionnels, prix abordables, service rapide.</p>

      <div className="mt-auto pt-8">
        <p className="text-xs text-white/60 mb-2">TON NUMÉRO</p>
        <div className="bg-white rounded-xl text-gray-900">
          <PhoneInput value={phone} onChange={setPhone} />
        </div>
        <div className="mt-4">
          <PrimaryButton variant="green" disabled={!isValid} onClick={handleContinue}>
            Recevoir le code SMS
          </PrimaryButton>
        </div>
        <p className="text-xs text-white/50 text-center mt-3">
          En continuant tu acceptes les Conditions et la Politique de confidentialité.
        </p>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Câbler la route dans `App.jsx`**

Remplacer `<Route path="/onboarding" element={<Stub name="Onboarding" />} />` par `<Route path="/onboarding" element={<Onboarding />} />`, ajouter l'import correspondant.

- [ ] **Step 3: Vérifier build + lint**

Run: `npm run build && npm run lint`
Expected: les deux réussissent.

- [ ] **Step 4: Vérification visuelle**

Run: `npm run dev`, aller sur `/` puis choisir "Je commande une course".
Attendu : écran Onboarding avec dégradé bleu/navy, champ téléphone, bouton désactivé tant que le numéro est incomplet. Saisir un numéro valide puis cliquer "Recevoir le code SMS" → navigation vers `/client/home` (stub à ce stade). Répéter en partant du rôle chauffeur → navigation vers `/driver/online`.

- [ ] **Step 5: Commit**

```bash
git add src/screens/Onboarding.jsx src/App.jsx
git commit -m "feat: implement Onboarding screen"
```

---

### Task 13: Écran client `Home` (Accueil)

**Files:**
- Create: `src/screens/client/Home.jsx`
- Modify: `src/App.jsx`

**Interfaces:**
- Consumes: `useAppStore` (`ride.pickupLabel` réutilisé comme position actuelle), `MapView`.
- Produces: `Home` (default export), navigue vers `/client/estimate`.

- [ ] **Step 1: Créer l'écran**

```jsx
// src/screens/client/Home.jsx
import { useNavigate } from 'react-router-dom'
import MapView from '../../components/MapView'

const FAVORITES = [
  { icon: '🏠', label: 'Maison', sub: 'Cocody · Riviera 3' },
  { icon: '💼', label: 'Bureau', sub: 'Plateau · Tour CAISTAB' },
  { icon: '✈️', label: 'Aéroport FHB', sub: 'Port-Bouët · 23 km' },
]

export default function Home() {
  const navigate = useNavigate()

  return (
    <div className="flex-1 flex flex-col">
      <MapView className="h-64 shrink-0" />

      <div className="flex-1 bg-white -mt-6 rounded-t-3xl px-5 py-6 flex flex-col gap-5">
        <div>
          <h1 className="text-xl font-bold">Bonjour Akissi 👋</h1>
          <p className="text-gray-500 text-sm">Où on va aujourd'hui ?</p>
        </div>

        <button
          type="button"
          onClick={() => navigate('/client/estimate')}
          className="border border-gray-200 rounded-xl px-4 py-3 text-left text-gray-400 flex items-center justify-between"
        >
          <span>Saisir une destination...</span>
          <span className="text-taga-blue text-sm font-semibold">Tap →</span>
        </button>

        <div className="flex flex-col gap-3">
          {FAVORITES.map((fav) => (
            <button
              key={fav.label}
              type="button"
              onClick={() => navigate('/client/estimate')}
              className="flex items-center gap-3 text-left"
            >
              <span className="w-9 h-9 rounded-lg bg-gray-100 flex items-center justify-center">{fav.icon}</span>
              <span>
                <p className="font-semibold text-sm">{fav.label}</p>
                <p className="text-xs text-gray-400">{fav.sub}</p>
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Câbler la route dans `App.jsx`**

Remplacer `<Route path="/client/home" element={<Stub name="Accueil" />} />` par le vrai composant, ajouter l'import.

- [ ] **Step 3: Vérifier build + lint**

Run: `npm run build && npm run lint`
Expected: les deux réussissent.

- [ ] **Step 4: Vérification visuelle**

Run: `npm run dev`, naviguer jusqu'à `/client/home` (via le flow rôle passager → onboarding).
Attendu : carte grise en haut, panneau blanc arrondi avec salutation, barre de destination et 3 favoris. Cliquer sur la barre ou un favori navigue vers `/client/estimate`.

- [ ] **Step 5: Commit**

```bash
git add src/screens/client/Home.jsx src/App.jsx
git commit -m "feat: implement client Home screen"
```

---

### Task 14: Écran client `Estimate` (Estimation)

**Files:**
- Create: `src/screens/client/Estimate.jsx`
- Modify: `src/App.jsx`

**Interfaces:**
- Consumes: `useAppStore` (`ride`, `RIDE_OPTIONS`, `selectedRideOptionId`, `setSelectedRideOptionId`, `setRideStatus`), `MapView`, `RideOptionCard`, `PrimaryButton`.
- Produces: `Estimate` (default export), au clic "Commander" : `setRideStatus('searching')` puis navigue vers `/client/active-ride`.

- [ ] **Step 1: Créer l'écran**

```jsx
// src/screens/client/Estimate.jsx
import { useNavigate } from 'react-router-dom'
import { useAppStore, RIDE_OPTIONS } from '../../store/useAppStore'
import MapView from '../../components/MapView'
import RideOptionCard from '../../components/RideOptionCard'
import PrimaryButton from '../../components/PrimaryButton'

export default function Estimate() {
  const navigate = useNavigate()
  const ride = useAppStore((state) => state.ride)
  const selectedId = useAppStore((state) => state.selectedRideOptionId)
  const setSelectedId = useAppStore((state) => state.setSelectedRideOptionId)
  const setRideStatus = useAppStore((state) => state.setRideStatus)

  const selectedOption = RIDE_OPTIONS.find((option) => option.id === selectedId)

  const handleOrder = () => {
    setRideStatus('searching')
    navigate('/client/active-ride')
  }

  return (
    <div className="flex-1 flex flex-col">
      <MapView className="h-48 shrink-0" />

      <div className="flex-1 bg-white -mt-6 rounded-t-3xl px-5 py-6 flex flex-col gap-4 overflow-y-auto">
        <div>
          <p className="text-xs text-gray-400 uppercase">Choisis ta course</p>
          <p className="font-bold">
            {ride.distanceKm} km · ~{ride.durationMin} min
          </p>
          <p className="text-xs text-gray-400">
            {ride.pickupLabel} → {ride.dropoffLabel}
          </p>
        </div>

        <div className="flex flex-col gap-3">
          {RIDE_OPTIONS.map((option) => (
            <RideOptionCard
              key={option.id}
              name={option.name}
              badge={option.badge}
              description={option.description}
              price={option.price}
              originalPrice={option.originalPrice}
              selected={option.id === selectedId}
              onSelect={() => setSelectedId(option.id)}
            />
          ))}
        </div>

        <div className="mt-auto pt-2">
          <PrimaryButton onClick={handleOrder} disabled={!selectedOption}>
            Commander · {new Intl.NumberFormat('fr-FR').format(selectedOption?.price ?? 0)} F CFA
          </PrimaryButton>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Câbler la route dans `App.jsx`**

Remplacer `<Route path="/client/estimate" element={<Stub name="Estimation" />} />` par le vrai composant, ajouter l'import.

- [ ] **Step 3: Vérifier build + lint**

Run: `npm run build && npm run lint`
Expected: les deux réussissent.

- [ ] **Step 4: Vérification visuelle**

Run: `npm run dev`, naviguer jusqu'à `/client/estimate`.
Attendu : 4 options de course listées (Go, Partage, Family, Confort), sélection visuelle au clic, bouton "Commander" affiche le prix de l'option sélectionnée et navigue vers `/client/active-ride`.

- [ ] **Step 5: Commit**

```bash
git add src/screens/client/Estimate.jsx src/App.jsx
git commit -m "feat: implement client Estimate screen"
```

---

### Task 15: Écran client `ActiveRide` (Course active)

**Files:**
- Create: `src/screens/client/ActiveRide.jsx`
- Modify: `src/App.jsx`

**Interfaces:**
- Consumes: `useAppStore` (`ride`, `driver`, `rideStatus`, `setRideStatus`), `MapView`, `DriverInfoCard`.
- Produces: `ActiveRide` (default export). Un bouton "Simuler l'arrivée" fait progresser `rideStatus` (`searching` → `driver_en_route` → `arrived` → `in_progress`) puis navigue vers `/client/ride-end` une fois `in_progress` atteint (simulation manuelle, pas de timer — le prototype n'a pas de vraie temporisation).

- [ ] **Step 1: Créer l'écran**

```jsx
// src/screens/client/ActiveRide.jsx
import { useNavigate } from 'react-router-dom'
import { useAppStore } from '../../store/useAppStore'
import MapView from '../../components/MapView'
import DriverInfoCard from '../../components/DriverInfoCard'
import PrimaryButton from '../../components/PrimaryButton'

const STATUS_LABEL = {
  searching: 'Recherche d\'un chauffeur...',
  driver_en_route: 'Chauffeur en approche · 3 min',
  arrived: 'Chauffeur arrivé',
  in_progress: 'Course en cours',
}

const NEXT_STATUS = {
  searching: 'driver_en_route',
  driver_en_route: 'arrived',
  arrived: 'in_progress',
}

export default function ActiveRide() {
  const navigate = useNavigate()
  const ride = useAppStore((state) => state.ride)
  const driver = useAppStore((state) => state.driver)
  const rideStatus = useAppStore((state) => state.rideStatus)
  const setRideStatus = useAppStore((state) => state.setRideStatus)

  const advance = () => {
    const next = NEXT_STATUS[rideStatus]
    if (next) {
      setRideStatus(next)
      if (next === 'in_progress') {
        navigate('/client/ride-end')
      }
    }
  }

  return (
    <div className="flex-1 flex flex-col">
      <div className="bg-taga-green text-white text-sm font-semibold text-center py-2">
        {STATUS_LABEL[rideStatus] ?? STATUS_LABEL.searching}
      </div>

      <MapView className="h-64 shrink-0" />

      <div className="flex-1 bg-white -mt-6 rounded-t-3xl px-5 py-6 flex flex-col gap-4">
        <DriverInfoCard driver={driver} />

        <div className="text-sm text-gray-600 flex flex-col gap-1">
          <p>
            <span className="text-taga-green font-semibold">●</span> {ride.pickupLabel} — {ride.pickupDetail}
          </p>
          <p>
            <span className="text-taga-navy font-semibold">■</span> {ride.dropoffLabel}
          </p>
        </div>

        <div className="mt-auto">
          <PrimaryButton variant="green" onClick={advance}>
            Simuler arrivée →
          </PrimaryButton>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Câbler la route dans `App.jsx`**

Remplacer `<Route path="/client/active-ride" element={<Stub name="Course active" />} />` par le vrai composant, ajouter l'import.

- [ ] **Step 3: Vérifier build + lint**

Run: `npm run build && npm run lint`
Expected: les deux réussissent.

- [ ] **Step 4: Vérification visuelle**

Run: `npm run dev`, naviguer jusqu'à `/client/active-ride` (via Estimate → Commander).
Attendu : bandeau vert avec le statut courant, infos chauffeur (Mamadou Ndour) visibles. Cliquer "Simuler arrivée →" trois fois fait progresser le statut puis navigue vers `/client/ride-end`.

- [ ] **Step 5: Commit**

```bash
git add src/screens/client/ActiveRide.jsx src/App.jsx
git commit -m "feat: implement client ActiveRide screen"
```

---

### Task 16: Écran client `RideEnd` (Fin de course)

**Files:**
- Create: `src/screens/client/RideEnd.jsx`
- Modify: `src/App.jsx`

**Interfaces:**
- Consumes: `useAppStore` (`ride`, `driver`, `rating`, `setRating`, `setRideStatus`), `AmountTile`, `RatingStars`, `PrimaryButton`.
- Produces: `RideEnd` (default export). Au clic "Envoyer & terminer" : `setRideStatus('completed')`, `setRating(0)` (reset pour une prochaine simulation), navigue vers `/client/home`.

- [ ] **Step 1: Créer l'écran**

```jsx
// src/screens/client/RideEnd.jsx
import { useNavigate } from 'react-router-dom'
import { useAppStore } from '../../store/useAppStore'
import AmountTile from '../../components/AmountTile'
import RatingStars from '../../components/RatingStars'
import PrimaryButton from '../../components/PrimaryButton'

export default function RideEnd() {
  const navigate = useNavigate()
  const ride = useAppStore((state) => state.ride)
  const driver = useAppStore((state) => state.driver)
  const rating = useAppStore((state) => state.rating)
  const setRating = useAppStore((state) => state.setRating)
  const setRideStatus = useAppStore((state) => state.setRideStatus)

  const handleFinish = () => {
    setRideStatus('completed')
    setRating(0)
    navigate('/client/home')
  }

  return (
    <div className="flex-1 px-5 py-8 flex flex-col gap-5">
      <div className="text-center">
        <div className="w-16 h-16 mx-auto rounded-2xl bg-taga-green text-white flex items-center justify-center text-3xl">✓</div>
        <h1 className="font-bold text-xl mt-3">Arrivé à bon port ✨</h1>
      </div>

      <div className="bg-gray-50 rounded-2xl p-4 flex flex-col gap-2">
        <AmountTile label="Total payé" amount={ride.price} size="xl" />
        <div className="text-sm text-gray-500 flex justify-between">
          <span>Course de base</span>
          <span>{new Intl.NumberFormat('fr-FR').format(ride.baseFare)} F</span>
        </div>
        <div className="text-sm text-gray-500 flex justify-between">
          <span>Distance · {ride.distanceKm} km</span>
          <span>{new Intl.NumberFormat('fr-FR').format(ride.distanceFee)} F</span>
        </div>
        <div className="text-sm text-gray-500 flex justify-between">
          <span>Frais de service</span>
          <span>{new Intl.NumberFormat('fr-FR').format(ride.serviceFee)} F</span>
        </div>
      </div>

      <div>
        <p className="text-sm text-gray-500 mb-2">Comment s'est passée la course avec {driver.name} ?</p>
        <RatingStars value={rating} onChange={setRating} />
      </div>

      <div className="mt-auto flex flex-col gap-3">
        <button type="button" className="text-taga-navy text-sm font-semibold border border-gray-200 rounded-xl py-3">
          Reçu PDF
        </button>
        <PrimaryButton onClick={handleFinish} disabled={rating === 0}>
          Envoyer & terminer
        </PrimaryButton>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Câbler la route dans `App.jsx`**

Remplacer `<Route path="/client/ride-end" element={<Stub name="Fin de course" />} />` par le vrai composant, ajouter l'import.

- [ ] **Step 3: Vérifier build + lint**

Run: `npm run build && npm run lint`
Expected: les deux réussissent.

- [ ] **Step 4: Vérification visuelle**

Run: `npm run dev`, naviguer jusqu'à `/client/ride-end` (via ActiveRide → 3x "Simuler arrivée").
Attendu : récapitulatif de prix avec le détail (base/distance/frais), sélecteur d'étoiles, bouton "Envoyer & terminer" désactivé tant qu'aucune étoile n'est choisie, navigue vers `/client/home` une fois noté.

- [ ] **Step 5: Commit**

```bash
git add src/screens/client/RideEnd.jsx src/App.jsx
git commit -m "feat: implement client RideEnd screen"
```

---

### Task 17: Écran chauffeur `Online` (En ligne)

**Files:**
- Create: `src/screens/driver/Online.jsx`
- Modify: `src/App.jsx`

**Interfaces:**
- Consumes: `useAppStore` (`driverAvailable`, `setDriverAvailable`, `driverEarningsToday`, `driverRidesToday`, `driverHoursOnline`), `MapView`, `PrimaryButton`.
- Produces: `Online` (default export). Le bouton "Simuler →" (visible seulement si `driverAvailable`) navigue vers `/driver/incoming-request`.

- [ ] **Step 1: Créer l'écran**

```jsx
// src/screens/driver/Online.jsx
import { useNavigate } from 'react-router-dom'
import { useAppStore } from '../../store/useAppStore'
import MapView from '../../components/MapView'
import AmountTile from '../../components/AmountTile'

export default function Online() {
  const navigate = useNavigate()
  const driverAvailable = useAppStore((state) => state.driverAvailable)
  const setDriverAvailable = useAppStore((state) => state.setDriverAvailable)
  const driverEarningsToday = useAppStore((state) => state.driverEarningsToday)
  const driverRidesToday = useAppStore((state) => state.driverRidesToday)
  const driverHoursOnline = useAppStore((state) => state.driverHoursOnline)

  return (
    <div className="flex-1 flex flex-col">
      <div className="px-5 py-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-full bg-taga-mango text-white flex items-center justify-center font-bold">YA</div>
          <div>
            <p className="text-xs text-gray-400">BONJOUR, CHEF</p>
            <p className="font-bold text-sm">Yao Aristide</p>
          </div>
        </div>
        {driverAvailable && (
          <span className="text-xs font-semibold text-taga-green flex items-center gap-1">● EN LIGNE</span>
        )}
      </div>

      <MapView className="flex-1" />

      <div className="bg-taga-navy text-white rounded-t-3xl -mt-6 px-5 py-5 flex flex-col gap-4">
        <div className="flex justify-between items-start">
          <div>
            <p className="text-xs text-white/50">TES GAINS AUJOURD'HUI</p>
            <AmountTile amount={driverEarningsToday} size="xl" tone="light" />
          </div>
        </div>
        <p className="text-xs text-white/60">
          Courses · {driverRidesToday} · En ligne · {driverHoursOnline}
        </p>

        <div className="flex items-center justify-between bg-white/10 rounded-xl px-4 py-3">
          <label className="flex items-center gap-3 text-sm font-medium" htmlFor="availability-toggle">
            <input
              id="availability-toggle"
              type="checkbox"
              checked={driverAvailable}
              onChange={(e) => setDriverAvailable(e.target.checked)}
              className="w-5 h-5 accent-taga-green"
            />
            Disponible pour course
          </label>
          {driverAvailable && (
            <button
              type="button"
              onClick={() => navigate('/driver/incoming-request')}
              className="text-taga-mango text-sm font-semibold"
            >
              Simuler →
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Câbler la route dans `App.jsx`**

Remplacer `<Route path="/driver/online" element={<Stub name="En ligne" />} />` par le vrai composant, ajouter l'import.

- [ ] **Step 3: Vérifier build + lint**

Run: `npm run build && npm run lint`
Expected: les deux réussissent.

- [ ] **Step 4: Vérification visuelle**

Run: `npm run dev`, naviguer jusqu'à `/driver/online` (via rôle chauffeur → onboarding).
Attendu : gains du jour affichés, toggle "Disponible pour course" ; une fois activé, un bouton "Simuler →" apparaît et navigue vers `/driver/incoming-request`.

- [ ] **Step 5: Commit**

```bash
git add src/screens/driver/Online.jsx src/App.jsx
git commit -m "feat: implement driver Online screen"
```

---

### Task 18: Écran chauffeur `IncomingRequest` (Demande entrante)

**Files:**
- Create: `src/screens/driver/IncomingRequest.jsx`
- Modify: `src/App.jsx`

**Interfaces:**
- Consumes: `useAppStore` (`ride`, `setRideStatus`), `MapView`, `PrimaryButton`.
- Produces: `IncomingRequest` (default export). "Accepter" : `setRideStatus('driver_en_route')` puis navigue vers `/driver/navigation`. "Refuser" : navigue vers `/driver/online`.

- [ ] **Step 1: Créer l'écran**

```jsx
// src/screens/driver/IncomingRequest.jsx
import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAppStore } from '../../store/useAppStore'
import MapView from '../../components/MapView'
import PrimaryButton from '../../components/PrimaryButton'

export default function IncomingRequest() {
  const navigate = useNavigate()
  const ride = useAppStore((state) => state.ride)
  const setRideStatus = useAppStore((state) => state.setRideStatus)
  const [countdown, setCountdown] = useState(9)

  useEffect(() => {
    if (countdown <= 0) {
      navigate('/driver/online')
      return
    }
    const timer = setTimeout(() => setCountdown((c) => c - 1), 1000)
    return () => clearTimeout(timer)
  }, [countdown, navigate])

  const handleAccept = () => {
    setRideStatus('driver_en_route')
    navigate('/driver/navigation')
  }

  return (
    <div className="flex-1 flex flex-col">
      <MapView className="h-56 shrink-0" />

      <div className="flex-1 bg-white -mt-6 rounded-t-3xl px-5 py-6 flex flex-col gap-4">
        <p className="text-center text-xs text-gray-400 uppercase">Nouvelle demande</p>

        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-gray-400">TU GAGNES</p>
            <p className="font-bold text-3xl">{new Intl.NumberFormat('fr-FR').format(ride.driverEarning)} F</p>
          </div>
          <div className="w-14 h-14 rounded-full border-4 border-taga-mango flex items-center justify-center font-bold text-taga-navy">
            {countdown}
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2 text-center text-xs bg-gray-50 rounded-xl p-3">
          <div>
            <p className="font-bold">{ride.distanceKm} km</p>
            <p className="text-gray-400">DISTANCE</p>
          </div>
          <div>
            <p className="font-bold">~{ride.durationMin} min</p>
            <p className="text-gray-400">DURÉE</p>
          </div>
          <div>
            <p className="font-bold">4.96 ★</p>
            <p className="text-gray-400">NOTE CLIENT</p>
          </div>
        </div>

        <div className="text-sm text-gray-600 flex flex-col gap-1">
          <p>
            <span className="text-taga-green font-semibold">●</span> Pickup — {ride.pickupLabel}
          </p>
          <p>
            <span className="text-taga-navy font-semibold">■</span> Destination — {ride.dropoffLabel}
          </p>
        </div>

        <div className="mt-auto flex gap-3">
          <button
            type="button"
            onClick={() => navigate('/driver/online')}
            className="flex-1 border border-gray-200 rounded-xl py-4 font-semibold text-gray-600"
          >
            Refuser
          </button>
          <div className="flex-1">
            <PrimaryButton variant="green" onClick={handleAccept}>
              Accepter
            </PrimaryButton>
          </div>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Câbler la route dans `App.jsx`**

Remplacer `<Route path="/driver/incoming-request" element={<Stub name="Demande entrante" />} />` par le vrai composant, ajouter l'import.

- [ ] **Step 3: Vérifier build + lint**

Run: `npm run build && npm run lint`
Expected: les deux réussissent.

- [ ] **Step 4: Vérification visuelle**

Run: `npm run dev`, naviguer jusqu'à `/driver/incoming-request` (via Online → toggle dispo → Simuler).
Attendu : compte à rebours démarrant à 9 et décroissant chaque seconde, retour automatique à `/driver/online` s'il atteint 0. "Accepter" navigue vers `/driver/navigation`, "Refuser" vers `/driver/online`.

- [ ] **Step 5: Commit**

```bash
git add src/screens/driver/IncomingRequest.jsx src/App.jsx
git commit -m "feat: implement driver IncomingRequest screen"
```

---

### Task 19: Écran chauffeur `Navigation`

**Files:**
- Create: `src/screens/driver/Navigation.jsx`
- Modify: `src/App.jsx`

**Interfaces:**
- Consumes: `useAppStore` (`ride`, `rideStatus`, `setRideStatus`), `MapView`, `PrimaryButton`.
- Produces: `Navigation` (default export). Bouton relabellisé selon `rideStatus` (`driver_en_route` → "Je suis arrivé", `arrived` → "Démarrer course"). Au démarrage effectif : `setRideStatus('in_progress')` puis navigue vers `/driver/ride-in-progress`.

- [ ] **Step 1: Créer l'écran**

```jsx
// src/screens/driver/Navigation.jsx
import { useNavigate } from 'react-router-dom'
import { useAppStore } from '../../store/useAppStore'
import MapView from '../../components/MapView'
import PrimaryButton from '../../components/PrimaryButton'

export default function Navigation() {
  const navigate = useNavigate()
  const ride = useAppStore((state) => state.ride)
  const rideStatus = useAppStore((state) => state.rideStatus)
  const setRideStatus = useAppStore((state) => state.setRideStatus)

  const isArrived = rideStatus === 'arrived'

  const handleAction = () => {
    if (!isArrived) {
      setRideStatus('arrived')
      return
    }
    setRideStatus('in_progress')
    navigate('/driver/ride-in-progress')
  }

  return (
    <div className="flex-1 flex flex-col">
      <div className="bg-taga-navy text-white px-4 py-3 flex items-center gap-3">
        <span className="w-9 h-9 rounded-lg bg-taga-mango flex items-center justify-center">↑</span>
        <div>
          <p className="font-bold">200 m</p>
          <p className="text-xs text-white/60">Tout droit sur Bd Latrille</p>
        </div>
      </div>

      <MapView className="flex-1" />

      <div className="bg-white px-5 py-5 flex flex-col gap-4">
        <div className="text-sm text-gray-600">
          <p className="font-semibold">Akissi K. · ★ 4.96 · cliente régulière</p>
          <p className="text-xs text-gray-400 mt-1">Pickup — {ride.pickupLabel}</p>
        </div>
        <PrimaryButton onClick={handleAction}>{isArrived ? 'Démarrer course' : 'Je suis arrivé · démarrer course'}</PrimaryButton>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Câbler la route dans `App.jsx`**

Remplacer `<Route path="/driver/navigation" element={<Stub name="Navigation" />} />` par le vrai composant, ajouter l'import.

- [ ] **Step 3: Vérifier build + lint**

Run: `npm run build && npm run lint`
Expected: les deux réussissent.

- [ ] **Step 4: Vérification visuelle**

Run: `npm run dev`, naviguer jusqu'à `/driver/navigation` (via IncomingRequest → Accepter).
Attendu : bouton "Je suis arrivé · démarrer course" ; premier clic change le libellé en "Démarrer course" (statut `arrived`) ; second clic navigue vers `/driver/ride-in-progress`.

- [ ] **Step 5: Commit**

```bash
git add src/screens/driver/Navigation.jsx src/App.jsx
git commit -m "feat: implement driver Navigation screen"
```

---

### Task 20: Écran chauffeur `RideInProgress` (Course en cours)

**Files:**
- Create: `src/screens/driver/RideInProgress.jsx`
- Modify: `src/App.jsx`

**Interfaces:**
- Consumes: `useAppStore` (`ride`, `setRideStatus`, `creditRideEarning`), `MapView`, `PrimaryButton`.
- Produces: `RideInProgress` (default export). "Terminer la course" : `setRideStatus('completed')`, `creditRideEarning(ride.driverEarning)`, navigue vers `/driver/payout-recap`.

- [ ] **Step 1: Créer l'écran**

```jsx
// src/screens/driver/RideInProgress.jsx
import { useNavigate } from 'react-router-dom'
import { useAppStore } from '../../store/useAppStore'
import MapView from '../../components/MapView'
import PrimaryButton from '../../components/PrimaryButton'

export default function RideInProgress() {
  const navigate = useNavigate()
  const ride = useAppStore((state) => state.ride)
  const setRideStatus = useAppStore((state) => state.setRideStatus)
  const creditRideEarning = useAppStore((state) => state.creditRideEarning)

  const handleComplete = () => {
    setRideStatus('completed')
    creditRideEarning(ride.driverEarning)
    navigate('/driver/payout-recap')
  }

  return (
    <div className="flex-1 flex flex-col">
      <div className="bg-taga-green text-white text-sm font-semibold text-center py-2">
        Course en cours · Akissi à bord
      </div>

      <div className="bg-taga-navy text-white px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="w-9 h-9 rounded-lg bg-taga-mango flex items-center justify-center">→</span>
          <div>
            <p className="font-bold">1.4 km</p>
            <p className="text-xs text-white/60">Tourner à droite — Bd VGE</p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-xs text-white/60">TON GAIN</p>
          <p className="font-bold">{new Intl.NumberFormat('fr-FR').format(ride.driverEarning)} F</p>
        </div>
      </div>

      <MapView className="flex-1" />

      <div className="bg-white px-5 py-5 flex flex-col gap-4">
        <div className="grid grid-cols-3 gap-2 text-center text-xs bg-gray-50 rounded-xl p-3">
          <div>
            <p className="font-bold">~8 min</p>
            <p className="text-gray-400">RESTANT</p>
          </div>
          <div>
            <p className="font-bold">42 km/h</p>
            <p className="text-gray-400">VITESSE</p>
          </div>
          <div>
            <p className="font-bold">Fluide</p>
            <p className="text-gray-400">TRAFIC</p>
          </div>
        </div>
        <div className="flex gap-3">
          <button type="button" className="flex-1 border border-gray-200 rounded-xl py-4 font-semibold text-gray-600">
            Urgence
          </button>
          <div className="flex-1">
            <PrimaryButton onClick={handleComplete}>Terminer la course →</PrimaryButton>
          </div>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Câbler la route dans `App.jsx`**

Remplacer `<Route path="/driver/ride-in-progress" element={<Stub name="Course en cours" />} />` par le vrai composant, ajouter l'import.

- [ ] **Step 3: Vérifier build + lint**

Run: `npm run build && npm run lint`
Expected: les deux réussissent.

- [ ] **Step 4: Vérification visuelle**

Run: `npm run dev`, naviguer jusqu'à `/driver/ride-in-progress` (via Navigation → 2 clics).
Attendu : bandeau vert "Course en cours", gain affiché, clic "Terminer la course →" navigue vers `/driver/payout-recap`.

- [ ] **Step 5: Commit**

```bash
git add src/screens/driver/RideInProgress.jsx src/App.jsx
git commit -m "feat: implement driver RideInProgress screen"
```

---

### Task 21: Écran chauffeur `PayoutRecap` (Récap & retrait)

**Files:**
- Create: `src/screens/driver/PayoutRecap.jsx`
- Modify: `src/App.jsx`

**Interfaces:**
- Consumes: `useAppStore` (`driverWalletBalance`, `ride`), `AmountTile`, `PrimaryButton`.
- Produces: `PayoutRecap` (default export). "Reprendre en ligne" navigue vers `/driver/online`.

- [ ] **Step 1: Créer l'écran**

```jsx
// src/screens/driver/PayoutRecap.jsx
import { useNavigate } from 'react-router-dom'
import { useAppStore } from '../../store/useAppStore'
import AmountTile from '../../components/AmountTile'
import PrimaryButton from '../../components/PrimaryButton'

export default function PayoutRecap() {
  const navigate = useNavigate()
  const driverWalletBalance = useAppStore((state) => state.driverWalletBalance)
  const ride = useAppStore((state) => state.ride)

  return (
    <div className="flex-1 bg-taga-navy text-white px-5 py-8 flex flex-col gap-5">
      <div>
        <p className="text-taga-green text-xs font-semibold">● COURSE TERMINÉE</p>
        <h1 className="text-xl font-bold mt-2">Bien joué chef.</h1>
        <p className="text-white/70 text-sm">Akissi t'a mis 5★.</p>
      </div>

      <div className="bg-white/10 rounded-2xl p-4">
        <p className="text-xs text-white/50">SOLDE DISPONIBLE</p>
        <AmountTile amount={driverWalletBalance} size="xl" tone="light" />
      </div>

      <div className="bg-white/10 rounded-2xl p-4 flex items-center justify-between text-sm">
        <div>
          <p className="text-white/50 text-xs">DERNIÈRE COURSE</p>
          <p className="font-semibold">
            {ride.pickupLabel.split(',')[0]} → {ride.dropoffLabel.split(',')[0]}
          </p>
        </div>
        <p className="text-taga-green font-bold">+{new Intl.NumberFormat('fr-FR').format(ride.driverEarning)} F</p>
      </div>

      <div>
        <p className="text-xs text-white/50 mb-2">RETRAIT MOBILE MONEY</p>
        <div className="bg-white/10 rounded-xl px-4 py-3 flex items-center justify-between text-sm mb-3">
          <span>Orange Money · 07 •••• 1284</span>
        </div>
        <PrimaryButton variant="mango" onClick={() => {}}>
          Retirer {new Intl.NumberFormat('fr-FR').format(driverWalletBalance)} F sur Orange Money →
        </PrimaryButton>
      </div>

      <button
        type="button"
        onClick={() => navigate('/driver/online')}
        className="mt-auto border border-white/30 rounded-xl py-3 font-semibold"
      >
        Reprendre en ligne
      </button>
    </div>
  )
}
```

- [ ] **Step 2: Câbler la route dans `App.jsx`**

Remplacer `<Route path="/driver/payout-recap" element={<Stub name="Récap & retrait" />} />` par le vrai composant, ajouter l'import. Supprimer le composant `Stub` désormais inutilisé de `App.jsx`.

- [ ] **Step 3: Vérifier build + lint**

Run: `npm run build && npm run lint`
Expected: les deux réussissent, aucun avertissement de composant/import inutilisé.

- [ ] **Step 4: Vérification visuelle complète du flow**

Run: `npm run dev`, rejouer le parcours complet passager (`/` → passager → onboarding → home → estimate → active-ride → ride-end) puis le parcours chauffeur (`/` → chauffeur → onboarding → online → toggle dispo → simuler → incoming-request → accepter → navigation ×2 → ride-in-progress → terminer → payout-recap).
Attendu : les 11 écrans s'enchaînent sans erreur console, le solde affiché sur `PayoutRecap` a bien augmenté du montant de la course (25 120 + 2 720 = 27 840 F), "Reprendre en ligne" ramène à `/driver/online`.

- [ ] **Step 5: Commit**

```bash
git add src/screens/driver/PayoutRecap.jsx src/App.jsx
git commit -m "feat: implement driver PayoutRecap screen, complete prototype flow"
```

---

## Self-Review

**Couverture du spec** : les 11 écrans du spec UX (`2026-08-24-taga-prototype-design.md`) sont chacun couverts par une tâche (Tasks 11–21). Le store (Task 1) couvre toutes les données mockées mentionnées (rôle, course, chauffeur, statuts, gains, portefeuille). Les 13 composants réutilisables listés dans le spec écrans sont réduits aux 9 réellement nécessaires pour ces 11 écrans (`PaymentMethodTile`, `RideHistoryTile`, `BottomNavBar`, `OtpInput`, `EmptyState` ne sont pas utilisés par ce sous-ensemble d'écrans — hors scope, cf. Global Constraints) ; `PhoneFrame` a été ajouté (non listé dans le spec écrans, qui décrit la cible FlutterFlow où ce rôle est natif à l'app mobile) car nécessaire pour le rendu web du prototype.

**Scan de placeholders** : aucun "TBD"/"TODO" dans les étapes ; chaque bloc de code est complet et autonome.

**Cohérence des types** : forme du store (`ride`, `driver`, `RIDE_OPTIONS`, `rideStatus`, `driverAvailable`, `driverWalletBalance`, `rating`) définie une fois en Task 1, réutilisée à l'identique dans toutes les tâches suivantes — vérifié qu'aucun nom de champ ne diverge (ex. `driverEarning` cohérent entre `ride` en Task 1, IncomingRequest en Task 18, et RideInProgress/PayoutRecap en Tasks 20–21).
