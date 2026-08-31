import { describe, expect, it } from 'vitest'
import { validateRuntimeConfig } from './runtimeConfig'

describe('validateRuntimeConfig', () => {
  it('autorise le mode démo sans configuration backend', () => {
    expect(validateRuntimeConfig({ demoMode: 'true', isDev: false })).toMatchObject({ mode: 'demo', valid: true })
  })

  it('signale explicitement les variables réelles manquantes', () => {
    const config = validateRuntimeConfig({ demoMode: 'false', isDev: false })

    expect(config.valid).toBe(false)
    expect(config.error).toContain('VITE_SUPABASE_URL')
    expect(config.error).toContain('VITE_SUPABASE_ANON_KEY')
  })

  it('valide le mode réel avec la clé publique uniquement', () => {
    expect(validateRuntimeConfig({
      demoMode: 'false',
      supabaseUrl: 'https://example.supabase.co',
      supabaseAnonKey: 'public-key',
      isDev: false,
    })).toMatchObject({ mode: 'real', valid: true })
  })
})
