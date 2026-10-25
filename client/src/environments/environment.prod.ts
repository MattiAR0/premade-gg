/**
 * Production environment
 *
 * Valores en Supabase Dashboard → Project Settings → API:
 *   · Project URL        → supabaseUrl
 *   · Publishable key    → supabaseKey (pública por diseño; la seguridad la dan las políticas RLS)
 */
export const environment = {
  production: true,
  supabaseUrl: 'https://taprgsiozhwralnzqxri.supabase.co',
  supabaseKey: 'sb_publishable_7Wns5ZkfRi0h6al1ZpZnHA_M8NVss_j',
};
