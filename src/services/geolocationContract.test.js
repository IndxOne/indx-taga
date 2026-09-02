import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const migration = readFileSync(resolve(process.cwd(), 'supabase/migrations/005_live_driver_locations.sql'), 'utf8')

describe('contrat backend Géolocalisation — Lot 4A', () => {
  it('conserve une seule position courante par course et valide les coordonnées', () => {
    expect(migration).toContain('create table public.driver_locations')
    expect(migration).toContain('ride_id uuid primary key')
    expect(migration).toContain('latitude double precision not null')
    expect(migration).toContain('longitude double precision not null')
    expect(migration).toContain('latitude between -90 and 90')
    expect(migration).toContain('longitude between -180 and 180')
    expect(migration).toContain('recorded_at timestamptz not null default now()')
  })

  it('dérive le chauffeur de auth.uid et interdit les écritures directes', () => {
    expect(migration).toContain('current_user_id uuid := (select auth.uid())')
    expect(migration).toContain('and r.driver_id = current_user_id')
    expect(migration).toContain('create or replace function public.publish_driver_location')
    expect(migration).toContain('on conflict (ride_id) do update')
    expect(migration).toContain('revoke all on public.driver_locations from anon, authenticated')
    expect(migration).not.toContain('grant insert on public.driver_locations')
    expect(migration).not.toContain('grant update on public.driver_locations')
    expect(migration).not.toContain('grant delete on public.driver_locations')
  })

  it('limite la lecture aux participants d’une course active', () => {
    expect(migration).toContain('driver_locations_select_active_participant')
    expect(migration).toMatch(/r.status in \('assigned', 'arriving', 'arrived', 'in_progress'\)/)
    expect(migration).toContain('r.passenger_id = (select auth.uid()) or r.driver_id = (select auth.uid())')
  })

  it('prépare la publication Realtime pour rides et driver_locations', () => {
    expect(migration).toContain("pubname = 'supabase_realtime'")
    expect(migration).toContain('alter publication supabase_realtime add table public.rides')
    expect(migration).toContain('alter publication supabase_realtime add table public.driver_locations')
    expect(migration).toContain('alter table public.rides replica identity full')
    expect(migration).toContain('alter table public.driver_locations replica identity full')
  })
})
