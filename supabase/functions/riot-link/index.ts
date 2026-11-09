// POST /functions/v1/riot-link  (requiere sesión)
// Body: { riotId: "Nombre#Tag", region, role, schedule }
// Onboarding: valida la cuenta en Riot, obtiene rango/card/nivel de HenrikDev y los
// guarda en el perfil. Solo esta función (service role) puede escribir rank/riot_id y el
// PUUID, que va en la tabla privada riot_identities (20261109000004_riot_identities.sql).
//
// Si el Riot ID lo tiene otra cuenta sin verificar y quien llama ha superado el reto de la
// tarjeta (riot-verify), se lo quita a esa cuenta. Al vincular se recupera el karma y la
// suspensión de una cuenta borrada con el mismo Riot ID en los últimos 90 días.
// Ver 20261109000002_verificacion_riot_id.sql.
import { handle, json, readJson, HttpError } from '../_shared/http.ts';
import { admin, getPuuid, getPuuidOwner, rateLimit, requireUser, userJson } from '../_shared/supabase.ts';
import { assertRegion, getPlayerAccount, getPlayerRank, parseRiotId, validateAccount } from '../_shared/riot.ts';
import { TERMS_VERSION } from '../_shared/legal.ts';

const ROLES = ['Duelist', 'Controller', 'Initiator', 'Sentinel', 'Flex'];

Deno.serve(handle(async (req) => {
  const user = await requireUser(req);
  await rateLimit(user.id, 'riot_link', 10, 3600);
  const body = await readJson<{
    riotId?: string; region?: string; role?: string; schedule?: string; acceptTerms?: boolean;
  }>(req);

  // Aceptación de los términos y la privacidad, con la declaración de edad mínima
  if (body.acceptTerms !== true) {
    throw new HttpError(400, 'Para usar PremadeGG tienes que aceptar los términos de uso y tener 16 años o más.');
  }

  const { gameName, tagLine } = parseRiotId(body.riotId);
  const region = assertRegion(body.region);
  if (!body.role || !ROLES.includes(body.role)) throw new HttpError(400, 'Elige un rol de la lista.');
  if (!body.schedule?.trim()) throw new HttpError(400, 'Elige cuándo sueles jugar.');

  const account = await validateAccount(gameName, tagLine);
  const riotId = `${account.gameName}#${account.tagLine}`;

  // Reto de la tarjeta superado para esta misma cuenta de Riot (y sin caducar)
  const { data: challenge, error: challengeError } = await admin
    .from('riot_challenges')
    .select('verified_at')
    .eq('user_id', user.id)
    .eq('puuid', account.puuid)
    .not('verified_at', 'is', null)
    .gt('expires_at', new Date().toISOString())
    .maybeSingle();
  if (challengeError) throw challengeError;

  // Volver a vincular el mismo Riot ID ya verificado no quita la verificación
  const [{ data: current, error: currentError }, currentPuuid] = await Promise.all([
    admin.from('profiles').select('riot_verified_at').eq('id', user.id).single(),
    getPuuid(user.id),
  ]);
  if (currentError) throw currentError;
  const verified = !!challenge || (currentPuuid === account.puuid && !!current.riot_verified_at);

  // Otras cuentas con este Riot ID o esta cuenta de Riot (normalmente la misma)
  const puuidOwner = await getPuuidOwner(account.puuid);
  const { data: byRiotId, error: byRiotIdError } = await admin
    .from('profiles')
    .select('id')
    .eq('riot_id', riotId)
    .neq('id', user.id);
  if (byRiotIdError) throw byRiotIdError;
  const holderIds = [...new Set([...byRiotId.map((h) => h.id as string), puuidOwner].filter(
    (id): id is string => !!id && id !== user.id,
  ))];
  const holders = await Promise.all(holderIds.map(async (id) => {
    const [{ data, error: holderError }, puuid] = await Promise.all([
      admin.from('profiles').select('riot_verified_at').eq('id', id).single(),
      getPuuid(id),
    ]);
    if (holderError) throw holderError;
    return { id, puuid, riot_verified_at: data.riot_verified_at as string | null };
  }));

  for (const holder of holders) {
    if (holder.riot_verified_at) {
      // Verificado con otro PUUID: es un nombre antiguo (esa cuenta de Riot cambió de nombre)
      if (holder.puuid !== account.puuid) {
        throw new HttpError(
          409,
          'Ese Riot ID figura en otra cuenta con un nombre que ya no usa. Escríbenos desde el enlace de contacto del pie y lo resolvemos.',
          'riot_id_stale',
        );
      }
      throw new HttpError(
        409,
        'Este Riot ID ya está registrado y verificado por otra cuenta. Si crees que es un error, escríbenos desde el enlace de contacto del pie.',
        'riot_id_verified',
      );
    }
    if (!verified) {
      throw new HttpError(
        409,
        'Este Riot ID ya está registrado por otra cuenta. Si es tuyo, demuéstralo con tu tarjeta de jugador y lo recuperas.',
        'riot_id_claimable',
      );
    }
  }

  // Datos de HenrikDev antes de tocar nada: si fallan, nadie pierde su Riot ID
  const [rankData, accountData] = await Promise.all([
    getPlayerRank(account.gameName, account.tagLine, region),
    getPlayerAccount(account.gameName, account.tagLine),
  ]);

  // Todo el vínculo en una transacción (20261109000004_riot_identities.sql): quitar el Riot ID a
  // las cuentas sin verificar que lo tenían, aceptar los términos, guardar el PUUID, actualizar
  // el perfil y recuperar el historial. Vuelve a comprobar los dueños por si algo cambió.
  const { error: linkError } = await admin.rpc('link_riot_account', {
    p_user: user.id,
    p_puuid: account.puuid,
    p_riot_id: riotId,
    p_region: region,
    p_rank: rankData.normalizedRank ?? 'Iron', // Sin ranked → Iron, como antes
    p_role: body.role,
    p_schedule: body.schedule.trim(),
    p_account_level: accountData.accountLevel,
    p_card_image: accountData.card?.large ?? null,
  });
  if (linkError) {
    if (linkError.hint?.startsWith('riot_id_')) throw new HttpError(409, linkError.message, linkError.hint);
    if (linkError.code === '23505') throw new HttpError(409, 'Este Riot ID ya está registrado por otro usuario');
    throw linkError;
  }

  return json({ ...(await userJson(user.id, user.email)), termsVersion: TERMS_VERSION });
}));
