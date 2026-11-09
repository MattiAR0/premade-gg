// POST /functions/v1/riot-verify  (requiere sesión)
// Body: { action: 'status' } | { action: 'start', riotId?, region? } | { action: 'check' }
//
// Verificación del Riot ID con la tarjeta de jugador, mientras no haya RSO.
// La tarjeta equipada solo se ve en las partidas, así que el reto pide dos partidas empezadas
// después de crearlo:
//   1. una con otra tarjeta: la de por defecto o, si ya llevabas esa, cualquier otra;
//   2. una posterior con la tarjeta de siempre (la de tu última partida al crear el reto).
// Solo el dueño de la cuenta de Riot puede cambiarla, y que lo haga por su cuenta en ese orden
// en 24 horas es muy improbable (con un solo paso bastaba con que ya hubiera cambiado de
// tarjeta antes del reto).
//
// · Con el onboarding hecho se verifica el Riot ID propio y se marca el perfil.
// · Sin onboarding (el Riot ID lo tiene otra cuenta sin verificar) el reto superado deja que
//   riot-link se lo quite a esa cuenta. Ver 20261109000002_verificacion_riot_id.sql.
import { handle, json, readJson, HttpError } from '../_shared/http.ts';
import { admin, ipKey, rateLimit, requireUser, userJson } from '../_shared/supabase.ts';
import {
  assertRegion, DEFAULT_CARD, getRecentMatchCards, parseRiotId, validateAccount, type MatchCard, type Region,
} from '../_shared/riot.ts';

const CHALLENGE_MS = 24 * 60 * 60 * 1000;
// Tras superar el reto sin onboarding, tiempo para terminar de vincular en riot-link
const LINK_GRACE_MS = 60 * 60 * 1000;

interface ChallengeRow {
  user_id: string;
  puuid: string;
  riot_id: string;
  region: Region;
  baseline_card: string;
  created_at: string;
  expires_at: string;
  step1_at: string | null;
  verified_at: string | null;
}

/** Primer paso: llevar una tarjeta distinta de la de siempre */
const step1Passes = (c: ChallengeRow, card: string) =>
  c.baseline_card === DEFAULT_CARD.id ? card !== DEFAULT_CARD.id : card === DEFAULT_CARD.id;

/** Lo que ve el cliente (sin el PUUID ni la tarjeta de siempre). */
const challengeJson = (c: ChallengeRow) => ({
  riotId: c.riot_id,
  region: c.region,
  // equip: equipar `card` · change: equipar cualquiera que no sea `card`
  mode: c.baseline_card === DEFAULT_CARD.id ? 'change' : 'equip',
  card: DEFAULT_CARD,
  createdAt: c.created_at,
  expiresAt: c.expires_at,
  step1Done: !!c.step1_at,
  verified: !!c.verified_at,
});

const getProfile = async (userId: string) => {
  const { data, error } = await admin
    .from('profiles')
    .select('onboarded, puuid, riot_id, region, riot_verified_at')
    .eq('id', userId)
    .single();
  if (error) throw error;
  return data as {
    onboarded: boolean; puuid: string | null; riot_id: string | null; region: string; riot_verified_at: string | null;
  };
};

const getChallenge = async (userId: string): Promise<ChallengeRow | null> => {
  const { data, error } = await admin.from('riot_challenges').select('*').eq('user_id', userId).maybeSingle();
  if (error) throw error;
  return data as ChallengeRow | null;
};

/**
 * Evalúa el reto con las partidas empezadas después de crearlo (de la más antigua a la más reciente).
 * Devuelve la partida que cumple el paso 1 y, si la hay, una posterior con la tarjeta de siempre.
 */
const evaluate = (c: ChallengeRow, matches: MatchCard[]) => {
  const createdAt = Date.parse(c.created_at);
  const newer = matches.filter((m) => m.startedAt > createdAt).sort((a, b) => a.startedAt - b.startedAt);
  const step1 = newer.find((m) => step1Passes(c, m.card));
  const step2 = step1 && newer.find((m) => m.startedAt > step1.startedAt && m.card === c.baseline_card);
  return { newer, step1, step2 };
};

