// POST /functions/v1/riot-link  (requiere sesión)
// Body: { riotId: "Nombre#Tag", region, role, schedule }
// Onboarding: valida la cuenta en Riot, obtiene rango/card/nivel de HenrikDev y los
// guarda en el perfil. Solo esta función (service role) puede escribir rank/puuid/riot_id.
import { handle, json, readJson, HttpError } from '../_shared/http.ts';
import { admin, requireUser, userJson } from '../_shared/supabase.ts';
import { assertRegion, getPlayerAccount, getPlayerRank, parseRiotId, validateAccount } from '../_shared/riot.ts';

const ROLES = ['Duelist', 'Controller', 'Initiator', 'Sentinel', 'Flex'];

Deno.serve(handle(async (req) => {
  const user = await requireUser(req);
  const body = await readJson<{ riotId?: string; region?: string; role?: string; schedule?: string }>(req);

  const { gameName, tagLine } = parseRiotId(body.riotId);
  const region = assertRegion(body.region);
  if (!body.role || !ROLES.includes(body.role)) throw new HttpError(400, 'Rol inválido');
  if (!body.schedule?.trim()) throw new HttpError(400, 'El horario es obligatorio');

  const account = await validateAccount(gameName, tagLine);
  const riotId = `${account.gameName}#${account.tagLine}`;

  const [byRiotId, byPuuid] = await Promise.all([
    admin.from('profiles').select('id').eq('riot_id', riotId).neq('id', user.id).limit(1),
    admin.from('profiles').select('id').eq('puuid', account.puuid).neq('id', user.id).limit(1),
  ]);
  if (byRiotId.data?.length || byPuuid.data?.length) {
    throw new HttpError(409, 'Este Riot ID ya está registrado por otro usuario');
  }

  const [rankData, accountData] = await Promise.all([
    getPlayerRank(account.gameName, account.tagLine, region),
    getPlayerAccount(account.gameName, account.tagLine),
  ]);

  const { error } = await admin
    .from('profiles')
    .update({
      riot_id: riotId,
      puuid: account.puuid,
      region,
      rank: rankData.normalizedRank ?? 'Iron', // Sin ranked → Iron, como antes
      role: body.role,
      schedule: body.schedule.trim(),
      account_level: accountData.accountLevel,
      card_image: accountData.card?.large ?? null,
      last_rank_update: new Date().toISOString(),
      onboarded: true,
    })
    .eq('id', user.id);

  if (error) {
    if (error.code === '23505') throw new HttpError(409, 'Este Riot ID ya está registrado por otro usuario');
    throw error;
  }

  return json(await userJson(user.id, user.email));
}));
