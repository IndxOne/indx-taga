# États UX manquants (Priorité 2) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Introduce the 9 missing UX states (chargement, succès, erreur réseau, absence de résultat, données indisponibles, action en cours, action réussie, action impossible, session expirée) across the 8 screens listed in the spec, using a realistic automatic simulation (delay + ~35% random failure) instead of the current fully-synchronous mocked flow.

**Architecture:** One shared simulation primitive (`simulate()`) wraps every "network" call. Two hooks (`useAsyncData` for screen-load fetches, `useAsyncAction` for button-triggered actions) standardize status handling. A small set of presentational state components render each status consistently. Session expiry is a cross-cutting timer in the Zustand store, enforced by a `SessionGuard` wrapper around protected routes.

**Tech Stack:** React 19, Zustand 4, react-router-dom 6, Vite 8, Tailwind 3. Testing: Vitest + @testing-library/react (added in Task 1) for the pure logic (services/hooks) only — screens are verified manually via the Vite dev server, per the prototype's existing testing posture (no test framework existed before this plan).

## Global Constraints

- Every simulated network call goes through `src/services/simulate.js` — no ad-hoc `setTimeout`/`Math.random()` in screen components.
- Default simulation: delay `[400, 900]` ms, `failRate` 0.35 (per spec P2 — "fréquent ~30-40%").
- Each screen implements only the states listed in its row of the spec's mapping table (`docs/superpowers/specs/2026-08-25-ux-states-design.md`) — no forcing all 9 states everywhere.
- French copy only, matching the existing tone in the codebase (tutoiement, no exclamation-heavy phrasing).
- Reuse existing design tokens: `taga-blue`, `taga-green`, `taga-navy`, `taga-mango`, and the existing `Icon` component (`src/components/Icon.jsx`) — add new icon glyphs there, don't introduce a second icon system.
- Commit after every task.

---

### Task 1: Add Vitest + Testing Library

**Files:**
- Modify: `package.json`
- Modify: `vite.config.js`

**Interfaces:**
- Produces: `npm test` script runnable by every later task.

- [ ] **Step 1: Install dependencies**

Run: `npm install --save-dev vitest jsdom @testing-library/react`
Expected: `package.json` devDependencies gain `vitest`, `jsdom`, `@testing-library/react`.

- [ ] **Step 2: Add the test script**

In `package.json`, inside `"scripts"`, add:

```json
    "test": "vitest run"
```

- [ ] **Step 3: Configure the test environment**

In `vite.config.js`, replace the file with:

```js
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    open: false,
  },
  test: {
    environment: 'jsdom',
    globals: true,
  },
})
```

- [ ] **Step 4: Verify the runner works with an inline smoke test**

Create `src/setupTest.smoke.test.js` temporarily:

```js
import { describe, expect, it } from 'vitest'

describe('vitest setup', () => {
  it('runs', () => {
    expect(1 + 1).toBe(2)
  })
})
```

Run: `npm test`
Expected: `1 passed`

Delete `src/setupTest.smoke.test.js` after confirming.

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json vite.config.js
git commit -m "chore: add vitest + testing-library for pure logic tests"
```

---

### Task 2: `simulate.js` service + `otpService.js` wiring

**Files:**
- Create: `src/services/simulate.js`
- Test: `src/services/simulate.test.js`
- Modify: `src/services/otpService.js`

**Interfaces:**
- Produces: `simulate(result, options?)` → `Promise<result>`, where `options` is `{ delay?: [number, number], failRate?: number, errorMessage?: string | Record<string, string>, errorKinds?: string[] }`. On failure, rejects with an `Error` whose `.kind` is one of `errorKinds` (default `['network']`) and whose `.message` is `errorMessage` (or `errorMessage[kind]` when `errorMessage` is an object).
- Consumed by every later task's services (Tasks 8–14) and by `otpService.js` in this task.

- [ ] **Step 1: Write the failing tests**

```js
// src/services/simulate.test.js
import { afterEach, describe, expect, it, vi } from 'vitest'
import { simulate } from './simulate'

