/**
 * Production environment
 *
 * Valores en Supabase Dashboard → Project Settings → API:
 *   · Project URL        → supabaseUrl
 *   · Publishable key    → supabaseKey (pública por diseño; la seguridad la dan las políticas RLS)
 */
export const environment = {
  production: true,
  supabaseUrl: 'https://YOUR_PROJECT_REF.supabase.co',
  supabaseKey: 'YOUR_SUPABASE_PUBLISHABLE_KEY',
};
