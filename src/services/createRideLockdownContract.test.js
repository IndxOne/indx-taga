import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const read = (path) => readFileSync(resolve(process.cwd(), path), 'utf8')
const strip = (sql) => sql.split('\n').filter((line) => !line.trim().startsWith('--')).join('\n')
const migration = strip(read('supabase/migrations/012_create_ride_lockdown.sql'))
const seed = strip(read('supabase/staging/seed_test_ride.sql'))

describe('contrat backend — verrouillage de create_ride (012)', () => {
  it('est additive : ne détruit ni table, ni colonne, ni donnée, et ne touche pas 002/011', () => {
    expect(migration).not.toMatch(/\bdrop\s+(table|column|function|type|policy)\b/i)
    expect(migration).not.toMatch(/\balter\s+table\b/i)
    expect(migration).not.toMatch(/\bcreate\s+table\b/i)
    expect(migration).not.toMatch(/\b(delete\s+from|truncate)\b/i)
    expect(migration).toContain('create or replace function public.create_ride(')
  })

  it('conserve la signature et les protections SECURITY DEFINER / search_path vide', () => {
    expect(migration).toMatch(/create or replace function public\.create_ride\(\s*p_pickup jsonb,\s*p_destination jsonb,\s*p_ride_type public\.taga_ride_type,\s*p_scheduled_at timestamptz default null\s*\)/)
    expect(migration).toMatch(/security definer\s*\nset search_path = ''/)
    expect(migration).toContain('current_user_id uuid := (select auth.uid())')
    expect(migration).toContain("public.profiles.role = 'passenger'")
    expect(migration).toContain("public.profiles.status = 'active'")
    expect(migration).toContain("'requested',\n    null")
  })

  it('valide côté serveur : type numérique, bornes GPS, (0,0), libellé', () => {
    expect(migration).toContain("jsonb_typeof(p_point->'lat') is distinct from 'number'")
    expect(migration).toContain("jsonb_typeof(p_point->'lng') is distinct from 'number'")
    expect(migration).toContain('lat_value not between -90 and 90 or lng_value not between -180 and 180')
    expect(migration).toContain('lat_value = 0 and lng_value = 0')
    expect(migration).toContain("jsonb_typeof(p_point->'label') is distinct from 'string'")
    expect(migration).not.toMatch(/p_(pickup|destination)->>'source'/)
  })

  it('révoque EXECUTE à tout client, y compris les privilèges hérités, sans aucun GRANT', () => {
    expect(migration).toContain('revoke all on function public.create_ride(jsonb, jsonb, public.taga_ride_type, timestamptz) from public, anon, authenticated;')
    expect(migration).toContain('revoke all on function public.taga_normalize_ride_point(jsonb, text) from public, anon, authenticated;')
    expect(migration).not.toMatch(/\bgrant\b/i)
  })
})

describe('dispositif de recette isolé', () => {
  it('n’expose rien aux clients : ni fonction, ni GRANT, ni accès sans confirmation', () => {
    expect(seed).not.toMatch(/create\s+(or\s+replace\s+)?function/i)
    expect(seed).not.toMatch(/\bgrant\b/i)
    expect(seed).toContain('confirm_isolated_staging')
    expect(seed).toContain('\\set expected_admin_role postgres')
    expect(seed).toContain('has_table_privilege')
    expect(seed).not.toMatch(/rolsuper/i)
    expect(seed).not.toMatch(/security\s+definer/i)
    expect(seed).not.toMatch(/create\s+(role|user)/i)
  })
})
