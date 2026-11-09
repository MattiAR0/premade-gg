// POST /functions/v1/riot-link  (requiere sesión)
// Body: { riotId: "Nombre#Tag", region, role, schedule }
// Onboarding: valida la cuenta en Riot, obtiene rango/card/nivel de HenrikDev y los
// guarda en el perfil. Solo esta función (service role) puede escribir rank/puuid/riot_id.
//
// Si el Riot ID lo tiene otra cuenta sin verificar y quien llama ha superado el reto de la
// tarjeta (riot-verify), se lo quita a esa cuenta. Al vincular se recupera el karma y la
// suspensión de una cuenta borrada con el mismo Riot ID en los últimos 90 días.
// Ver 20261109000002_verificacion_riot_id.sql.
import { handle, json, readJson, HttpError } from '../_shared/http.ts';
import { admin, rateLimit, requireUser, userJson } from '../_shared/supabase.ts';
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
  const { data: current, error: currentError } = await admin
    .from('profiles')
    .select('puuid, riot_verified_at')
    .eq('id', user.id)
    .single();
  if (currentError) throw currentError;
  const verified = !!challenge || (current.puuid === account.puuid && !!current.riot_verified_at);

  // Otras cuentas con este Riot ID o esta cuenta de Riot (normalmente la misma)
  const [byRiotId, byPuuid] = await Promise.all([
    admin.from('profiles').select('id, puuid, riot_verified_at').eq('riot_id', riotId).neq('id', user.id),
    admin.from('profiles').select('id, puuid, riot_verified_at').eq('puuid', account.puuid).neq('id', user.id),
  ]);
  if (byRiotId.error) throw byRiotId.error;
  if (byPuuid.error) throw byPuuid.error;
  const holders = [...new Map([...byRiotId.data, ...byPuuid.data].map((h) => [h.id as string, h])).values()];

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

  // Reto superado: se quita el Riot ID a las cuentas sin verificar que lo tenían
  for (const holder of holders) {
    const { error: releaseError } = await admin.rpc('release_unverified_riot_id', {
      p_holder: holder.id, p_riot_id: riotId, p_puuid: account.puuid,
    });
    if (releaseError) throw releaseError;
  }

  // Primero la prueba de la aceptación; después se activa la cuenta (onboarded)
  const { error: consentError } = await admin
    .from('consents')
    .upsert(
      { user_id: user.id, document: 'terms_privacy', version: TERMS_VERSION },
      { onConflict: 'user_id,document,version', ignoreDuplicates: true },
    );
  if (consentError) throw consentError;

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
      riot_verified_at: verified ? (current.riot_verified_at ?? new Date().toISOString()) : null,
      onboarded: true,
    })
    .eq('id', user.id);

  if (error) {
    if (error.code === '23505') throw new HttpError(409, 'Este Riot ID ya está registrado por otro usuario');
    throw error;
  }

  // El reto ya no sirve para nada (se haya usado o no)
  await admin.from('riot_challenges').delete().eq('user_id', user.id);

  // Karma y suspensión de una cuenta borrada con este Riot ID (90 días)
  const { error: restoreError } = await admin.rpc('restore_riot_account', {
    p_user: user.id, p_puuid: account.puuid, p_verified: verified,
  });
  if (restoreError) throw restoreError;

  return json({ ...(await userJson(user.id, user.email)), termsVersion: TERMS_VERSION });
}));