Deno.serve(handle(async (req) => {
  const user = await requireUser(req);
  const body = await readJson<{ action?: string; riotId?: string; region?: string }>(req);

  // ── Estado: el reto en curso, para retomarlo después de jugar ──
  if (body.action === 'status') {
    const challenge = await getChallenge(user.id);
    const active = challenge && Date.parse(challenge.expires_at) > Date.now();
    return json({ challenge: active ? challengeJson(challenge) : null });
  }

  // ── Empezar un reto ──
  if (body.action === 'start') {
    // Cada reto gasta cuota de Riot y HenrikDev: límite por usuario y por IP (cuentas en serie)
    await rateLimit(user.id, 'riot_verify_start', 10, 3600);
    await rateLimit(await ipKey(req), 'riot_verify_start', 30, 3600);
    const profile = await getProfile(user.id);

    let puuid: string;
    let riotId: string;
    let region: Region;
    if (profile.onboarded && profile.puuid && profile.riot_id) {
      if (profile.riot_verified_at) throw new HttpError(409, 'Tu Riot ID ya está verificado.', 'already_verified');
      puuid = profile.puuid;
      riotId = profile.riot_id;
      region = assertRegion(profile.region);
    } else {
      const { gameName, tagLine } = parseRiotId(body.riotId);
      region = assertRegion(body.region);
      const account = await validateAccount(gameName, tagLine);
      puuid = account.puuid;
      riotId = `${account.gameName}#${account.tagLine}`;

      const { data: holder, error } = await admin
        .from('profiles')
        .select('riot_verified_at')
        .eq('puuid', puuid)
        .neq('id', user.id)
        .maybeSingle();
      if (error) throw error;
      if (holder?.riot_verified_at) {
        throw new HttpError(
          409,
          'Este Riot ID ya está verificado por otra cuenta. Si crees que es un error, escríbenos desde el enlace de contacto del pie.',
          'riot_id_verified',
        );
      }
    }

    const [last] = await getRecentMatchCards(region, puuid, 1);
    if (!last) {
      throw new HttpError(
        409,
        'Todavía no vemos ninguna partida de esta cuenta en esa región. Juega una partida cualquiera y vuelve a intentarlo.',
        'no_matches',
      );
    }

    const now = new Date();
    const { data, error } = await admin
      .from('riot_challenges')
      .upsert({
        user_id: user.id,
        puuid,
        riot_id: riotId,
        region,
        baseline_card: last.card,
        created_at: now.toISOString(),
        expires_at: new Date(now.getTime() + CHALLENGE_MS).toISOString(),
        step1_at: null,
        verified_at: null,
      })
      .select('*')
      .single();
    if (error) throw error;

    return json({ challenge: challengeJson(data as ChallengeRow) });
  }

  // ── Comprobar el reto ──
  if (body.action === 'check') {
    await rateLimit(user.id, 'riot_verify_check', 30, 3600);
    await rateLimit(await ipKey(req), 'riot_verify_check', 90, 3600);
    const challenge = await getChallenge(user.id);
    if (!challenge) throw new HttpError(404, 'No tienes ninguna verificación en curso.', 'no_challenge');

    // Un reto empezado antes del onboarding no vale para otro Riot ID que el ya vinculado
    const owner = await getProfile(user.id);
    if (owner.onboarded && owner.puuid !== challenge.puuid) {
      await admin.from('riot_challenges').delete().eq('user_id', user.id);
      throw new HttpError(409, 'Ya tienes otro Riot ID vinculado. Empieza la verificación desde Ajustes de cuenta.', 'no_challenge');
    }
    if (Date.parse(challenge.expires_at) <= Date.now()) {
      throw new HttpError(410, 'La verificación ha caducado. Empieza otra.', 'expired');
    }
    if (challenge.verified_at) return json({ result: 'verified', challenge: challengeJson(challenge) });

    const { newer, step1, step2 } = evaluate(challenge, await getRecentMatchCards(challenge.region, challenge.puuid));

    if (!step1) {
      return json({ result: newer.length ? 'wrong_card' : 'no_match', challenge: challengeJson(challenge) });
    }

    if (!step2) {
      let current = challenge;
      if (!challenge.step1_at) {
        const step1At = new Date(step1.startedAt).toISOString();
        const { error } = await admin.from('riot_challenges').update({ step1_at: step1At }).eq('user_id', user.id);
        if (error) throw error;
        current = { ...challenge, step1_at: step1At };
      }
      return json({ result: 'step1_done', challenge: challengeJson(current) });
    }

    const now = Date.now();
    const verifiedAt = new Date(now).toISOString();

    // Riot ID propio: se marca el perfil y el reto ya no hace falta
    if (owner.onboarded) {
      const { error } = await admin.from('profiles').update({ riot_verified_at: verifiedAt }).eq('id', user.id);
      if (error) throw error;
      await admin.from('riot_challenges').delete().eq('user_id', user.id);
      return json({
        result: 'verified',
        challenge: challengeJson({ ...challenge, verified_at: verifiedAt }),
        user: await userJson(user.id, user.email),
      });
    }

    // Sin onboarding: riot-link usará el reto superado para vincular el Riot ID (mientras no caduque)
    const expiresAt = new Date(Math.max(Date.parse(challenge.expires_at), now + LINK_GRACE_MS)).toISOString();
    const { error } = await admin
      .from('riot_challenges')
      .update({ verified_at: verifiedAt, expires_at: expiresAt })
      .eq('user_id', user.id);
    if (error) throw error;
    return json({
      result: 'verified',
      challenge: challengeJson({ ...challenge, verified_at: verifiedAt, expires_at: expiresAt }),
    });
  }

  throw new HttpError(400, 'Acción desconocida');
}));
