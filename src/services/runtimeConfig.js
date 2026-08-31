const rawDemoMode = import.meta.env.VITE_DEMO_MODE

export function validateRuntimeConfig({
  demoMode = rawDemoMode,
  supabaseUrl = import.meta.env.VITE_SUPABASE_URL,
  supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY,
  isDev = import.meta.env.DEV,
} = {}) {
  const demo = demoMode === 'true' || (demoMode == null && isDev)
  if (demo) {
    return {
      mode: 'demo',
      valid: true,
      supabaseUrl: '',
      supabaseAnonKey: '',
      error: '',
    }
  }

  const missing = []
  if (!supabaseUrl?.trim()) missing.push('VITE_SUPABASE_URL')
  if (!supabaseAnonKey?.trim()) missing.push('VITE_SUPABASE_ANON_KEY')

  return {
    mode: 'real',
    valid: missing.length === 0,
    supabaseUrl: supabaseUrl?.trim() || '',
    supabaseAnonKey: supabaseAnonKey?.trim() || '',
    error: missing.length
      ? `Configuration Supabase incomplète. Variables manquantes : ${missing.join(', ')}.`
      : '',
  }
}

export const runtimeConfig = validateRuntimeConfig()
export const isDemoMode = runtimeConfig.mode === 'demo'
