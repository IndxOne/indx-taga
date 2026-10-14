import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const migration = readFileSync(resolve(process.cwd(), 'supabase/migrations/011_driver_ride_transitions.sql'), 'utf8')
const sqlCode = migration.split('\n').filter((line) => !line.trim().startsWith('--')).join('\n')

describe('contrat backend — transitions chauffeur (011)', () => {
  it('est additive : aucune suppression ni modification destructive', () => {
    expect(sqlCode).not.toMatch(/\bdrop\s+(table|column|function|type|policy)\b/i)
    expect(sqlCode).not.toMatch(/\balter\s+table\b/i)
    expect(sqlCode).not.toMatch(/\bdelete\s+from\b/i)
    expect(sqlCode).not.toMatch(/\btruncate\b/i)
    expect(sqlCode).toContain('create or replace function public.advance_driver_ride')
  })

  it('réserve la RPC aux utilisateurs authentifiés avec un search_path vide', () => {
    expect(sqlCode).toContain('security definer')
    expect(sqlCode).toContain("set search_path = ''")
    expect(sqlCode).toContain('revoke execute on function public.advance_driver_ride(uuid, public.taga_ride_status) from public, anon')
    expect(sqlCode).toContain('grant execute on function public.advance_driver_ride(uuid, public.taga_ride_status) to authenticated')
    expect(sqlCode).not.toMatch(/grant\s+(update|insert|delete)\s+on\s+public\.rides/i)
  })

  it('vérifie session, rôle chauffeur actif et affectation de la course', () => {
    expect(sqlCode).toContain("errcode = '28000'")
    expect(sqlCode).toContain("coalesce(profile_role::text, '') <> 'driver'")
    expect(sqlCode).toContain('and r.driver_id = current_user_id')
    expect(sqlCode).toContain("errcode = '42501'")
  })

  it('verrouille la course et n’autorise que la chaîne séquentielle', () => {
    expect(sqlCode).toContain('for update')
    expect(sqlCode).toContain("ride_row.status = 'assigned' and p_to_status = 'arriving'")
    expect(sqlCode).toContain("ride_row.status = 'arriving' and p_to_status = 'arrived'")
    expect(sqlCode).toContain("ride_row.status = 'arrived' and p_to_status = 'in_progress'")
    expect(sqlCode).toContain("ride_row.status = 'in_progress' and p_to_status = 'completed'")
    expect(sqlCode).toContain("errcode = '55000'")
    expect(sqlCode).toContain("p_to_status not in ('arriving', 'arrived', 'in_progress', 'completed')")
  })

  it('est idempotente et écrit l’historique dans la même transaction', () => {
    expect(sqlCode).toContain('if ride_row.status = p_to_status then')
    expect(sqlCode).toMatch(/insert into public\.ride_status_history \(ride_id, status, actor_id\)\s+values \(ride_row\.id, p_to_status, current_user_id\)/)
  })

  it('libère le chauffeur uniquement à la fin de course et sans autre course active', () => {
    expect(sqlCode).toContain("if p_to_status = 'completed' then")
    expect(sqlCode).toContain("pg_catalog.set_config('taga.server_operation', 'dispatch', true)")
    expect(sqlCode).toContain("set availability_status = 'offline'")
    expect(sqlCode).toContain("and dp.availability_status = 'on_ride'")
    expect(sqlCode).toContain('other.id <> ride_row.id')
    expect(sqlCode).toContain("other.status in ('assigned', 'arriving', 'arrived', 'in_progress')")
  })
})
