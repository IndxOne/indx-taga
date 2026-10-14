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

// --- Prescriptions de migration : contrôle au niveau du paragraphe -------------------------
// Un paragraphe qui ORDONNE d'appliquer/rejouer une migration doit porter, dans le même
// paragraphe, l'inventaire préalable (ou une négation / un marquage historique explicite).
// Les plans de prototype (docs/superpowers) sont exclus : ce sont des journaux historiques
// sans exploitation Supabase ; le test qui suit vérifie qu'ils n'en contiennent pas.
const listMarkdown = (dir) =>
  readdirSync(resolve(process.cwd(), dir), { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory()
      ? listMarkdown(`${dir}/${entry.name}`)
      : entry.name.endsWith('.md')
        ? [`${dir}/${entry.name}`]
        : [],
  )
const paragraphs = (md) => md.split(/\n\s*\n/).map((p) => p.replace(/\s+/g, ' ').trim()).filter(Boolean)
const MIGRATION_REF = /\b\d{3}_[a-z0-9_]+\.sql\b|\bmigrations?\s+`?\d{3}\b|supabase\s+(db\s+push|migration)|migration\s+up/i
const IMPERATIVE_APPLY =
  /(doivent|doit|faut|devez|dois)\s+(être\s+)?appliqu|\bappliquer\b|\bappliquez\b|\brejou(er|ez)\b|supabase\s+db\s+push|migration\s+up/i
const SAFE_CONTEXT =
  /inventaire|(titre|étape|procédure|exemple)\s+historique|\(historique\)|obsol[èe]te|ne\s+(pas\s+)?(l['’])?appliqu|ne\s+rejou|ni\s+(la\s+)?rejou|aucune\s+migration|n['’]appliquer\s+ni|jamais\s+(rejou|appliqu)/i
const unsafeMigrationInstructions = (md) =>
  paragraphs(md).filter((p) => MIGRATION_REF.test(p) && IMPERATIVE_APPLY.test(p) && !SAFE_CONTEXT.test(p))

describe('docs — instructions de migration', () => {
  const operational = listMarkdown('docs').filter((f) => !f.startsWith('docs/superpowers/'))

  it('aucun paragraphe ne prescrit une migration sans préalable d’inventaire', () => {
    for (const file of operational) {
      expect(unsafeMigrationInstructions(read(file)), file).toEqual([])
    }
  })

  it('le détecteur reconnaît l’ancienne prescription 007/008 (garde-fou du test)', () => {
    const legacy =
      'Les migrations `007_dispatch_offer_cancellation.sql` puis `008_cancel_ride_search.sql` doivent être appliquées dans cet ordre après la migration 006.'
    expect(unsafeMigrationInstructions(legacy)).toHaveLength(1)
    expect(unsafeMigrationInstructions(`${legacy} Inventaire des migrations déjà appliquées d’abord.`)).toEqual([])
    // Le mot « historique » seul (ex. historique des statuts) ne neutralise pas la prescription.
    expect(unsafeMigrationInstructions(`${legacy} Elle écrit l’historique.`)).toHaveLength(1)
    expect(unsafeMigrationInstructions(`À titre historique : ${legacy}`)).toEqual([])
    expect(unsafeMigrationInstructions('Exécuter `supabase db push` sur le projet.')).toHaveLength(1)
  })

  it('les plans historiques (docs/superpowers, docs/qa) ne contiennent aucune exploitation Supabase', () => {
    for (const file of listMarkdown('docs').filter((f) => f.startsWith('docs/superpowers/') || f.startsWith('docs/qa/'))) {
      expect(unsafeMigrationInstructions(read(file)), file).toEqual([])
    }
  })
})

describe('docs/lot4a-geolocation-realtime.md — migrations 005 à 009', () => {
  const lot4a = read('docs/lot4a-geolocation-realtime.md')
  const migrations = section(lot4a, 'Migrations 005 à 009')

  it('garde l’ordre de dépendance 006 → 007 → 008 comme information historique', () => {
    expect(migrations).toMatch(/historique/i)
    expect(migrations).toMatch(/006[\s\S]{0,40}007[\s\S]{0,40}008/)
    expect(migrations).toMatch(/pas\W+une instruction d.ex[ée]cution/i)
  })

  it('impose, dans cette section, lecture de la procédure, projet cible, inventaire et autorisation', () => {
    expect(migrations).toContain('staging-recette.md')
    expect(migrations).toMatch(/identifier le projet cible/i)
    expect(migrations).toMatch(/inventaire des migrations d[ée]j[àa] appliqu/i)
    expect(migrations).toMatch(/aucune migration[\s\S]{0,60}autorisation\s+explicite/i)
  })

  it('ne contient plus de prescription 007/008 isolée dans le contrat backend', () => {
    const rest = lot4a.replace(migrations, '')
    expect(rest).not.toMatch(/doivent\s+être\s+appliqu/i)
  })

  it('décrit la restauration des courses terminées comme en G0 (getCompletedRide, récapitulatif serveur)', () => {
    expect(lot4a).toMatch(/getCompletedRide/)
    expect(lot4a).toMatch(/\/client\/ride-end\/:rideId/)
    expect(lot4a).not.toMatch(/Une course terminée, annulée ou absente redirige vers l[’']accueil/)
  })
})
