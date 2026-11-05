// POST /functions/v1/riot-validate
// Body: { gameName, tagLine, region? }
// Valida un Riot ID (público: lo usa el formulario de registro antes de que exista sesión).
// Si llega `region`, incluye también el rango actual. Indica si el Riot ID ya está registrado
// (la lista de jugadores ya es pública). No devuelve el puuid: el cliente no lo necesita.
import { handle, json, readJson, HttpError } from '../_shared/http.ts';
import { admin, ipKey, rateLimit } from '../_shared/supabase.ts';
import { assertRegion, getPlayerRank, validateAccount } from '../_shared/riot.ts';

Deno.serve(handle(async (req) => {
  // Pública: se limita por IP para que nadie agote la cuota de las APIs de Riot y HenrikDev
  await rateLimit(await ipKey(req), 'riot_validate', 30, 3600);

  const { gameName, tagLine, region } = await readJson<{ gameName?: string; tagLine?: string; region?: string }>(req);
  if (!gameName?.trim() || !tagLine?.trim()) {
    throw new HttpError(400, 'Escribe el nombre y el tag de tu Riot ID.');
  }

  const account = await validateAccount(gameName.trim(), tagLine.trim());
  const riotId = `${account.gameName}#${account.tagLine}`;

  const { count } = await admin
    .from('profiles')
    .select('id', { count: 'exact', head: true })
    .eq('riot_id', riotId);

  const rank = region ? await getPlayerRank(account.gameName, account.tagLine, assertRegion(region)) : undefined;

  return json({
    valid: true,
    gameName: account.gameName,
    tagLine: account.tagLine,
    riotId,
    taken: (count ?? 0) > 0,
    ...(rank ? { rank } : {}),
  });
}));
