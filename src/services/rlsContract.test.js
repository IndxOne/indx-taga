import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const migrationPath = resolve(process.cwd(), 'supabase/migrations/001_profiles_roles.sql')
const sql = readFileSync(migrationPath, 'utf8')

describe('contrat RLS Lot 1', () => {
  it('active RLS sur toutes les tables du lot', () => {
    for (const table of ['profiles', 'passenger_profiles', 'driver_profiles', 'vehicles']) {
      expect(sql).toContain(`alter table public.${table} enable row level security`)
    }
  })

  it('limite les lectures aux lignes appartenant à auth.uid()', () => {
    expect(sql).toMatch(/profiles_select_own[\s\S]*?using \(id = auth\.uid\(\)\)/)
    expect(sql).toMatch(/passenger_profiles_select_own[\s\S]*?user_id = auth\.uid\(\)/)
    expect(sql).toMatch(/driver_profiles_select_own[\s\S]*?user_id = auth\.uid\(\)/)
    expect(sql).toMatch(/vehicles_select_own[\s\S]*?driver_id = auth\.uid\(\)/)
  })

  it('interdit la création d’un profil admin depuis le client', () => {
    expect(sql).toMatch(/profiles_insert_self_non_admin[\s\S]*?role in \('passenger', 'driver'\)/)
  })

  it('protège côté base le rôle, le téléphone et le statut', () => {
    expect(sql).toContain('profiles_prevent_client_authority_changes')
    expect(sql).toMatch(/new\.phone is distinct from old\.phone/)
    expect(sql).toMatch(/new\.role is distinct from old\.role/)
    expect(sql).toMatch(/new\.status is distinct from old\.status/)
  })

  it('réserve la validation, la note, la disponibilité et le statut véhicule au serveur', () => {
    expect(sql).toContain('driver_profiles_prevent_client_authority_changes')
    expect(sql).toMatch(/new\.verification_status is distinct from old\.verification_status/)
    expect(sql).toMatch(/new\.availability_status is distinct from old\.availability_status/)
    expect(sql).toMatch(/new\.rating is distinct from old\.rating/)
    expect(sql).toContain('vehicles_prevent_client_authority_changes')
    expect(sql).toMatch(/new\.driver_id is distinct from old\.driver_id/)
  })

  it('impose des valeurs sûres lors des créations côté client', () => {
    expect(sql).toMatch(/driver_profiles_insert_own[\s\S]*?verification_status = 'pending'/)
    expect(sql).toMatch(/driver_profiles_insert_own[\s\S]*?availability_status = 'offline'/)
    expect(sql).toMatch(/driver_profiles_insert_own[\s\S]*?rating = 0/)
    expect(sql).toMatch(/vehicles_insert_own[\s\S]*?status = 'pending'/)
  })
})
