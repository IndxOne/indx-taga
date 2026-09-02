import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const migration = readFileSync(resolve(process.cwd(), 'supabase/migrations/003_dispatch.sql'), 'utf8')
const compositeFix = readFileSync(resolve(process.cwd(), 'supabase/migrations/004_dispatch_composite_fix.sql'), 'utf8')

describe('contrat backend Dispatch — Lot 3', () => {
  it('définit la disponibilité et les prérequis serveur', () => {
    expect(migration).toContain('add column available_since timestamptz')
    expect(migration).toContain('set_driver_availability(p_available boolean)')
    expect(migration).toContain("driver_row.verification_status <> 'verified'")
    expect(migration).toContain("v.status = 'active'")
    expect(migration).toContain("availability_status = case when p_available then 'available' else 'offline' end")
    expect(migration).toContain("pg_catalog.set_config('taga.server_operation', 'dispatch', true)")
  })

  it('fige la sélection, la concurrence et les délais', () => {
    expect(migration).toContain('create table public.ride_dispatch_offers')
    expect(migration).toContain("'offered',\n  'accepted',\n  'rejected',\n  'expired'")
    expect(migration).toContain('now() + interval \'30 seconds\'')
    expect(migration).toContain('now() + interval \'120 seconds\'')
    expect(migration).toContain('ride_dispatch_one_active_driver_offer')
    expect(migration).toContain('ride_dispatch_one_active_ride_offer')
    expect(migration).toContain('for update of dp skip locked')
    expect(migration).toMatch(/order by dp\.available_since asc nulls last, dp\.user_id/)
  })

  it('réserve les opérations sensibles aux RPC authentifiées', () => {
    expect(migration).toContain('revoke execute on function public.create_next_ride_dispatch_offer(uuid) from public, anon, authenticated')
    expect(migration).toContain('grant execute on function public.set_driver_availability(boolean) to authenticated')
    expect(migration).toContain('grant execute on function public.request_ride_dispatch(uuid) to authenticated')
    expect(migration).toContain('grant execute on function public.respond_to_ride_offer(uuid, text) to authenticated')
    expect(migration).toContain('grant execute on function public.expire_ride_dispatch_offer(uuid) to authenticated')
    expect(migration).toContain('p_ride_id uuid')
    expect(migration).toContain('and r.passenger_id = current_user_id')
    expect(migration).toContain('and o.driver_id = current_user_id')
  })

  it('autorise au chauffeur assigné la lecture de sa course sans donner d’écriture directe', () => {
    expect(migration).toContain('rides_select_assigned_driver')
    expect(migration).toContain('(select auth.uid()) = driver_id')
    expect(migration).toContain('ride_dispatch_offers_select_participant')
    expect(migration).toContain('alter table public.ride_dispatch_offers enable row level security')
    expect(migration).not.toContain('grant insert on public.ride_dispatch_offers')
    expect(migration).not.toContain('grant update on public.ride_dispatch_offers')
  })

  it('ignore le retour composite de l’allocation dans le correctif SQL', () => {
    expect(compositeFix).toContain('perform public.create_next_ride_dispatch_offer(p_ride_id)')
    expect(compositeFix).not.toContain('into ignored_offer')
    expect(compositeFix).toContain('create or replace function public.request_ride_dispatch(p_ride_id uuid)')
  })
})
