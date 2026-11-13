/**
 * Development environment (Supabase local: `npm run db:start` en la raíz).
 * La publishable key local es la de demo del CLI (no es un secreto).
 */
export const environment = {
  production: false,
  supabaseUrl: 'http://127.0.0.1:44321',
  supabaseKey: 'sb_publishable_ACJWlzQHlZjBrEguHvfOxg_3BJgxAaH',
  /** Botones de Google y Discord. Activar solo si el proveedor está habilitado en supabase/config.toml. */
  oauthEnabled: false,
};
