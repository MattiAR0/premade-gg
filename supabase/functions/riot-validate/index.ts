// POST /functions/v1/riot-validate
// Body: { gameName, tagLine, region? }
// Valida un Riot ID (público, lo usa el formulario de registro). Si llega `region`,
// incluye también el rango actual. Indica si el Riot ID ya está registrado.
import { handle, json, readJson, HttpError } from '../_shared/http.ts';
import { admin } from '../_shared/supabase.ts';
import { assertRegion, getPlayerRank, validateAccount } from '../_shared/riot.ts';

Deno.serve(handle(async (req) => {
  const { gameName, tagLine, region } = await readJson<{ gameName?: string; tagLine?: string; region?: string }>(req);
  if (!gameName?.trim() || !tagLine?.trim()) {
    throw new HttpError(400, 'gameName y tagLine son obligatorios');
  }

  const account = await validateAccount(gameName.trim(), tagLine.trim());
  const riotId = `${account.gameName}#${account.tagLine}`;

  const { count } = await admin
    .from('profiles')
    .select('id', { count: 'exact', head: true })
    .eq('riot_id', riotId);

  const rank = region ? await getPlayerRank(account.gameName, account.tagLine, assertRegion(region)) : undefined;

  return json({ valid: true, ...account, riotId, taken: (count ?? 0) > 0, ...(rank ? { rank } : {}) });
}));
