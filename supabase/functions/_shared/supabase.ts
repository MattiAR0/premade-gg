// Cliente admin (service role) y verificación del usuario que llama.
import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2.118.0';
import { HttpError } from './http.ts';

export const admin: SupabaseClient = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  { auth: { persistSession: false, autoRefreshToken: false } },
);

/** Devuelve el usuario autenticado a partir del header Authorization: Bearer <jwt>. */
export const requireUser = async (req: Request) => {
  const token = req.headers.get('Authorization')?.replace(/^Bearer\s+/i, '');
  if (!token) throw new HttpError(401, 'Debes iniciar sesión');
  const { data, error } = await admin.auth.getUser(token);
  if (error || !data.user) throw new HttpError(401, 'Sesión inválida o expirada');
  return data.user;
};

/** Perfil en formato de la API (_id, camelCase), igual que la RPC get_me. */
export const userJson = async (userId: string, email?: string | null) => {
  const { data, error } = await admin.rpc('user_json_by_id', { p_id: userId });
  if (error) throw error;
  return { ...data, email: email ?? undefined };
};
