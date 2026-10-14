import { readFileSync, readdirSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

// Garde-fou documentaire : la migration 012 révoque create_ride aux clients. Aucune doc
// ne doit redevenir une procédure opérationnelle qui la contredit. On teste la présence
// des consignes de sécurité actuelles, pas des phrases exactes.
const read = (path) => readFileSync(resolve(process.cwd(), path), 'utf8')
const rides = read('docs/backend-rides.md')
const section = (md, title) => {
  const start = md.search(new RegExp(`^#{2,3} ${title}`, 'm'))
  if (start < 0) return ''
  const body = md.slice(start).replace(/^.*\n/, '')
  const next = body.search(/^#{2,3} /m)
  return md.slice(start, start + (md.slice(start).length - body.length) + (next < 0 ? body.length : next))
}

describe('docs/backend-rides.md — cohérent avec la migration 012', () => {
  it('renvoie à la procédure de référence et exige un inventaire des migrations', () => {
    const current = section(rides, 'Recette Supabase actuelle')
    expect(current).toContain('staging-recette.md')
    expect(current).toMatch(/inventaire/i)
    expect(current).toMatch(/seed_test_ride/)
    expect(rides).toMatch(/seed_test_ride/)
  })

  it('déclare 011 et 012 non appliquées et l’ancienne procédure obsolète', () => {
    expect(rides).toMatch(/011[\s\S]{0,40}012[\s\S]{0,40}(non|pas)\W*\s+appliqu/i)
    expect(section(rides, 'Procédure historique')).toMatch(/obsol[èe]te|plus ex[ée]cutable/i)
  })

  it('maintient create_ride refusée aux clients, FlutterFlow compris', () => {
    expect(rides).toMatch(/42501/)
    expect(section(rides, 'FlutterFlow')).toMatch(/ne peut pas appeler/i)
    expect(section(rides, 'Réactivation')).toMatch(/aucune réactivation/i)
  })

  it('ne redonne pas l’ancienne recette contradictoire', () => {
    expect(rides).not.toMatch(/Recette Supabase requise/i)
    expect(rides).not.toMatch(/passager actif peut appeler `create_ride`/i)
    // Hors section obsolète et hors section Réactivation : aucun ordre d’appliquer 001/002 ou d’ouvrir l’accès.
    const operational = rides
      .replace(section(rides, 'Procédure historique'), '')
      .replace(section(rides, 'Réactivation'), '')
    expect(operational).not.toMatch(/appliquer d['’]abord/i)
    expect(operational).not.toMatch(/grant\s+execute\s+on\s+function\s+public\.create_ride/i)
  })

  it('les docs d’exploitation Supabase renvoient à l’inventaire préalable', () => {
    for (const file of ['docs/backend-auth.md', 'docs/lot4a-geolocation-realtime.md']) {
      expect(read(file), file).toContain('staging-recette.md')
    }
    const recette = read('docs/staging-recette.md')
    expect(recette).toMatch(/inventaire/i)
    expect(recette).toMatch(/011[\s\S]{0,40}012[\s\S]{0,60}pas\W*\s+appliqu/i)
  })

  it('aucune doc ne recommande d’accorder create_ride ou d’utiliser service_role comme contournement', () => {
    for (const file of readdirSync(resolve(process.cwd(), 'docs')).filter((f) => f.endsWith('.md'))) {
      const body = read(`docs/${file}`)
      if (file === 'backend-rides.md') continue // couvert ci-dessus (section Réactivation conditionnelle)
      expect(body, file).not.toMatch(/grant\s+execute\s+on\s+function\s+public\.create_ride/i)
    }
    expect(read('docs/staging-recette.md')).toMatch(/service_role[^.\n]*jamais un contournement|jamais un contournement/i)
  })
})
