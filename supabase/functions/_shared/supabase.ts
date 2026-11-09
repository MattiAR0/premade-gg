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

/**
 * Límite de frecuencia con la RPC rl_check (solo service_role). Se pasa del límite → 429.
 * Ver 20261105000003_anti_abuso_karma.sql.
 */
export const rateLimit = async (key: string, action: string, limit: number, windowSecs: number) => {
  const { error } = await admin.rpc('rl_check', {
    p_key: key, p_action: action, p_limit: limit, p_secs: windowSecs,
  });
  if (!error) return;
  if (error.code === 'PT429') {
    throw new HttpError(429, 'Has hecho demasiados intentos. Espera unos minutos y vuelve a probar.');
  }
  throw error;
};

/**
 * IP del cliente. cf-connecting-ip la pone Cloudflare (delante de Supabase) y el cliente no
 * puede falsificarla; si no está, la última entrada de x-forwarded-for, que añade el proxy
 * (la primera la puede escribir el cliente).
 */
const clientIp = (req: Request): string =>
  req.headers.get('cf-connecting-ip')?.trim() ||
  req.headers.get('x-forwarded-for')?.split(',').map((p) => p.trim()).filter(Boolean).pop() ||
  req.headers.get('x-real-ip')?.trim() ||
  'unknown';

/**
 * Clave por IP para limitar peticiones sin sesión. Solo se guarda un HMAC de la IP y la fecha
 * con un secreto del servidor: sin el secreto no se puede recuperar la IP probando todas, y
 * cambia cada día. Los contadores se borran a los 2 días.
 */
export const ipKey = async (req: Request): Promise<string> => {
  const secret = Deno.env.get('RATE_LIMIT_SECRET') || Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const day = new Date().toISOString().slice(0, 10);
  const key = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'],
  );
  const mac = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(`${clientIp(req)}|${day}`));
  const hex = Array.from(new Uint8Array(mac), (b) => b.toString(16).padStart(2, '0')).join('');
  return `ip:${hex.slice(0, 32)}`;
};

/** PUUID vinculado a una cuenta (tabla privada riot_identities) o null. */
export const getPuuid = async (userId: string): Promise<string | null> => {
  const { data, error } = await admin.from('riot_identities').select('puuid').eq('user_id', userId).maybeSingle();
  if (error) throw error;
  return (data?.puuid as string | null) ?? null;
};

/** Cuenta que tiene vinculado un PUUID, si hay alguna. */
export const getPuuidOwner = async (puuid: string): Promise<string | null> => {
  const { data, error } = await admin.from('riot_identities').select('user_id').eq('puuid', puuid).maybeSingle();
  if (error) throw error;
  return (data?.user_id as string | null) ?? null;
};

/** Perfil en formato de la API (_id, camelCase), igual que la RPC get_me. */
export const userJson = async (userId: string, email?: string | null) => {
  const { data, error } = await admin.rpc('user_json_by_id', { p_id: userId });
  if (error) throw error;
  return { ...data, email: email ?? undefined };
};
