// POST /functions/v1/delete-account  (requiere sesión)
// Body: { confirmation: "<Riot ID>" | "BORRAR" }
// Borra la cuenta del usuario que llama: primero sus archivos de Storage y después
// auth.users, que arrastra el perfil y todos sus datos (ver 20261103000002_delete_account.sql).
// Borrar de auth.users necesita service role, por eso no es una RPC.
import { handle, json, readJson, HttpError } from '../_shared/http.ts';
import { admin, rateLimit, requireUser } from '../_shared/supabase.ts';

const CONFIRM_WORD = 'BORRAR';

Deno.serve(handle(async (req) => {
  const user = await requireUser(req);
  await rateLimit(user.id, 'delete_account', 5, 86400);
  const body = await readJson<{ confirmation?: string }>(req);

  // Misma comprobación que el modal: evita borrados por una llamada accidental.
  // El Riot ID no distingue mayúsculas (como en Riot); BORRAR va tal cual.
  const { data: profile, error: profileError } = await admin
    .from('profiles')
    .select('riot_id')
    .eq('id', user.id)
    .maybeSingle();
  if (profileError) throw profileError;

  const confirmation = body.confirmation?.trim() ?? '';
  const riotId: string | null = profile?.riot_id ?? null;
  const valid = confirmation === CONFIRM_WORD || (!!riotId && confirmation.toLowerCase() === riotId.toLowerCase());
  if (!valid) throw new HttpError(400, `Escribe tu Riot ID o ${CONFIRM_WORD} para confirmar`);

  // Avatares subidos (avatars/<user_id>/...), antes que la cuenta: si algo falla,
  // como mucho se pierde la foto y se puede reintentar; al revés quedarían fotos
  // públicas de una cuenta que ya no existe. `list` no pagina: se repite hasta vaciar.
  const bucket = admin.storage.from('avatars');
  for (let round = 0; round < 50; round++) {
    const { data: entries, error: listError } = await bucket.list(user.id, { limit: 100 });
    if (listError) throw listError;
    const files = (entries ?? []).filter((f) => f.id !== null); // sin subcarpetas
    if (!files.length) break;
    const { error: removeError } = await bucket.remove(files.map((f) => `${user.id}/${f.name}`));
    if (removeError) throw removeError;
  }

  const { error } = await admin.auth.admin.deleteUser(user.id);
  if (error) throw error;

  return json({ message: 'Cuenta eliminada' });
}));
