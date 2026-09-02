import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const migration = readFileSync(resolve(process.cwd(), 'supabase/migrations/002_rides.sql'), 'utf8')

describe('contrat backend Ride — Lot 2', () => {
  it('crée les tables et les types de course sans paiement', () => {
    expect(migration).toContain('create table public.rides')
    expect(migration).toContain('create table public.ride_status_history')
    expect(migration).toContain("create type public.taga_ride_type as enum ('go', 'partage', 'family', 'confort')")
    expect(migration).toContain("'requested'")
    expect(migration).not.toMatch(/payment_status|commission|paid/i)
  })

  it('dérive l’identité de auth.uid et force le statut demandé', () => {
    expect(migration).toContain('current_user_id uuid := (select auth.uid())')
    expect(migration).toContain('current_user_id,')
    expect(migration).toMatch(/p_scheduled_at,\s*\n\s*'requested',\s*\n\s*null\s*\n\s*\)/)
    expect(migration).toContain("values (created_ride.id, 'requested', current_user_id)")
  })

  it('n’accepte ni passenger_id, ni status, ni estimated_price dans la RPC', () => {
    const signature = migration.match(/create or replace function public\.create_ride\(([\s\S]*?)\)\s*returns/)?.[1] || ''
    expect(signature).toContain('p_pickup')
    expect(signature).toContain('p_destination')
    expect(signature).toContain('p_ride_type')
    expect(signature).toContain('p_scheduled_at')
    expect(signature).not.toMatch(/passenger_id|estimated_price|\bstatus\b/i)
  })

  it('retire les écritures directes au rôle authenticated et limite les lectures à son passager', () => {
    expect(migration).toContain('revoke all on public.rides from anon, authenticated')
    expect(migration).toContain('grant select on public.rides to authenticated')
    expect(migration).toMatch(/rides_select_own[\s\S]*?\(select auth\.uid\(\)\) = passenger_id/)
    expect(migration).toMatch(/ride_status_history_select_own[\s\S]*?public\.rides\.passenger_id = \(select auth\.uid\(\)\)/)
  })

  it('sécurise la RPC definer avec un search_path vide et des privilèges minimaux', () => {
    expect(migration).toMatch(/security definer\s*\nset search_path = ''/)
    expect(migration).toContain('revoke execute on function public.create_ride')
    expect(migration).toContain('grant execute on function public.create_ride')
  })
})