describe('simulate', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('resolves with the result when the roll is above failRate', async () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.9)
    const result = await simulate('ok', { failRate: 0.5, delay: [0, 0] })
    expect(result).toBe('ok')
  })

  it('accepts a lazy result function', async () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.9)
    const result = await simulate(() => ({ value: 42 }), { failRate: 0, delay: [0, 0] })
    expect(result).toEqual({ value: 42 })
  })

  it('rejects with the given error message when the roll is below failRate', async () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.1)
    await expect(
      simulate('ok', { failRate: 0.5, delay: [0, 0], errorMessage: 'nope' }),
    ).rejects.toThrow('nope')
  })

  it('tags the rejected error with a kind resolved from errorKinds', async () => {
    vi.spyOn(Math, 'random')
      .mockReturnValueOnce(0) // duration roll
      .mockReturnValueOnce(0.1) // fail roll (below failRate 0.5)
      .mockReturnValueOnce(0.9) // kind-index roll -> picks last entry

    await simulate('ok', {
      failRate: 0.5,
      delay: [0, 0],
      errorKinds: ['network', 'unavailable'],
      errorMessage: { network: 'net', unavailable: 'unavail' },
    }).catch((err) => {
      expect(err.kind).toBe('unavailable')
      expect(err.message).toBe('unavail')
    })
  })

  it('defaults to a network kind and generic message', async () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.1)
    await simulate('ok', { failRate: 1, delay: [0, 0] }).catch((err) => {
      expect(err.kind).toBe('network')
      expect(err.message).toBe('Une erreur est survenue.')
    })
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/services/simulate.test.js`
Expected: FAIL — `Cannot find module './simulate'`

- [ ] **Step 3: Implement `simulate.js`**

```js
// src/services/simulate.js
export function simulate(result, options = {}) {
  const {
    delay = [400, 900],
    failRate = 0.35,
    errorMessage = 'Une erreur est survenue.',
    errorKinds = ['network'],
  } = options

  const [min, max] = delay
  const duration = min + Math.random() * (max - min)

  return new Promise((resolve, reject) => {
    setTimeout(() => {
      if (Math.random() < failRate) {
        const kind = errorKinds[Math.floor(Math.random() * errorKinds.length)]
        const message = typeof errorMessage === 'object' ? errorMessage[kind] : errorMessage
        const error = new Error(message)
        error.kind = kind
        reject(error)
        return
      }
      resolve(typeof result === 'function' ? result() : result)
    }, duration)
  })
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/services/simulate.test.js`
Expected: `5 passed`

- [ ] **Step 5: Wire `otpService.js` to simulate network errors**

Read the current file first (`src/services/otpService.js`) — it already gates the mock path behind `!import.meta.env.DEV && !DEMO_MODE`. Replace its content with:

```js
// src/services/otpService.js
import { DEV_TEST_PASSENGER_PHONE } from '../store/useAppStore'
import { simulate } from './simulate'

const API_URL = import.meta.env.VITE_OTP_API_URL?.replace(/\/$/, '')
const DEMO_MODE = import.meta.env.VITE_DEMO_MODE === 'true'

function getErrorMessage(payload, fallback) {
  return payload?.message || payload?.error || fallback
}

async function request(path, body) {
  const response = await fetch(`${API_URL}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const payload = await response.json().catch(() => ({}))
  if (!response.ok) {
    throw new Error(getErrorMessage(payload, 'Le service OTP est indisponible.'))
  }
  return payload
}

export async function sendOtp({ phone, role }) {
  if (!API_URL) {
    if (!import.meta.env.DEV && !DEMO_MODE) {
      throw new Error('Le service OTP n’est pas configuré.')
    }

    return simulate(
      () => ({
        challengeId: 'dev-challenge',
        phone: role === 'passenger' ? DEV_TEST_PASSENGER_PHONE : phone,
        maskedPhone: role === 'passenger' ? DEV_TEST_PASSENGER_PHONE : phone,
        expiresIn: 300,
        devSimulation: true,
      }),
      { errorMessage: 'Échec de l’envoi du code. Vérifie ta connexion.' },
    )
  }

  return request('/send-otp', { phone, role })
}

export async function verifyOtp({ challengeId, code }) {
  if (!API_URL) {
    if (!import.meta.env.DEV && !DEMO_MODE) {
      throw new Error('Le service OTP n’est pas configuré.')
    }

    await simulate(true, { errorMessage: 'Échec de la vérification. Réessaie.' })

    if (challengeId !== 'dev-challenge' || !/^\d{6}$/.test(code)) {
      throw new Error('Code incorrect ou expiré.')
    }
    return { verified: true, devSimulation: true }
  }

  return request('/verify-otp', { challengeId, code })
}

export async function resendOtp({ phone, role, challengeId }) {
  if (!API_URL) {
    return sendOtp({ phone, role, challengeId })
  }

  return request('/resend-otp', { phone, role, challengeId })
}
```

Note: the random network failure (simulate) is checked *before* the deterministic "code incorrect" check — this keeps "erreur réseau" (random) and "action impossible" (deterministic business rule) as two distinct, separately testable causes, both already surfaced by the existing `try/catch` in `Onboarding.jsx` and `Otp.jsx`.

- [ ] **Step 6: Manual verification**

Run: `npm run dev`, go through onboarding → OTP a few times. Expected: most attempts succeed after a short delay; roughly 1 in 3 shows "Échec de l’envoi du code..." or "Échec de la vérification...". Entering a wrong 6-digit code still shows "Code incorrect ou expiré." deterministically.

- [ ] **Step 7: Commit**

```bash
git add src/services/simulate.js src/services/simulate.test.js src/services/otpService.js
git commit -m "feat: add simulate() network primitive and wire it into otpService"
```

---

### Task 3: `useAsyncAction` hook

**Files:**
- Create: `src/hooks/useAsyncAction.js`
- Test: `src/hooks/useAsyncAction.test.js`

**Interfaces:**
- Consumes: any `(...args) => Promise<T>` function.
- Produces: `{ status: 'idle'|'pending'|'success'|'error', error: Error|null, run: (...args) => Promise<T>, reset: () => void }`. Consumed by Tasks 9–14.

- [ ] **Step 1: Write the failing tests**

```js
// src/hooks/useAsyncAction.test.js
import { describe, expect, it } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import { useAsyncAction } from './useAsyncAction'

describe('useAsyncAction', () => {
  it('starts idle', () => {
    const { result } = renderHook(() => useAsyncAction(() => Promise.resolve('ok')))
    expect(result.current.status).toBe('idle')
    expect(result.current.error).toBeNull()
  })

  it('transitions to success and returns the resolved value', async () => {
    const { result } = renderHook(() => useAsyncAction(() => Promise.resolve('ok')))
    let returned
    await act(async () => {
      returned = await result.current.run()
    })
    expect(result.current.status).toBe('success')
    expect(returned).toBe('ok')
  })

  it('transitions to error and exposes the thrown error', async () => {
    const { result } = renderHook(() => useAsyncAction(() => Promise.reject(new Error('boom'))))
    await act(async () => {
      await expect(result.current.run()).rejects.toThrow('boom')
    })
    expect(result.current.status).toBe('error')
    expect(result.current.error.message).toBe('boom')
  })

  it('reset returns to idle', async () => {
    const { result } = renderHook(() => useAsyncAction(() => Promise.resolve('ok')))
    await act(async () => {
      await result.current.run()
    })
    act(() => {
      result.current.reset()
    })
    expect(result.current.status).toBe('idle')
    expect(result.current.error).toBeNull()
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/hooks/useAsyncAction.test.js`
Expected: FAIL — `Cannot find module './useAsyncAction'`

- [ ] **Step 3: Implement the hook**

```js
// src/hooks/useAsyncAction.js
import { useCallback, useState } from 'react'

export function useAsyncAction(action) {
  const [status, setStatus] = useState('idle')
  const [error, setError] = useState(null)

  const run = useCallback(
    async (...args) => {
      setStatus('pending')
      setError(null)
      try {
        const result = await action(...args)
        setStatus('success')
        return result
      } catch (err) {
        setStatus('error')
        setError(err)
        throw err
      }
    },
    [action],
  )

  const reset = useCallback(() => {
    setStatus('idle')
    setError(null)
  }, [])

  return { status, error, run, reset }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/hooks/useAsyncAction.test.js`
Expected: `4 passed`

- [ ] **Step 5: Commit**

```bash
git add src/hooks/useAsyncAction.js src/hooks/useAsyncAction.test.js
git commit -m "feat: add useAsyncAction hook for button-triggered async flows"
```

---

### Task 4: `useAsyncData` hook

**Files:**
- Create: `src/hooks/useAsyncData.js`
- Test: `src/hooks/useAsyncData.test.js`

**Interfaces:**
- Consumes: `loader: () => Promise<T>` (must be referentially stable across renders — callers wrap it in `useCallback`), `options?: { isEmpty?: (data: T) => boolean }`.
- Produces: `{ status: 'loading'|'success'|'empty'|'error'|'unavailable', data: T|null, error: Error|null, retry: () => void }`. Consumed by Tasks 9, 12, 13, 14.

- [ ] **Step 1: Write the failing tests**

```js
// src/hooks/useAsyncData.test.js
import { describe, expect, it, vi } from 'vitest'
import { act, renderHook, waitFor } from '@testing-library/react'
import { useAsyncData } from './useAsyncData'

describe('useAsyncData', () => {
  it('starts loading then resolves to success', async () => {
    const loader = () => Promise.resolve([1, 2, 3])
    const { result } = renderHook(() => useAsyncData(loader))
    expect(result.current.status).toBe('loading')
    await waitFor(() => expect(result.current.status).toBe('success'))
    expect(result.current.data).toEqual([1, 2, 3])
  })

  it('resolves to empty when isEmpty matches the data', async () => {
    const loader = () => Promise.resolve([])
    const { result } = renderHook(() =>
      useAsyncData(loader, { isEmpty: (data) => data.length === 0 }),
    )
    await waitFor(() => expect(result.current.status).toBe('empty'))
  })

  it('resolves to error on a network-kind rejection', async () => {
    const err = Object.assign(new Error('net down'), { kind: 'network' })
    const loader = () => Promise.reject(err)
    const { result } = renderHook(() => useAsyncData(loader))
    await waitFor(() => expect(result.current.status).toBe('error'))
    expect(result.current.error.message).toBe('net down')
  })

  it('resolves to unavailable on an unavailable-kind rejection', async () => {
    const err = Object.assign(new Error('service down'), { kind: 'unavailable' })
    const loader = () => Promise.reject(err)
    const { result } = renderHook(() => useAsyncData(loader))
    await waitFor(() => expect(result.current.status).toBe('unavailable'))
  })

  it('retry re-runs the loader', async () => {
    const loader = vi.fn().mockResolvedValue('ok')
    const { result } = renderHook(() => useAsyncData(loader))
    await waitFor(() => expect(result.current.status).toBe('success'))
    await act(async () => {
      result.current.retry()
    })
    expect(loader).toHaveBeenCalledTimes(2)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/hooks/useAsyncData.test.js`
Expected: FAIL — `Cannot find module './useAsyncData'`

- [ ] **Step 3: Implement the hook**

```js
// src/hooks/useAsyncData.js
import { useCallback, useEffect, useState } from 'react'

export function useAsyncData(loader, { isEmpty = () => false } = {}) {
  const [status, setStatus] = useState('loading')
  const [data, setData] = useState(null)
  const [error, setError] = useState(null)

  const load = useCallback(() => {
    setStatus('loading')
    setError(null)
    return loader()
      .then((result) => {
        setData(result)
        setStatus(isEmpty(result) ? 'empty' : 'success')
      })
      .catch((err) => {
        setError(err)
        setStatus(err?.kind === 'unavailable' ? 'unavailable' : 'error')
      })
  }, [loader, isEmpty])

  useEffect(() => {
    load()
  }, [load])

  return { status, data, error, retry: load }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/hooks/useAsyncData.test.js`
Expected: `5 passed`

- [ ] **Step 5: Commit**

```bash
git add src/hooks/useAsyncData.js src/hooks/useAsyncData.test.js
git commit -m "feat: add useAsyncData hook for screen-load async fetches"
```

---

### Task 5: Session expiry — store + OTP wiring

**Files:**
- Modify: `src/store/useAppStore.js`
- Modify: `src/screens/Otp.jsx`

**Interfaces:**
- Produces: `state.sessionExpiresAt: number` (0 = no active session), `state.startSession(): void`. Consumed by Task 7 (`SessionGuard`).

- [ ] **Step 1: Add session fields to the store**

In `src/store/useAppStore.js`, add near the top (below `DEV_TEST_PASSENGER_PHONE`):

```js
const randomBetween = (min, max) => min + Math.random() * (max - min)
```

Inside `create((set) => ({ ... }))`, add (near the `otp*` fields):

```js
  sessionExpiresAt: 0,
  startSession: () => set({ sessionExpiresAt: Date.now() + randomBetween(90_000, 240_000) }),
```

And update `logout` to also clear it:

```js
  logout: () => set({
    role: null,
    phone: '',
    otpChallengeId: '',
    otpMaskedPhone: '',
    otpExpiresAt: 0,
    sessionExpiresAt: 0,
    rideStatus: 'idle',
    driverAvailable: false,
  }),
```

- [ ] **Step 2: Start the session on successful OTP verification**

In `src/screens/Otp.jsx`, add `const startSession = useAppStore((state) => state.startSession)` next to the other store selectors, then in `handleVerify`, call it right after the successful `verifyOtp`:

```js
  const handleVerify = async () => {
    if (isExpired) {
      setError('Ce code a expiré. Demande un nouveau code pour continuer.')
      return
    }
    setIsVerifying(true)
    setError('')
    try {
      await verifyOtp({ challengeId: otpChallengeId, code })
      startSession()
      navigate(role === 'driver' ? ROUTES.driverOnline : ROUTES.clientHome)
    } catch (verifyError) {
      setError(verifyError.message)
    } finally {
      setIsVerifying(false)
    }
  }
```

- [ ] **Step 3: Manual verification**

Run: `npm run dev`, log in, check in React DevTools (or a temporary `console.log`) that `sessionExpiresAt` is a timestamp 90–240s in the future right after OTP verification succeeds.

- [ ] **Step 4: Commit**

```bash
git add src/store/useAppStore.js src/screens/Otp.jsx
git commit -m "feat: start a randomized session expiry window on OTP verification"
```

---

### Task 6: Shared state UI kit

**Files:**
- Modify: `src/components/Icon.jsx`
- Create: `src/components/states/LoadingState.jsx`
- Create: `src/components/states/RetryError.jsx`
- Create: `src/components/states/InlineBanner.jsx`
- Create: `src/components/states/SessionExpiredOverlay.jsx`

**Interfaces:**
- Produces: `<LoadingState label? />`, `<RetryError icon? title subtitle? onRetry? retryLabel? />`, `<InlineBanner variant="pending"|"success"|"error">{children}</InlineBanner>`, `<SessionExpiredOverlay />`. Consumed by Task 7 and Tasks 9–14.

- [ ] **Step 1: Add missing icon glyphs**

In `src/components/Icon.jsx`, add three entries to the `PATHS` object (after `pin`):

```js
  alert: <><path d="M12 9v4M12 17h.01" /><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z" /></>,
  refresh: <><path d="M21 12a9 9 0 0 1-15.5 6.3M3 12a9 9 0 0 1 15.5-6.3" /><path d="M21 3v6h-6M3 21v-6h6" /></>,
  clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 3" /></>,
```

- [ ] **Step 2: Create `LoadingState`**

```jsx
// src/components/states/LoadingState.jsx
export default function LoadingState({ label = 'Chargement...' }) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-3 px-8 py-12" role="status" aria-live="polite">
      <span className="h-8 w-8 animate-spin rounded-full border-2 border-taga-blue/20 border-t-taga-blue" aria-hidden="true" />
      <p className="text-sm text-gray-400">{label}</p>
    </div>
  )
}
```

- [ ] **Step 3: Create `RetryError`**

```jsx
// src/components/states/RetryError.jsx
import Icon from '../Icon'

export default function RetryError({ icon = 'alert', title, subtitle, onRetry, retryLabel = 'Réessayer' }) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center text-center px-8 py-12" role="alert">
      <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-red-50 text-red-500">
        <Icon name={icon} size={24} />
      </div>
      <p className="font-semibold text-gray-700">{title}</p>
      {subtitle && <p className="text-sm text-gray-400 mt-1">{subtitle}</p>}
      {onRetry && (
        <button type="button" onClick={onRetry} className="mt-4 text-sm font-semibold text-taga-blue">
          {retryLabel}
        </button>
      )}
    </div>
  )
}
```

- [ ] **Step 4: Create `InlineBanner`**

```jsx
// src/components/states/InlineBanner.jsx
import Icon from '../Icon'

const VARIANTS = {
  pending: { className: 'bg-taga-blue/5 text-taga-blue', icon: 'refresh' },
  success: { className: 'bg-taga-green/10 text-taga-green', icon: 'check' },
  error: { className: 'bg-red-50 text-red-500', icon: 'alert' },
}

export default function InlineBanner({ variant = 'pending', children }) {
  const { className, icon } = VARIANTS[variant] ?? VARIANTS.pending
  return (
    <p
      role={variant === 'error' ? 'alert' : 'status'}
      className={`flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-center text-xs ${className}`}
    >
      <Icon name={icon} size={14} className={variant === 'pending' ? 'animate-spin' : ''} />
      {children}
    </p>
  )
}
```

- [ ] **Step 5: Create `SessionExpiredOverlay`**

```jsx
// src/components/states/SessionExpiredOverlay.jsx
import { useNavigate } from 'react-router-dom'
import { useAppStore } from '../../store/useAppStore'
import Icon from '../Icon'
import PrimaryButton from '../PrimaryButton'
import { ROUTES } from '../../navigation/routes'

export default function SessionExpiredOverlay() {
  const navigate = useNavigate()
  const logout = useAppStore((state) => state.logout)

  const handleReconnect = () => {
    logout()
    navigate(ROUTES.onboarding, { replace: true })
  }

  return (
    <div className="absolute inset-0 z-50 flex flex-col items-center justify-center gap-3 bg-white px-8 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-taga-mango/10 text-taga-mango">
        <Icon name="clock" size={24} />
      </div>
      <p className="font-semibold text-gray-700">Session expirée</p>
      <p className="text-sm text-gray-400">Pour ta sécurité, reconnecte-toi pour continuer.</p>
      <div className="mt-2 w-full">
        <PrimaryButton onClick={handleReconnect}>Se reconnecter</PrimaryButton>
      </div>
    </div>
  )
}
```

- [ ] **Step 6: Verify the build compiles**

Run: `npm run build`
Expected: build succeeds with no errors.

- [ ] **Step 7: Commit**

```bash
git add src/components/Icon.jsx src/components/states
git commit -m "feat: add shared state UI kit (loading, retry-error, inline banner, session-expired)"
```

---

### Task 7: `SessionGuard` + wiring into `App.jsx`

**Files:**
- Create: `src/components/SessionGuard.jsx`
- Modify: `src/App.jsx`

**Interfaces:**
- Consumes: `state.sessionExpiresAt` from the store (Task 5), `SessionExpiredOverlay` (Task 6).
- Produces: `<SessionGuard>{children}</SessionGuard>`, wrapping every protected route element in `App.jsx`.

- [ ] **Step 1: Implement `SessionGuard`**

```jsx
// src/components/SessionGuard.jsx
import { useEffect, useState } from 'react'
import { useAppStore } from '../store/useAppStore'
import SessionExpiredOverlay from './states/SessionExpiredOverlay'

export default function SessionGuard({ children }) {
  const sessionExpiresAt = useAppStore((state) => state.sessionExpiresAt)
  const [isExpired, setIsExpired] = useState(
    () => sessionExpiresAt > 0 && Date.now() > sessionExpiresAt,
  )

  useEffect(() => {
    if (!sessionExpiresAt) {
      setIsExpired(false)
      return undefined
    }
    setIsExpired(Date.now() > sessionExpiresAt)
    const timer = setInterval(() => {
      setIsExpired(Date.now() > sessionExpiresAt)
    }, 5000)
    return () => clearInterval(timer)
  }, [sessionExpiresAt])

  return (
    <div className="relative flex flex-1 flex-col">
      {children}
      {isExpired && <SessionExpiredOverlay />}
    </div>
  )
}
```

- [ ] **Step 2: Wrap protected routes in `App.jsx`**

Replace the routes block in `src/App.jsx` — everything except `splash`, `roleChoice`, `onboarding`, `otp` is protected:

```jsx
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import PhoneFrame from './components/PhoneFrame'
import SessionGuard from './components/SessionGuard'
import Splash from './screens/Splash'
import RoleChoice from './screens/RoleChoice'
import Onboarding from './screens/Onboarding'
import Otp from './screens/Otp'
import Profile from './screens/Profile'
import CompleteProfile from './screens/CompleteProfile'
import RideHistory from './screens/RideHistory'
import PaymentMethods from './screens/PaymentMethods'
import Home from './screens/client/Home'
import Estimate from './screens/client/Estimate'
import ActiveRide from './screens/client/ActiveRide'
import RideEnd from './screens/client/RideEnd'
import Online from './screens/driver/Online'
import IncomingRequest from './screens/driver/IncomingRequest'
import Navigation from './screens/driver/Navigation'
import RideInProgress from './screens/driver/RideInProgress'
import PayoutRecap from './screens/driver/PayoutRecap'
import { ROUTES } from './navigation/routes'

function App() {
  return (
    <BrowserRouter>
      <PhoneFrame>
        <Routes>
          <Route path={ROUTES.splash} element={<Splash />} />
          <Route path={ROUTES.roleChoice} element={<RoleChoice />} />
          <Route path={ROUTES.onboarding} element={<Onboarding />} />
          <Route path={ROUTES.otp} element={<Otp />} />
          <Route path={ROUTES.profile} element={<SessionGuard><Profile /></SessionGuard>} />
          <Route path={ROUTES.completeProfile} element={<SessionGuard><CompleteProfile /></SessionGuard>} />
          <Route path={ROUTES.rideHistory} element={<SessionGuard><RideHistory /></SessionGuard>} />
          <Route path={ROUTES.paymentMethods} element={<SessionGuard><PaymentMethods /></SessionGuard>} />
          <Route path={ROUTES.clientHome} element={<SessionGuard><Home /></SessionGuard>} />
          <Route path={ROUTES.clientEstimate} element={<SessionGuard><Estimate /></SessionGuard>} />
          <Route path={ROUTES.clientActiveRide} element={<SessionGuard><ActiveRide /></SessionGuard>} />
          <Route path={ROUTES.clientRideEnd} element={<SessionGuard><RideEnd /></SessionGuard>} />
          <Route path={ROUTES.driverOnline} element={<SessionGuard><Online /></SessionGuard>} />
          <Route path={ROUTES.driverIncomingRequest} element={<SessionGuard><IncomingRequest /></SessionGuard>} />
          <Route path={ROUTES.driverNavigation} element={<SessionGuard><Navigation /></SessionGuard>} />
          <Route path={ROUTES.driverRideInProgress} element={<SessionGuard><RideInProgress /></SessionGuard>} />
          <Route path={ROUTES.driverPayoutRecap} element={<SessionGuard><PayoutRecap /></SessionGuard>} />
          <Route path="*" element={<Navigate to={ROUTES.splash} replace />} />
        </Routes>
      </PhoneFrame>
    </BrowserRouter>
  )
}

export default App
```

- [ ] **Step 3: Manual verification**

Run: `npm run dev`, log in, then in the browser console run:
`useAppStore` isn't on `window` by default, so instead temporarily set a short expiry: open React DevTools, find the Zustand store, or simpler — temporarily change `randomBetween(90_000, 240_000)` to `randomBetween(3_000, 4_000)` in `useAppStore.js`, reload, log in, wait ~4s.
Expected: `SessionExpiredOverlay` appears over the current screen; clicking "Se reconnecter" logs out and returns to onboarding.
Revert the temporary `randomBetween` change before committing.

- [ ] **Step 4: Commit**

```bash
git add src/components/SessionGuard.jsx src/App.jsx
git commit -m "feat: enforce session expiry on protected routes via SessionGuard"
```

---

### Task 8: Estimation de course — chargement / erreur réseau / données indisponibles / absence de résultat / action impossible

**Files:**
- Create: `src/services/rideEstimateService.js`
- Modify: `src/screens/client/Estimate.jsx`

**Interfaces:**
- Produces: `fetchRideOptions(): Promise<RideOption[]>`, `confirmRideOrder(optionId: string): Promise<{ optionId: string }>`.
- Consumes: `useAsyncData`, `useAsyncAction` (Tasks 3–4), `LoadingState`, `RetryError`, `InlineBanner` (Task 6), existing `RIDE_OPTIONS` from `useAppStore.js`.

- [ ] **Step 1: Implement the service**

```js
// src/services/rideEstimateService.js
import { simulate } from './simulate'
import { RIDE_OPTIONS } from '../store/useAppStore'

export function fetchRideOptions() {
  const noCoverage = Math.random() < 0.1
  return simulate(() => (noCoverage ? [] : RIDE_OPTIONS), {
    errorMessage: {
      network: 'Impossible de charger les options de course. Vérifie ta connexion.',
      unavailable: 'Le service de tarification est momentanément indisponible.',
    },
    errorKinds: ['network', 'unavailable'],
  })
}

export function confirmRideOrder(optionId) {
  const noLongerAvailable = Math.random() < 0.2
  if (noLongerAvailable) {
    const error = new Error('Cette option n’est plus disponible, choisis-en une autre.')
    error.kind = 'rejected'
    return Promise.reject(error)
  }
  return simulate({ optionId }, { errorMessage: 'Échec de la commande. Vérifie ta connexion.' })
}
```

- [ ] **Step 2: Wire `Estimate.jsx`**

Read the current file (`src/screens/client/Estimate.jsx`) first to confirm it still matches the version already seen in this session. Replace its content with:

```jsx
// src/screens/client/Estimate.jsx
import { useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAppStore } from '../../store/useAppStore'
import { fetchRideOptions, confirmRideOrder } from '../../services/rideEstimateService'
import { useAsyncData } from '../../hooks/useAsyncData'
import { useAsyncAction } from '../../hooks/useAsyncAction'
import MapView from '../../components/MapView'
import RideOptionCard from '../../components/RideOptionCard'
import PrimaryButton from '../../components/PrimaryButton'
import BackButton from '../../components/BackButton'
import EmptyState from '../../components/EmptyState'
import LoadingState from '../../components/states/LoadingState'
import RetryError from '../../components/states/RetryError'
import InlineBanner from '../../components/states/InlineBanner'
import { ROUTES } from '../../navigation/routes'
import ClientRideMap from '../../components/ClientRideMap'

export default function Estimate() {
  const navigate = useNavigate()
  const ride = useAppStore((state) => state.ride)
  const selectedId = useAppStore((state) => state.selectedRideOptionId)
  const setSelectedId = useAppStore((state) => state.setSelectedRideOptionId)
  const setRideStatus = useAppStore((state) => state.setRideStatus)
  const paymentMethods = useAppStore((state) => state.paymentMethods)
  const defaultPayment = paymentMethods.find((method) => method.isDefault) ?? paymentMethods[0]

  const loadOptions = useCallback(() => fetchRideOptions(), [])
  const optionsData = useAsyncData(loadOptions, { isEmpty: (data) => data.length === 0 })
  const rideOptions = optionsData.data ?? []
  const selectedOption = rideOptions.find((option) => option.id === selectedId)

  const orderAction = useAsyncAction(confirmRideOrder)

  const handleOrder = async () => {
    try {
      await orderAction.run(selectedId)
      setRideStatus('searching')
      navigate('/client/active-ride')
    } catch {
      // handled by orderAction.status/error below
    }
  }

  return (
    <div className="relative flex-1 flex flex-col">
      <div className="relative">
        <MapView className="h-52 shrink-0" aria-label="Carte de l’itinéraire estimé">
          <ClientRideMap phase="estimate" />
        </MapView>
        <div className="absolute left-4 top-4 z-10">
          <BackButton to={ROUTES.clientHome} />
        </div>
      </div>

      {optionsData.status === 'loading' && <LoadingState label="Calcul de ton trajet..." />}

      {optionsData.status === 'error' && (
        <RetryError
          title="Impossible de charger les options"
          subtitle={optionsData.error.message}
          onRetry={optionsData.retry}
        />
      )}

      {optionsData.status === 'unavailable' && (
        <RetryError
          icon="alert"
          title="Service momentanément indisponible"
          subtitle={optionsData.error.message}
          onRetry={optionsData.retry}
          retryLabel="Réessayer plus tard"
        />
      )}

      {optionsData.status === 'empty' && (
        <EmptyState icon="route" title="Aucune course disponible ici" subtitle="TAGA ne dessert pas encore cette zone." />
      )}

      {optionsData.status === 'success' && (
        <div className="flex-1 bg-white -mt-6 rounded-t-3xl px-5 py-6 flex flex-col gap-4 overflow-y-auto">
          <div>
            <p className="text-xs text-gray-400 uppercase">Choisis ta course</p>
            <p className="font-bold">{ride.distanceKm} km · ~{ride.durationMin} min</p>
            <p className="text-xs text-gray-400">{ride.pickupLabel} → {ride.dropoffLabel}</p>
          </div>

          <div className="flex flex-col gap-3">
            {rideOptions.map((option) => (
              <RideOptionCard
                key={option.id}
                {...option}
                selected={option.id === selectedId}
                onSelect={() => setSelectedId(option.id)}
              />
            ))}
          </div>

          {defaultPayment && (
            <button
              type="button"
              onClick={() => navigate(ROUTES.paymentMethods)}
              className="flex items-center gap-3 rounded-xl border border-gray-100 px-3 py-2 text-left"
            >
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-orange-500 text-[10px] font-bold text-white">OM</span>
              <span className="flex-1">
                <span className="block text-xs font-semibold text-gray-700">{defaultPayment.label}</span>
                <span className="block text-[10px] text-gray-400">{defaultPayment.maskedNumber}</span>
              </span>
              <span className="text-xs font-semibold text-taga-blue">Changer</span>
            </button>
          )}

          {orderAction.status === 'error' && (
            <InlineBanner variant="error">{orderAction.error.message}</InlineBanner>
          )}

          <div className="mt-auto pt-2">
            <PrimaryButton onClick={handleOrder} disabled={!selectedOption || orderAction.status === 'pending'}>
              {orderAction.status === 'pending'
                ? 'Commande en cours...'
                : `Commander · ${new Intl.NumberFormat('fr-FR').format(selectedOption?.price ?? 0)} F CFA`}
            </PrimaryButton>
          </div>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 3: Manual verification**

Run: `npm run dev`, navigate Home → "Saisir une destination...". Reload the screen several times: expect to see the loading spinner briefly, then most of the time the ride options; occasionally (~1 in 3) a retry error (network or "service indisponible"); rarely (~1 in 10, on the successful rolls) "Aucune course disponible ici". When ordering, expect the button to show "Commande en cours...", then either navigation to the active-ride screen or an inline "Cette option n'est plus disponible..." / network error banner (~1 in 3–5 attempts).

- [ ] **Step 4: Commit**

```bash
git add src/services/rideEstimateService.js src/screens/client/Estimate.jsx
git commit -m "feat: add loading/error/empty/action states to the ride estimate screen"
```

---

### Task 9: Recherche de chauffeur — action en cours / réussie / absence de résultat / erreur réseau

**Files:**
- Create: `src/services/driverSearchService.js`
- Modify: `src/screens/client/ActiveRide.jsx`

**Interfaces:**
- Produces: `searchDriver(): Promise<{ driverId: string } | null>` (`null` means no driver found).
- Consumes: `useAsyncAction` (Task 3), `LoadingState`, `RetryError` (Task 6).

- [ ] **Step 1: Implement the service**

```js
// src/services/driverSearchService.js
import { simulate } from './simulate'

export function searchDriver() {
  const noDriverFound = Math.random() < 0.2
  return simulate(() => (noDriverFound ? null : { driverId: 'mamadou' }), {
    delay: [1500, 3000],
    errorMessage: 'Connexion perdue pendant la recherche. Réessaie.',
  })
}
```

- [ ] **Step 2: Wire the `searching` phase in `ActiveRide.jsx`**

Read the current file (`src/screens/client/ActiveRide.jsx`) first. Replace its content with:

```jsx
// src/screens/client/ActiveRide.jsx
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAppStore } from '../../store/useAppStore'
import { searchDriver } from '../../services/driverSearchService'
import { useAsyncAction } from '../../hooks/useAsyncAction'
import MapView from '../../components/MapView'
import DriverInfoCard from '../../components/DriverInfoCard'
import PrimaryButton from '../../components/PrimaryButton'
import LoadingState from '../../components/states/LoadingState'
import RetryError from '../../components/states/RetryError'
import EmptyState from '../../components/EmptyState'
import ClientRideMap from '../../components/ClientRideMap'

const STATUS_LABEL = {
  searching: "Recherche d'un chauffeur...",
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
  const [contactNotice, setContactNotice] = useState('')
  const search = useAsyncAction(searchDriver)

  useEffect(() => {
    if (rideStatus !== 'searching') return
    search.run().then((result) => {
      if (result) setRideStatus('driver_en_route')
    }).catch(() => {})
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rideStatus])

  const advance = () => {
    const next = NEXT_STATUS[rideStatus]
    if (!next) return
    setRideStatus(next)
    if (next === 'in_progress') navigate('/client/ride-end')
  }

  if (rideStatus === 'searching') {
    if (search.status === 'pending' || search.status === 'idle') {
      return <LoadingState label="Recherche d'un chauffeur..." />
    }
    if (search.status === 'error') {
      return (
        <RetryError
          title="Connexion perdue"
          subtitle={search.error.message}
          onRetry={() => search.run().then((result) => result && setRideStatus('driver_en_route'))}
        />
      )
    }
    if (search.status === 'success') {
      return (
        <EmptyState
          icon="route"
          title="Aucun chauffeur disponible"
          subtitle="Tous nos chauffeurs sont occupés pour le moment."
        />
      )
    }
  }

  return (
    <div className="flex-1 flex flex-col">
      <MapView className="h-72 shrink-0" aria-label="Carte de la course active">
        <ClientRideMap phase="active" />
        <div className="absolute bottom-4 left-4 right-4 z-[2] rounded-xl bg-taga-green px-3 py-2 text-center text-sm font-semibold text-white shadow-md">
          ● {STATUS_LABEL[rideStatus] ?? STATUS_LABEL.searching}
        </div>
      </MapView>

      <div className="flex-1 bg-white -mt-6 rounded-t-3xl px-5 py-6 flex flex-col gap-4">
        <DriverInfoCard
          driver={driver}
          onMessage={() => setContactNotice('Message simulé envoyé au chauffeur.')}
          onCall={() => setContactNotice('Appel simulé vers le chauffeur.')}
        />

        {contactNotice && <p role="status" className="rounded-lg bg-taga-blue/5 px-3 py-2 text-center text-xs text-taga-blue">{contactNotice}</p>}

        <div className="text-sm text-gray-600 flex flex-col gap-1">
          <p><span className="text-taga-green font-semibold">●</span> Commande acceptée · {ride.pickupLabel}</p>
          <p className="text-xs text-gray-400">En approche · 3 min · {ride.pickupDetail}</p>
          <p><span className="text-taga-navy font-semibold">■</span> Dépose · {ride.dropoffLabel}</p>
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

Note: the `search.status === 'success'` branch above is reached only when `searchDriver()` resolved with `null` (no driver found) — when it resolves with a driver, the effect's `.then()` calls `setRideStatus('driver_en_route')` in the same tick, so `rideStatus` has already moved away from `'searching'` by the time this render check would otherwise show it.

- [ ] **Step 3: Manual verification**

Run: `npm run dev`, order a ride from Estimate. Expected: "Recherche d'un chauffeur..." loading screen for 1.5–3s, then either the active-ride screen with driver info (~80%), "Aucun chauffeur disponible" (no retry button, matches spec — informational only), or "Connexion perdue" with a working "Réessayer" button.

- [ ] **Step 4: Commit**

```bash
git add src/services/driverSearchService.js src/screens/client/ActiveRide.jsx
git commit -m "feat: simulate driver search states on the active-ride screen"
```

---

### Task 10: Demande entrante chauffeur — action en cours / réussie / impossible / erreur réseau

**Files:**
- Create: `src/services/driverRequestService.js`
- Modify: `src/screens/driver/IncomingRequest.jsx`

**Interfaces:**
- Produces: `respondToRequest(accepted: boolean): Promise<{ accepted: true } | { declined: true }>`.
- Consumes: `useAsyncAction` (Task 3), `InlineBanner` (Task 6).

- [ ] **Step 1: Implement the service**

```js
// src/services/driverRequestService.js
import { simulate } from './simulate'

export function respondToRequest(accepted) {
  if (!accepted) return Promise.resolve({ declined: true })

  const alreadyTaken = Math.random() < 0.15
  if (alreadyTaken) {
    const error = new Error('Cette course vient d’être prise par un autre chauffeur.')
    error.kind = 'rejected'
    return Promise.reject(error)
  }

  return simulate(
    { accepted: true },
    { errorMessage: 'Échec de la connexion au serveur. Réessaie.' },
  )
}
```

- [ ] **Step 2: Wire `IncomingRequest.jsx`**

Read the current file first. Replace its content with:

```jsx
// src/screens/driver/IncomingRequest.jsx
import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAppStore } from '../../store/useAppStore'
import { respondToRequest } from '../../services/driverRequestService'
import { useAsyncAction } from '../../hooks/useAsyncAction'
import MapView from '../../components/MapView'
import PrimaryButton from '../../components/PrimaryButton'
import BackButton from '../../components/BackButton'
import DriverRideMap from '../../components/DriverRideMap'
import InlineBanner from '../../components/states/InlineBanner'
import { ROUTES } from '../../navigation/routes'

export default function IncomingRequest() {
  const navigate = useNavigate()
  const ride = useAppStore((state) => state.ride)
  const setRideStatus = useAppStore((state) => state.setRideStatus)
  const [countdown, setCountdown] = useState(9)
  const respond = useAsyncAction(respondToRequest)

  useEffect(() => {
    if (countdown <= 0) {
      navigate('/driver/online')
      return undefined
    }
    if (respond.status === 'pending') return undefined
    const timer = setTimeout(() => setCountdown((current) => current - 1), 1000)
    return () => clearTimeout(timer)
  }, [countdown, navigate, respond.status])

  const handleAccept = async () => {
    try {
      await respond.run(true)
      setRideStatus('driver_en_route')
      navigate('/driver/navigation')
    } catch {
      // handled by respond.status/error below
    }
  }

  const handleDecline = async () => {
    await respond.run(false)
    navigate('/driver/online')
  }

  return (
    <div className="flex-1 flex flex-col">
      <div className="relative">
        <MapView className="h-56 shrink-0" aria-label="Carte de la demande chauffeur">
          <div className="absolute inset-0 z-0 bg-taga-navy/55" />
          <p className="absolute left-0 right-0 top-5 z-[3] text-center text-[10px] font-bold tracking-[0.18em] text-white/70">NOUVELLE DEMANDE</p>
          <DriverRideMap phase="request" />
        </MapView>
        <div className="absolute left-4 top-4 z-10">
          <BackButton to={ROUTES.driverOnline} />
        </div>
      </div>

      <div className="flex-1 bg-white -mt-6 rounded-t-3xl px-5 py-5 flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-gray-400">TU GAGNES</p>
            <p className="font-bold text-3xl">{new Intl.NumberFormat('fr-FR').format(ride.driverEarning)} F</p>
            <p className="text-[10px] text-gray-400">Course total : {new Intl.NumberFormat('fr-FR').format(ride.price)} F · Net : 85%</p>
          </div>
          <div className="flex h-16 w-16 flex-col items-center justify-center rounded-full border-4 border-taga-mango font-bold text-taga-navy">
            <span className="text-lg leading-none">{countdown}</span><span className="text-[8px] uppercase text-gray-400">sec</span>
          </div>
        </div>

        <div className="grid grid-cols-4 gap-1 text-center text-[10px] bg-[#fff7eb] rounded-xl p-3">
          <div><p className="font-bold">{ride.distanceKm} km</p><p className="text-gray-400">DISTANCE</p></div>
          <div><p className="font-bold">~{ride.durationMin} min</p><p className="text-gray-400">DURÉE</p></div>
          <div><p className="font-bold">4.96 ★</p><p className="text-gray-400">NOTE CLIENT</p></div>
          <div><p className="font-bold">3 min</p><p className="text-gray-400">PICKUP</p></div>
        </div>

        <div className="rounded-xl border border-gray-100 px-3 py-2 text-xs text-gray-600">
          <p className="text-[9px] font-bold uppercase tracking-wide text-taga-blue">● Pickup · 3 min</p>
          <p className="mt-1 font-semibold text-taga-navy">{ride.pickupLabel}</p>
          <p className="text-[10px] text-gray-400">{ride.pickupDetail}</p>
          <div className="my-1 ml-1 h-3 border-l-2 border-dashed border-taga-mango" />
          <p className="text-[9px] font-bold uppercase tracking-wide text-taga-mango">Destination</p>
          <p className="mt-1 font-semibold text-taga-navy">{ride.dropoffLabel}</p>
          <p className="text-[10px] text-gray-400">Centre-ville · {ride.distanceKm} km</p>
        </div>

        {respond.status === 'error' && <InlineBanner variant="error">{respond.error.message}</InlineBanner>}

        <div className="mt-auto flex gap-3">
          <button
            type="button"
            onClick={handleDecline}
            disabled={respond.status === 'pending'}
            className="flex-1 rounded-xl border border-gray-200 py-3 font-semibold text-gray-600 disabled:opacity-40"
          >
            Refuser
          </button>
          <div className="flex-1">
            <PrimaryButton variant="green" onClick={handleAccept} disabled={respond.status === 'pending'}>
              {respond.status === 'pending'
                ? 'Connexion...'
                : `Accepter · ${new Intl.NumberFormat('fr-FR').format(ride.driverEarning)} F`}
            </PrimaryButton>
          </div>
        </div>
      </div>
    </div>
  )
}
```

Note: this pauses the 9-second countdown while a response is `pending`, so an in-flight accept/decline can't be pre-empted by the countdown's auto-navigate. This is a small, deliberate behavior change over the countdown always running.

- [ ] **Step 3: Manual verification**

Run: `npm run dev`, go to driver "En ligne" → wait for the incoming request (or navigate to it). Click "Accepter" repeatedly across reloads: expect "Connexion..." then either navigation to `/driver/navigation` (~55%), "Cette course vient d'être prise..." (~15%), or a generic network error banner (~30% of the remaining).

- [ ] **Step 4: Commit**

```bash
git add src/services/driverRequestService.js src/screens/driver/IncomingRequest.jsx
git commit -m "feat: simulate accept/decline states on the incoming-request screen"
```

---

### Task 11: Paiement — chargement / erreur réseau / données indisponibles / absence de résultat / action en cours / réussie / impossible

**Files:**
- Create: `src/services/paymentMethodsService.js`
- Modify: `src/screens/PaymentMethods.jsx`

**Interfaces:**
- Produces: `fetchPaymentMethods(current: PaymentMethod[]): Promise<PaymentMethod[]>`, `submitPaymentMethod(method: PaymentMethod): Promise<PaymentMethod>`.
- Consumes: `useAsyncData`, `useAsyncAction` (Tasks 3–4), `LoadingState`, `RetryError`, `InlineBanner`, `EmptyState` (Task 6 + existing).

- [ ] **Step 1: Implement the service**

```js
// src/services/paymentMethodsService.js
import { simulate } from './simulate'

export function fetchPaymentMethods(current) {
  return simulate(() => current, {
    errorMessage: {
      network: 'Impossible de charger tes moyens de paiement.',
      unavailable: 'Service de paiement momentanément indisponible.',
    },
    errorKinds: ['network', 'unavailable'],
  })
}

export function submitPaymentMethod(method) {
  const rejected = Math.random() < 0.2
  if (rejected) {
    const error = new Error('Ce compte n’a pas pu être vérifié. Réessaie avec un autre numéro.')
    error.kind = 'rejected'
    return Promise.reject(error)
  }
  return simulate(method, { errorMessage: 'Échec de l’ajout. Vérifie ta connexion.' })
}
```

- [ ] **Step 2: Wire `PaymentMethods.jsx`**

Read the current file first (it already uses `Icon`). Replace its content with:

```jsx
// src/screens/PaymentMethods.jsx
import { useCallback, useState } from 'react'
import { useAppStore } from '../store/useAppStore'
import { fetchPaymentMethods, submitPaymentMethod } from '../services/paymentMethodsService'
import { useAsyncData } from '../hooks/useAsyncData'
import { useAsyncAction } from '../hooks/useAsyncAction'
import PaymentMethodTile from '../components/PaymentMethodTile'
import PrimaryButton from '../components/PrimaryButton'
import AmountTile from '../components/AmountTile'
import BottomNavBar from '../components/BottomNavBar'
import Icon from '../components/Icon'
import EmptyState from '../components/EmptyState'
import LoadingState from '../components/states/LoadingState'
import RetryError from '../components/states/RetryError'
import InlineBanner from '../components/states/InlineBanner'

export default function PaymentMethods() {
  const role = useAppStore((state) => state.role)
  const paymentMethods = useAppStore((state) => state.paymentMethods)
  const setDefaultPaymentMethod = useAppStore((state) => state.setDefaultPaymentMethod)
  const removePaymentMethod = useAppStore((state) => state.removePaymentMethod)
  const addPaymentMethod = useAppStore((state) => state.addPaymentMethod)
  const driverWalletBalance = useAppStore((state) => state.driverWalletBalance)
  const [showAdd, setShowAdd] = useState(false)

  const isDriver = role === 'driver'
  const title = isDriver ? 'Recevoir mes gains sur' : 'Moyens de paiement'
  const subtitle = isDriver
    ? 'Choisis le compte mobile money sur lequel tes gains sont retirés.'
    : 'Choisis comment tu payes tes courses TAGA.'

  const loadMethods = useCallback(() => fetchPaymentMethods(paymentMethods), [paymentMethods])
  const methodsData = useAsyncData(loadMethods, { isEmpty: (data) => data.length === 0 })
  const addAction = useAsyncAction(submitPaymentMethod)

  const handleAdd = async () => {
    try {
      const method = await addAction.run({
        id: `pm${Date.now()}`,
        provider: 'wave',
        label: 'Wave',
        maskedNumber: '01 •••• 0000',
        isDefault: false,
      })
      addPaymentMethod(method)
      setShowAdd(false)
      addAction.reset()
    } catch {
      // handled by addAction.status/error below
    }
  }

  return (
    <div className="flex-1 flex flex-col">
      <div className="flex-1 px-6 pt-8 pb-6 overflow-y-auto">
        <div className="flex items-center gap-3">
          <div className={`w-11 h-11 rounded-xl flex items-center justify-center text-xl shrink-0 ${isDriver ? 'bg-taga-green/10' : 'bg-taga-blue/10'}`}>
            <Icon name={isDriver ? 'wallet' : 'card'} size={21} />
          </div>
          <div>
            <h1 className="text-xl font-bold leading-tight">{title}</h1>
            <p className="text-sm text-gray-400 mt-0.5">{subtitle}</p>
          </div>
        </div>

        {isDriver && (
          <div className="mt-5 rounded-2xl bg-taga-navy px-4 py-4 text-white">
            <p className="text-xs text-white/50">SOLDE DISPONIBLE</p>
            <AmountTile amount={driverWalletBalance} size="xl" tone="light" />
          </div>
        )}

        <p className="text-xs font-semibold text-gray-400 tracking-wide mt-6 mb-2">
          {isDriver ? 'COMPTES DE RETRAIT' : 'MES MOYENS DE PAIEMENT'}
        </p>

        {methodsData.status === 'loading' && <LoadingState label="Chargement de tes moyens de paiement..." />}

        {methodsData.status === 'error' && (
          <RetryError title="Impossible de charger" subtitle={methodsData.error.message} onRetry={methodsData.retry} />
        )}

        {methodsData.status === 'unavailable' && (
          <RetryError icon="alert" title="Service indisponible" subtitle={methodsData.error.message} onRetry={methodsData.retry} />
        )}

        {methodsData.status === 'empty' && (
          <EmptyState icon="card" title="Aucun moyen de paiement" subtitle="Ajoute un compte pour continuer." />
        )}

        {(methodsData.status === 'success' || methodsData.status === 'empty') && (
          <>
            <div className="flex flex-col gap-3">
              {(methodsData.data ?? []).map((method) => (
                <PaymentMethodTile
                  key={method.id}
                  method={method}
                  onSetDefault={setDefaultPaymentMethod}
                  onRemove={(methodsData.data ?? []).length > 1 ? removePaymentMethod : undefined}
                />
              ))}
            </div>

            {showAdd ? (
              <div className="mt-4 border border-gray-100 rounded-xl p-4 flex flex-col gap-3">
                <p className="text-sm text-gray-500">Ajouter Wave (démo) ?</p>
                {addAction.status === 'error' && <InlineBanner variant="error">{addAction.error.message}</InlineBanner>}
                <div className="flex gap-2">
                  <button type="button" onClick={() => setShowAdd(false)} className="flex-1 text-sm font-semibold text-gray-500">
                    Annuler
                  </button>
                  <div className="flex-1">
                    <PrimaryButton onClick={handleAdd} disabled={addAction.status === 'pending'}>
                      {addAction.status === 'pending' ? 'Ajout en cours...' : 'Confirmer'}
                    </PrimaryButton>
                  </div>
                </div>
              </div>
            ) : (
              <button type="button" onClick={() => setShowAdd(true)} className="mt-4 text-sm font-semibold text-taga-blue text-left">
                + Ajouter un moyen de paiement
              </button>
            )}
          </>
        )}

        <div className="mt-6 flex items-start gap-2 bg-gray-50 rounded-xl px-3 py-3">
          <Icon name="lock" size={16} className="mt-0.5 shrink-0 text-taga-blue" />
          <p className="text-xs text-gray-500 leading-relaxed">
            {isDriver
              ? 'Tes gains sont crédités automatiquement après chaque course terminée, retrait instantané et sans frais.'
              : 'Tes informations de paiement sont chiffrées. TAGA ne stocke jamais ton code secret mobile money.'}
          </p>
        </div>
      </div>

      <BottomNavBar />
    </div>
  )
}
```

- [ ] **Step 3: Manual verification**

Run: `npm run dev`, go to "Moyens de paiement". Reload several times: expect a brief loading state, then the list (most of the time), occasionally a retry error. Click "+ Ajouter..." → "Confirmer" repeatedly: expect "Ajout en cours...", then either the new Wave method appearing in the list or an inline error ("Ce compte n'a pas pu être vérifié..." or a generic network message).

- [ ] **Step 4: Commit**

```bash
git add src/services/paymentMethodsService.js src/screens/PaymentMethods.jsx
git commit -m "feat: add loading/error/action states to the payment methods screen"
```

---

### Task 12: Retrait chauffeur — chargement / action en cours / réussie / impossible / erreur réseau / données indisponibles

**Files:**
- Create: `src/services/payoutService.js`
- Modify: `src/screens/driver/PayoutRecap.jsx`

**Interfaces:**
- Produces: `fetchWalletBalance(current: number): Promise<number>`, `requestWithdrawal(amount: number): Promise<{ requested: true }>`.
- Consumes: `useAsyncData`, `useAsyncAction` (Tasks 3–4), `LoadingState`, `RetryError`, `InlineBanner` (Task 6).

- [ ] **Step 1: Implement the service**

```js
// src/services/payoutService.js
import { simulate } from './simulate'

const MIN_WITHDRAWAL = 1000

export function fetchWalletBalance(current) {
  return simulate(() => current, {
    errorMessage: {
      network: 'Impossible de charger ton solde.',
      unavailable: 'Service de retrait momentanément indisponible.',
    },
    errorKinds: ['network', 'unavailable'],
  })
}

export function requestWithdrawal(amount) {
  if (amount < MIN_WITHDRAWAL) {
    const error = new Error(`Le montant minimum de retrait est de ${MIN_WITHDRAWAL} F CFA.`)
    error.kind = 'rejected'
    return Promise.reject(error)
  }
  return simulate(
    { requested: true },
    { errorMessage: 'Échec du retrait. Vérifie ta connexion à l’opérateur mobile money.' },
  )
}
```

- [ ] **Step 2: Wire `PayoutRecap.jsx`**

Read the current file first. Replace its content with:

```jsx
// src/screens/driver/PayoutRecap.jsx
import { useCallback, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAppStore } from '../../store/useAppStore'
import { fetchWalletBalance, requestWithdrawal } from '../../services/payoutService'
import { useAsyncData } from '../../hooks/useAsyncData'
import { useAsyncAction } from '../../hooks/useAsyncAction'
import AmountTile from '../../components/AmountTile'
import PrimaryButton from '../../components/PrimaryButton'
import LoadingState from '../../components/states/LoadingState'
import RetryError from '../../components/states/RetryError'
import InlineBanner from '../../components/states/InlineBanner'

export default function PayoutRecap() {
  const navigate = useNavigate()
  const driverWalletBalance = useAppStore((state) => state.driverWalletBalance)
  const ride = useAppStore((state) => state.ride)
  const paymentMethods = useAppStore((state) => state.paymentMethods)
  const [selectedPayout, setSelectedPayout] = useState('orange_money')

  const loadBalance = useCallback(() => fetchWalletBalance(driverWalletBalance), [driverWalletBalance])
  const balanceData = useAsyncData(loadBalance)
  const withdrawal = useAsyncAction(requestWithdrawal)

  const handleWithdrawal = () => {
    withdrawal.run(balanceData.data ?? 0).catch(() => {})
  }

  return (
    <div className="flex-1 overflow-y-auto bg-[#f4f6fa] px-5 py-7 text-taga-navy flex flex-col gap-4">
      <div><p className="text-taga-green text-xs font-semibold">● COURSE TERMINÉE · 10:42</p><h1 className="text-2xl font-bold mt-2">Bien joué chef.</h1><p className="text-gray-500 text-sm">Akissi t'a mis 5★.</p></div>

      {balanceData.status === 'loading' && <LoadingState label="Chargement de ton solde..." />}

      {balanceData.status === 'error' && (
        <RetryError title="Impossible de charger ton solde" subtitle={balanceData.error.message} onRetry={balanceData.retry} />
      )}

      {balanceData.status === 'unavailable' && (
        <RetryError icon="alert" title="Service indisponible" subtitle={balanceData.error.message} onRetry={balanceData.retry} />
      )}

      {balanceData.status === 'success' && (
        <>
          <div className="rounded-2xl bg-gradient-to-br from-taga-green via-taga-navy to-[#6a4d4d] p-4 text-white shadow-sm"><div className="flex items-start justify-between"><p className="text-xs text-white/60">SOLDE DISPONIBLE</p><p className="text-[10px] text-white/60">SAM. 24 AVR. · 19H32</p></div><AmountTile amount={balanceData.data} size="xl" tone="light" /><p className="mt-2 text-[10px] text-white/70">Aujourd'hui · 10 courses &nbsp; Heures · 6h12</p></div>
          <div className="rounded-2xl bg-white p-4 flex items-center justify-between text-sm shadow-sm"><div><p className="text-gray-400 text-[10px]">DERNIÈRE COURSE</p><p className="font-semibold">{ride.pickupLabel.split(',')[0]} → {ride.dropoffLabel.split(',')[0]}</p><p className="text-[10px] text-gray-400">{ride.distanceKm} km · {ride.durationMin} min · ★ 5.0</p></div><p className="text-taga-green font-bold">+{new Intl.NumberFormat('fr-FR').format(ride.driverEarning)} F</p></div>
          <div>
            <p className="text-xs text-gray-400 mb-2">RETRAIT MOBILE MONEY</p>
            <div className="rounded-2xl bg-white p-3 shadow-sm">
              <p className="text-sm font-semibold">Retire tes gains, sans frais</p>
              <div className="mt-3 grid grid-cols-2 gap-2">
                {paymentMethods.map((method) => (
                  <button key={method.id} type="button" onClick={() => setSelectedPayout(method.provider)} className={`rounded-xl border p-3 text-left ${selectedPayout === method.provider ? 'border-taga-blue bg-taga-blue/5' : 'border-gray-100 bg-gray-50'}`}>
                    <span className={`flex h-6 w-6 items-center justify-center rounded-md text-[8px] font-bold text-white ${method.provider === 'orange_money' ? 'bg-orange-500' : 'bg-sky-500'}`}>{method.provider === 'orange_money' ? 'OM' : 'WV'}</span>
                    <span className="mt-2 block text-[10px] font-semibold">{method.label}</span>
                    <span className="block text-[9px] text-gray-400">{method.maskedNumber}</span>
                  </button>
                ))}
              </div>
            </div>

            {withdrawal.status === 'success' ? (
              <div role="status" className="mt-3 rounded-xl bg-taga-green/10 px-4 py-3 text-sm text-taga-green">
                Demande de retrait enregistrée. Le statut sera actualisé dès confirmation du service.
              </div>
            ) : (
              <>
                {withdrawal.status === 'error' && (
                  <div className="mt-3">
                    <InlineBanner variant="error">{withdrawal.error.message}</InlineBanner>
                  </div>
                )}
                <div className="mt-3">
                  <PrimaryButton variant="mango" onClick={handleWithdrawal} disabled={withdrawal.status === 'pending'}>
                    {withdrawal.status === 'pending'
                      ? 'Retrait en cours...'
                      : `Retirer ${new Intl.NumberFormat('fr-FR').format(balanceData.data)} F sur ${selectedPayout === 'wave' ? 'Wave' : 'Orange Money'} →`}
                  </PrimaryButton>
                </div>
              </>
            )}
          </div>
        </>
      )}

      <button type="button" onClick={() => navigate('/driver/online')} className="mt-auto rounded-xl border border-taga-navy py-3 font-semibold">Reprendre en ligne</button>
    </div>
  )
}
```

- [ ] **Step 3: Manual verification**

Run: `npm run dev`, complete a ride as driver to reach the payout recap screen (or navigate directly). Reload several times: expect a brief loading state, then the balance (most of the time) or a retry error. Click "Retirer..." repeatedly: expect "Retrait en cours...", then either the success banner or an inline network error (~35%).

- [ ] **Step 4: Commit**

```bash
git add src/services/payoutService.js src/screens/driver/PayoutRecap.jsx
git commit -m "feat: add loading/error/action states to the driver payout screen"
```

---

### Task 13: Historique — chargement / erreur réseau / données indisponibles / absence de résultat

**Files:**
- Create: `src/services/rideHistoryService.js`
- Modify: `src/screens/RideHistory.jsx`

**Interfaces:**
- Produces: `fetchRideHistory(current: Ride[]): Promise<Ride[]>`.
- Consumes: `useAsyncData` (Task 4), `LoadingState`, `RetryError` (Task 6), existing `EmptyState`.

- [ ] **Step 1: Implement the service**

```js
// src/services/rideHistoryService.js
import { simulate } from './simulate'

export function fetchRideHistory(current) {
  return simulate(() => current, {
    errorMessage: {
      network: 'Impossible de charger ton historique.',
      unavailable: 'Historique momentanément indisponible.',
    },
    errorKinds: ['network', 'unavailable'],
  })
}
```

- [ ] **Step 2: Wire `RideHistory.jsx`**

Replace its content with:

```jsx
// src/screens/RideHistory.jsx
import { useCallback } from 'react'
import { useAppStore } from '../store/useAppStore'
import { fetchRideHistory } from '../services/rideHistoryService'
import { useAsyncData } from '../hooks/useAsyncData'
import RideHistoryTile from '../components/RideHistoryTile'
import EmptyState from '../components/EmptyState'
import LoadingState from '../components/states/LoadingState'
import RetryError from '../components/states/RetryError'
import BottomNavBar from '../components/BottomNavBar'

export default function RideHistory() {
  const role = useAppStore((state) => state.role)
  const rideHistory = useAppStore((state) => state.rideHistory)
  const mode = role === 'driver' ? 'driver' : 'passenger'

  const loadHistory = useCallback(() => fetchRideHistory(rideHistory), [rideHistory])
  const historyData = useAsyncData(loadHistory, { isEmpty: (data) => data.length === 0 })

  return (
    <div className="flex-1 flex flex-col">
      <div className="px-6 pt-8 pb-4">
        <h1 className="text-xl font-bold">Historique des courses</h1>
      </div>

      {historyData.status === 'loading' && <LoadingState label="Chargement de ton historique..." />}

      {historyData.status === 'error' && (
        <RetryError title="Impossible de charger" subtitle={historyData.error.message} onRetry={historyData.retry} />
      )}

      {historyData.status === 'unavailable' && (
        <RetryError icon="alert" title="Historique indisponible" subtitle={historyData.error.message} onRetry={historyData.retry} />
      )}

      {historyData.status === 'empty' && (
        <EmptyState icon="receipt" title="Aucune course pour l'instant" subtitle="Vos trajets terminés apparaîtront ici." />
      )}

      {historyData.status === 'success' && (
        <div className="flex-1 px-6 overflow-y-auto">
          {historyData.data.map((ride) => (
            <RideHistoryTile key={ride.id} ride={ride} mode={mode} />
          ))}
        </div>
      )}

      <BottomNavBar />
    </div>
  )
}
```

- [ ] **Step 3: Manual verification**

Run: `npm run dev`, go to "Trajets"/"Courses". Reload several times: expect a brief loading state, then the list (most of the time) or a retry error (~35%).

- [ ] **Step 4: Commit**

```bash
git add src/services/rideHistoryService.js src/screens/RideHistory.jsx
git commit -m "feat: add loading/error states to the ride history screen"
```

---

### Task 14: Profil — chargement / erreur réseau / données indisponibles

**Files:**
- Create: `src/services/profileService.js`
- Modify: `src/screens/Profile.jsx`

**Interfaces:**
- Produces: `fetchProfile(current: Profile): Promise<Profile>`.
- Consumes: `useAsyncData` (Task 4), `LoadingState`, `RetryError` (Task 6).

- [ ] **Step 1: Implement the service**

```js
// src/services/profileService.js
import { simulate } from './simulate'

export function fetchProfile(current) {
  return simulate(() => current, {
    errorMessage: {
      network: 'Impossible de charger ton profil.',
      unavailable: 'Service profil momentanément indisponible.',
    },
    errorKinds: ['network', 'unavailable'],
  })
}
```

- [ ] **Step 2: Wire `Profile.jsx`**

Read the current file first. Replace its content with:

```jsx
// src/screens/Profile.jsx
import { useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAppStore } from '../store/useAppStore'
import { fetchProfile } from '../services/profileService'
import { useAsyncData } from '../hooks/useAsyncData'
import RatingStars from '../components/RatingStars'
import BottomNavBar from '../components/BottomNavBar'
import LoadingState from '../components/states/LoadingState'
import RetryError from '../components/states/RetryError'

export default function Profile() {
  const navigate = useNavigate()
  const profile = useAppStore((state) => state.profile)
  const role = useAppStore((state) => state.role)
  const setRole = useAppStore((state) => state.setRole)
  const logout = useAppStore((state) => state.logout)

  const loadProfile = useCallback(() => fetchProfile(profile), [profile])
  const profileData = useAsyncData(loadProfile)

  const switchRole = () => {
    const nextRole = role === 'driver' ? 'passenger' : 'driver'
    setRole(nextRole)
    navigate(nextRole === 'driver' ? '/driver/online' : '/client/home')
  }

  const handleLogout = () => {
    logout()
    navigate('/role-choice')
  }

  if (profileData.status === 'loading') return <LoadingState label="Chargement de ton profil..." />

  if (profileData.status === 'error') {
    return <RetryError title="Impossible de charger ton profil" subtitle={profileData.error.message} onRetry={profileData.retry} />
  }

  if (profileData.status === 'unavailable') {
    return <RetryError icon="alert" title="Service indisponible" subtitle={profileData.error.message} onRetry={profileData.retry} />
  }

  const loadedProfile = profileData.data
  const initials = loadedProfile.fullName
    .split(' ')
    .map((part) => part[0])
    .join('')
    .slice(0, 2)

  return (
    <div className="flex-1 flex flex-col">
      <div className="px-6 pt-8 pb-6 flex flex-col items-center text-center border-b border-gray-100">
        <div className="w-16 h-16 rounded-full bg-taga-blue text-white flex items-center justify-center text-xl font-bold">
          {initials}
        </div>
        <p className="font-bold text-lg mt-3">{loadedProfile.fullName}</p>
        <p className="text-sm text-gray-400">{loadedProfile.phone}</p>
        <div className="mt-2">
          <RatingStars value={Math.round(loadedProfile.ratingAvg)} readOnly />
        </div>
      </div>

      {loadedProfile.hasDriverProfile && loadedProfile.driverVerificationStatus !== 'verified' && (
        <div className="mx-6 mt-4 bg-taga-mango/10 text-taga-mango text-xs font-semibold rounded-lg px-3 py-2">
          Vérification chauffeur {loadedProfile.driverVerificationStatus === 'pending' ? 'en cours' : 'refusée'}.
        </div>
      )}

      {!loadedProfile.fullName || !loadedProfile.email ? (
        <button
          type="button"
          onClick={() => navigate('/complete-profile')}
          className="mx-6 mt-4 flex items-center justify-between rounded-xl border border-taga-mango/30 bg-taga-mango/10 px-4 py-3 text-left"
        >
          <span>
            <strong className="block text-sm text-taga-navy">Profil à compléter</strong>
            <span className="text-xs text-gray-500">Ajoutez vos informations pour continuer.</span>
          </span>
          <span className="text-taga-mango" aria-hidden="true">→</span>
        </button>
      ) : (
        <div className="mx-6 mt-4 flex items-center gap-2 rounded-xl bg-taga-green/10 px-4 py-3 text-xs font-semibold text-taga-green" role="status">
          <span aria-hidden="true">✓</span>
          Profil complété
        </div>
      )}

      <div className="flex-1 px-6 py-4 flex flex-col gap-1">
        <button
          type="button"
          onClick={() => navigate('/complete-profile')}
          className="flex items-center justify-between py-3 border-b border-gray-100 text-left"
        >
          <span className="text-sm font-medium">Modifier mon profil</span>
          <span className="text-gray-300">→</span>
        </button>
        <button
          type="button"
          onClick={() => navigate('/payment-methods')}
          className="flex items-center justify-between py-3 border-b border-gray-100 text-left"
        >
          <span className="text-sm font-medium">Moyens de paiement</span>
          <span className="text-gray-300">→</span>
        </button>
        <button
          type="button"
          onClick={() => navigate('/ride-history')}
          className="flex items-center justify-between py-3 border-b border-gray-100 text-left"
        >
          <span className="text-sm font-medium">Historique des courses</span>
          <span className="text-gray-300">→</span>
        </button>

        {loadedProfile.hasDriverProfile && (
          <button
            type="button"
            onClick={switchRole}
            className="flex items-center justify-between py-3 border-b border-gray-100 text-left"
          >
            <span className="text-sm font-medium">
              Basculer en mode {role === 'driver' ? 'passager' : 'chauffeur'}
            </span>
            <span className="text-gray-300">→</span>
          </button>
        )}

        <button type="button" onClick={handleLogout} className="flex items-center py-3 text-left text-red-500">
          <span className="text-sm font-medium">Déconnexion</span>
        </button>
      </div>

      <BottomNavBar />
    </div>
  )
}
```

- [ ] **Step 3: Manual verification**

Run: `npm run dev`, go to "Profil". Reload several times: expect a brief loading state, then the profile (most of the time) or a retry error (~35%).

- [ ] **Step 4: Commit**

```bash
git add src/services/profileService.js src/screens/Profile.jsx
git commit -m "feat: add loading/error states to the profile screen"
```

---

### Task 15: Final pass — lint, build, full test suite

**Files:** none (verification only)

- [ ] **Step 1: Run the full test suite**

Run: `npm test`
Expected: all tests across `simulate.test.js`, `useAsyncAction.test.js`, `useAsyncData.test.js` pass.

- [ ] **Step 2: Run lint**

Run: `npm run lint`
Expected: no errors (warnings acceptable only if they pre-existed before this plan).

- [ ] **Step 3: Run the production build**

Run: `npm run build`
Expected: build succeeds with no errors.

- [ ] **Step 4: Full manual walkthrough**

Run: `npm run dev` and walk the whole flow once as passenger and once as driver, per the spec's screen table, confirming each listed state is reachable within a few reloads/retries.

- [ ] **Step 5: Commit (only if Steps 1–3 required fixes)**

```bash
git add -A
git commit -m "fix: address lint/build issues found in final verification pass"
```
