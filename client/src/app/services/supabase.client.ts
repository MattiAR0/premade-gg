import { createClient, FunctionsHttpError, type PostgrestError } from '@supabase/supabase-js';
import { Observable, defer } from 'rxjs';
import { environment } from '../../environments/environment';

/**
 * Cliente Supabase único para toda la app.
 * La sesión se guarda en localStorage y se refresca sola.
 */
export const supabase = createClient(environment.supabaseUrl, environment.supabaseKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});

/**
 * Error con la misma forma que HttpErrorResponse, para que los componentes
 * sigan leyendo `err.error?.message` y `err.status` sin cambios.
 */
export interface ApiError {
  status: number;
  error: { message: string; code?: string };
}

const STATUS_BY_CODE: Record<string, number> = {
  '42501': 403, // permiso denegado / no autenticado
  P0002: 404, // no encontrado
  '23505': 409, // duplicado
};

export const toApiError = (err: PostgrestError | Error | null, status = 400): ApiError => {
  const code = (err as PostgrestError | null)?.code;
  return {
    status: (code && STATUS_BY_CODE[code]) || status,
    error: { message: err?.message || 'Error inesperado', code },
  };
};

/** Llama a una función RPC de Postgres y emite su resultado (o un ApiError). */
export function rpc<T>(fn: string, args?: Record<string, unknown>): Observable<T> {
  // defer: igual que HttpClient, no se ejecuta hasta que alguien se suscribe
  return defer(async () => {
    const { data, error, status } = await supabase.rpc(fn, args);
    if (error) throw toApiError(error, status);
    return data as T;
  });
}

/** Llama a una Edge Function y emite su JSON (o un ApiError con el `message` del servidor). */
export function invokeFunction<T>(name: string, body: Record<string, unknown>): Observable<T> {
  return defer(async () => {
    const { data, error } = await supabase.functions.invoke<T>(name, { body });
    if (error) {
      if (error instanceof FunctionsHttpError) {
        const res = error.context as Response;
        const payload = await res.json().catch(() => null);
        throw { status: res.status, error: { message: payload?.message || error.message } } as ApiError;
      }
      throw toApiError(error, 502);
    }
    return data as T;
  });
}
