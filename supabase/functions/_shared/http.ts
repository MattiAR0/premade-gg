// Utilidades HTTP compartidas por las Edge Functions.

// Orígenes que pueden llamar a las funciones desde el navegador. Se pueden añadir más con el
// secreto ALLOWED_ORIGINS (separados por comas), por ejemplo para un dominio propio.
const DEFAULT_ORIGINS = ['https://premade-gg.vercel.app'];
const LOCAL_ORIGIN = /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/;

const allowedOrigins = (): string[] => [
  ...DEFAULT_ORIGINS,
  ...(Deno.env.get('ALLOWED_ORIGINS') ?? '')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean),
];

const isAllowedOrigin = (origin: string | null): origin is string =>
  !!origin && (allowedOrigins().includes(origin) || LOCAL_ORIGIN.test(origin));

/** Cabeceras CORS para la petición: a un origen fuera de la lista no se le devuelve ninguno. */
const corsHeadersFor = (req: Request): Record<string, string> => {
  const origin = req.headers.get('Origin');
  return {
    ...(isAllowedOrigin(origin) ? { 'Access-Control-Allow-Origin': origin } : {}),
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    Vary: 'Origin',
  };
};

export class HttpError extends Error {
  /** `code` (opcional) deja que el cliente distinga casos con el mismo status. */
  constructor(public status: number, message: string, public code?: string) {
    super(message);
  }
}

export const json = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

const withCors = (res: Response, req: Request): Response => {
  for (const [key, value] of Object.entries(corsHeadersFor(req))) res.headers.set(key, value);
  return res;
};

/** Envuelve un handler con CORS y formato de error { message } (igual que la API Express). */
export const handle = (fn: (req: Request) => Promise<Response>) => async (req: Request) => {
  if (req.method === 'OPTIONS') return withCors(new Response('ok'), req);
  if (req.method !== 'POST') return withCors(json({ message: 'Method not allowed' }, 405), req);
  try {
    return withCors(await fn(req), req);
  } catch (err) {
    if (err instanceof HttpError) {
      return withCors(json({ message: err.message, ...(err.code ? { code: err.code } : {}) }, err.status), req);
    }
    console.error(err);
    return withCors(json({ message: 'Error interno del servidor' }, 500), req);
  }
};

export const readJson = async <T>(req: Request): Promise<T> => {
  try {
    return (await req.json()) as T;
  } catch {
    throw new HttpError(400, 'Body JSON inválido');
  }
};
