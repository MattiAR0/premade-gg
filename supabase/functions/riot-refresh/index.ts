// POST /functions/v1/riot-refresh  (requiere sesión)
// Actualiza rango, nivel y card del usuario desde HenrikDev.
// Cooldown de 1 h para no gastar el rate limit (sustituye al auto-populate de GET /auth/me).
import { handle, json } from '../_shared/http.ts';
import { admin, requireUser, userJson } from '../_shared/supabase.ts';
import { assertRegion, getPlayerAccount, getPlayerRank, parseRiotId } from '../_shared/riot.ts';

const COOLDOWN_MS = 60 * 60 * 1000;

Deno.serve(handle(async (req) => {
  const user = await requireUser(req);

  const { data: profile, error } = await admin
    .from('profiles')
    .select('riot_id, region, rank, card_image, account_level, last_rank_update, onboarded')
    .eq('id', user.id)
    .single();
  if (error) throw error;

  const lastUpdate = profile.last_rank_update ? new Date(profile.last_rank_update).getTime() : 0;
  const missingData = !profile.card_image || profile.account_level == null;
  if (!profile.onboarded || (!missingData && Date.now() - lastUpdate < COOLDOWN_MS)) {
    return json({ updated: false, user: await userJson(user.id, user.email) });
  }

  const { gameName, tagLine } = parseRiotId(profile.riot_id);
  const [rankData, accountData] = await Promise.all([
    getPlayerRank(gameName, tagLine, assertRegion(profile.region)),
    getPlayerAccount(gameName, tagLine),
  ]);

  const { error: updateError } = await admin
    .from('profiles')
    .update({
      rank: rankData.normalizedRank ?? profile.rank,
      account_level: accountData.accountLevel ?? profile.account_level,
      card_image: accountData.card?.large ?? profile.card_image,
      last_rank_update: new Date().toISOString(),
    })
    .eq('id', user.id);
  if (updateError) throw updateError;

  return json({ updated: true, user: await userJson(user.id, user.email) });
}));
