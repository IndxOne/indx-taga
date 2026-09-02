import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const enumMigration = readFileSync(resolve(process.cwd(), 'supabase/migrations/007_dispatch_offer_cancellation.sql'), 'utf8')
const migration = readFileSync(resolve(process.cwd(), 'supabase/migrations/008_cancel_ride_search.sql'), 'utf8')

describe('contrat annulation et reprise de recherche', () => {
  it('distingue les offres annulées des offres expirées', () => {
    expect(enumMigration).toContain("add value if not exists 'cancelled'")
    expect(migration).toContain("status = 'cancelled'")
  })

  it('réserve l’annulation au passager propriétaire et ferme ses offres actives', () => {
    expect(migration).toContain('create or replace function public.cancel_ride_search')
    expect(migration).toContain('and r.passenger_id = current_user_id')
    expect(migration).toMatch(/ride_row\.status not in \('requested', 'searching'\)/)
    expect(migration).toContain("where ride_id = ride_row.id")
    expect(migration).toContain("and status = 'offered'")
    expect(migration).toContain("set status = 'cancelled'")
    expect(migration).toContain("values (ride_row.id, 'cancelled', current_user_id)")
    expect(migration).toContain('revoke execute on function public.cancel_ride_search(uuid) from public, anon')
  })

  it('permet une nouvelle tentative uniquement après no_driver', () => {
    expect(migration).toContain('create or replace function public.retry_ride_search')
    expect(migration).toContain("if ride_row.status <> 'no_driver' then")
    expect(migration).toContain("set status = 'requested'")
    expect(migration).toContain('driver_id = null')
    expect(migration).toContain('grant execute on function public.retry_ride_search(uuid) to authenticated')
  })
})
