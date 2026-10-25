// Utilidades HTTP compartidas por las Edge Functions.

export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

export class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export const json = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });

/** Envuelve un handler con CORS y formato de error { message } (igual que la API Express). */
export const handle = (fn: (req: Request) => Promise<Response>) => async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ message: 'Method not allowed' }, 405);
  try {
    return await fn(req);
  } catch (err) {
    if (err instanceof HttpError) return json({ message: err.message }, err.status);
    console.error(err);
    return json({ message: 'Error interno del servidor' }, 500);
  }
};

export const readJson = async <T>(req: Request): Promise<T> => {
  try {
    return (await req.json()) as T;
  } catch {
    throw new HttpError(400, 'Body JSON inválido');
  }
};
