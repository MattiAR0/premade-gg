#!/usr/bin/env node
/**
 * MIGRACIÓN MONGO → SUPABASE - PremadeGG
 *
 * Copia todos los datos de MongoDB Atlas al proyecto de Supabase, conservando las
 * contraseñas (hash bcrypt) para que los usuarios entren con la misma de siempre.
 *
 * Uso (desde la raíz del repo):
 *   node --env-file=scripts/.env scripts/migrate-mongo-to-supabase.mjs --dry-run
 *   node --env-file=scripts/.env scripts/migrate-mongo-to-supabase.mjs
 *
 * Variables (scripts/.env, ver scripts/.env.example):
 *   MONGO_URI                  URI de Atlas
 *   SUPABASE_URL               https://<ref>.supabase.co (o http://127.0.0.1:54321 en local)
 *   SUPABASE_SERVICE_ROLE_KEY  Secret / service_role key (NUNCA en el frontend)
 *   OLD_UPLOADS_URL            Opcional: URL del backend antiguo para rescatar avatares
 *                              (p. ej. https://premade-gg.onrender.com)
 *
 * Es idempotente: los UUID se derivan del ObjectId de Mongo, así que se puede
 * relanzar sin duplicar nada (usa upsert).
 */

import { MongoClient } from 'mongodb';
import { createClient } from '@supabase/supabase-js';

const DRY_RUN = process.argv.includes('--dry-run');
const CHUNK = 500;

const { MONGO_URI, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, OLD_UPLOADS_URL } = process.env;
if (!MONGO_URI || !SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ Faltan MONGO_URI, SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

// ── Helpers ──────────────────────────────────────────────────

/** ObjectId (24 hex) → UUID determinista "00000000-xxxx-xxxx-xxxx-xxxxxxxxxxxx" */
const toUuid = (oid) => {
  if (!oid) return null;
  const hex = ('00000000' + oid.toString()).toLowerCase();
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
};

const iso = (d) => (d ? new Date(d).toISOString() : null);

const RANKS = ['Iron', 'Bronze', 'Silver', 'Gold', 'Platinum', 'Diamond', 'Ascendant', 'Immortal', 'Radiant'];
const ROLES = ['Duelist', 'Controller', 'Initiator', 'Sentinel', 'Flex'];
const AGENTS = new Set([
  'Brimstone', 'Phoenix', 'Sage', 'Sova', 'Viper', 'Cypher', 'Reyna', 'Killjoy', 'Breach', 'Omen',
  'Jett', 'Raze', 'Skye', 'Yoru', 'Astra', 'KAY/O', 'Chamber', 'Neon', 'Fade', 'Harbor', 'Gekko',
  'Deadlock', 'Iso', 'Clove', 'Vyse', 'Tejo', 'Waylay', 'Veto',
]);
const RECRUITING_ROLES = new Set([...ROLES, 'Coach', 'Analyst']);

const stats = {};
const warn = (msg) => console.warn(`  ⚠️  ${msg}`);

async function upsert(table, rows, onConflict) {
  stats[table] = (stats[table] ?? 0) + rows.length;
  if (DRY_RUN || rows.length === 0) return;
  for (let i = 0; i < rows.length; i += CHUNK) {
    const { error } = await supabase.from(table).upsert(rows.slice(i, i + CHUNK), { onConflict });
    if (error) throw new Error(`${table}: ${error.message}`);
  }
}

/** Mapa email → id de los usuarios que ya existen en Supabase Auth */
async function existingAuthUsers() {
  const byEmail = new Map();
  for (let page = 1; ; page++) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw error;
    for (const u of data.users) byEmail.set(u.email?.toLowerCase(), u.id);
    if (data.users.length < 1000) break;
  }
  return byEmail;
}

/** Rescata un avatar subido al backend antiguo y lo sube a Storage. Devuelve la URL nueva o null. */
async function migrateAvatar(userId, oldPath) {
  if (!OLD_UPLOADS_URL || !oldPath?.startsWith('/uploads/')) return null;
  try {
    const res = await fetch(new URL(oldPath, OLD_UPLOADS_URL), { signal: AbortSignal.timeout(10_000) });
    if (!res.ok) return null;
    const blob = await res.blob();
    const name = oldPath.split('/').pop();
    const path = `${userId}/${name}`;
    if (!DRY_RUN) {
      const { error } = await supabase.storage
        .from('avatars')
        .upload(path, blob, { contentType: blob.type || 'image/png', upsert: true });
      if (error) return null;
    }
    return supabase.storage.from('avatars').getPublicUrl(path).data.publicUrl;
  } catch {
    return null;
  }
}

// ── Migración ────────────────────────────────────────────────

async function main() {
  console.log(`🚚 Migración Mongo → Supabase ${DRY_RUN ? '(DRY RUN: no se escribe nada)' : ''}`);
  const mongo = new MongoClient(MONGO_URI);
  await mongo.connect();
  const db = mongo.db();
  const col = (name) => db.collection(name).find({}).toArray();

  const [users, teams, lfgPosts, reputations, conversations, messages, notifications] = await Promise.all([
    col('users'), col('teams'), col('lfgposts'), col('reputations'),
    col('conversations'), col('messages'), col('notifications'),
  ]);
  console.log(
    `📦 Mongo: ${users.length} users · ${teams.length} teams · ${lfgPosts.length} lfg · ` +
    `${reputations.length} reviews · ${conversations.length} conversations · ${messages.length} messages · ` +
    `${notifications.length} notifications`,
  );

  // 1. Usuarios de Auth (con su hash bcrypt) ────────────────────
  console.log('\n👤 Usuarios…');
  const existing = DRY_RUN ? new Map() : await existingAuthUsers();
  const userIds = new Map(); // ObjectId string → uuid real en auth.users

  for (const u of users) {
    const email = u.email?.toLowerCase();
    if (!email) {
      warn(`Usuario ${u._id} sin email: se omite`);
      continue;
    }
    let id = existing.get(email);
    if (!id) {
      id = toUuid(u._id);
      if (!DRY_RUN) {
        const { data, error } = await supabase.auth.admin.createUser({
          id,
          email,
          password_hash: u.password,
          email_confirm: true,
          user_metadata: { migratedFrom: 'mongo' },
        });
        if (error) {
          warn(`No se pudo crear ${email}: ${error.message}`);
          continue;
        }
        id = data.user.id;
      }
    }
    userIds.set(u._id.toString(), id);
  }
  stats['auth.users'] = userIds.size;
  const uid = (oid) => (oid ? userIds.get(oid.toString()) ?? null : null);

  // 2. Perfiles (el trigger ya creó la fila vacía) ──────────────
  const profiles = [];
  for (const u of users) {
    const id = uid(u._id);
    if (!id) continue;

    let profileImage = u.profileImage ?? null;
    let profileImageType = u.profileImageType ?? 'riot_card';
    if (profileImage?.startsWith('/uploads/')) {
      profileImage = await migrateAvatar(id, profileImage);
      if (!profileImage) {
        warn(`Avatar perdido de ${u.riotId} (disco efímero de Render): se usa la card de Riot`);
        profileImageType = 'riot_card';
      }
    }

    const rank = RANKS.includes(u.rank) ? u.rank : 'Iron';
    const role = ROLES.includes(u.role) ? u.role : 'Flex';
    profiles.push({
      id,
      riot_id: u.riotId,
      puuid: u.puuid ?? null,
      region: u.region ?? 'eu',
      rank,
      role,
      schedule: u.schedule || 'Flexible',
      karma: u.karma ?? 5,
      account_level: u.accountLevel ?? null,
      card_image: u.cardImage ?? null,
      last_rank_update: iso(u.lastRankUpdate),
      bio: (u.bio ?? '').slice(0, 500),
      profile_image: profileImage,
      profile_image_type: profileImageType,
      favorite_agents: (u.favoriteAgents ?? []).filter((a) => AGENTS.has(a)).slice(0, 3),
      favorite_role: ROLES.includes(u.favoriteRole) ? u.favoriteRole : null,
      social_links: { discord: '', twitter: '', twitch: '', ...(u.socialLinks ?? {}) },
      availability: u.availability ?? {},
      looking_for_team: !!u.lookingForTeam,
      lft_details: (u.lftDetails ?? '').slice(0, 300),
      is_coach: !!u.isCoach,
      coach_details: (u.coachDetails ?? '').slice(0, 500),
      onboarded: !!u.riotId,
      created_at: iso(u.createdAt) ?? new Date().toISOString(),
    });
  }
  await upsert('profiles', profiles, 'id');

  // 3. Equipos ──────────────────────────────────────────────────
  console.log('🏰 Equipos…');
  const teamRows = [];
  const players = [];
  const staff = [];
  const joinRequests = [];
  for (const t of teams) {
    const owner = uid(t.owner);
    if (!owner) {
      warn(`Equipo "${t.name}" sin dueño válido: se omite`);
      continue;
    }
    const id = toUuid(t._id);
    teamRows.push({
      id,
      name: t.name,
      tag: (t.tag ?? '').toUpperCase().slice(0, 6),
      logo: t.logo ?? null,
      description: t.description ?? '',
      owner_id: owner,
      coach_id: uid(t.coach),
      region: t.region ?? 'eu',
      target_rank: RANKS.includes(t.targetRank) ? t.targetRank : 'Gold',
      social_links: { discord: '', twitter: '', twitch: '', youtube: '', ...(t.socialLinks ?? {}) },
      achievements: (t.achievements ?? []).map((a) => ({
        title: a.title ?? '',
        date: iso(a.date),
        description: a.description ?? '',
      })),
      recruiting: !!t.recruiting,
      recruiting_roles: (t.recruitingRoles ?? []).filter((r) => RECRUITING_ROLES.has(r)),
      recruiting_details: t.recruitingDetails ?? '',
      created_at: iso(t.createdAt) ?? new Date().toISOString(),
    });
    const seen = new Set();
    for (const p of t.players ?? []) {
      const user = uid(p.user);
      if (!user || seen.has(user)) continue;
      seen.add(user);
      players.push({ team_id: id, user_id: user, role: ROLES.includes(p.role) ? p.role : 'Flex', joined_at: iso(p.joinedAt) });
    }
    const seenStaff = new Set();
    for (const s of t.staff ?? []) {
      const user = uid(s.user);
      if (!user || seenStaff.has(user)) continue;
      seenStaff.add(user);
      staff.push({ team_id: id, user_id: user, role: s.role, joined_at: iso(s.joinedAt) });
    }
    for (const r of (t.joinRequests ?? []).filter((r) => r.status === 'pending')) {
      const user = uid(r.user);
      if (!user) continue;
      joinRequests.push({
        id: toUuid(r._id),
        team_id: id,
        user_id: user,
        message: r.message ?? '',
        status: 'pending',
        created_at: iso(r.createdAt),
      });
    }
  }
  await upsert('teams', teamRows, 'id');
  await upsert('team_players', players, 'team_id,user_id');
  await upsert('team_staff', staff, 'team_id,user_id');
  await upsert('team_join_requests', joinRequests, 'id');
  const teamIds = new Set(teamRows.map((t) => t.id));

  // 4. LFG (los caducados se descartan: Mongo los habría borrado) ─
  console.log('📋 Posts LFG…');
  const now = Date.now();
  const postRows = [];
  const members = [];
  for (const p of lfgPosts) {
    const author = uid(p.author);
    if (!author || (p.expiresAt && new Date(p.expiresAt).getTime() < now)) continue;
    const id = toUuid(p._id);
    postRows.push({
      id,
      author_id: author,
      title: p.title,
      description: p.description ?? null,
      team_size: p.teamSize,
      min_rank: RANKS.includes(p.minRank) ? p.minRank : null,
      min_karma: p.minKarma ?? 3,
      status: p.status ?? 'open',
      created_at: iso(p.createdAt),
      expires_at: iso(p.expiresAt),
    });
    const seen = new Set();
    for (const m of p.members ?? []) {
      const user = uid(m.user);
      if (!user || seen.has(user)) continue;
      seen.add(user);
      members.push({ post_id: id, user_id: user, status: m.status ?? 'pending', joined_at: iso(m.joinedAt) });
    }
  }
  await upsert('lfg_posts', postRows, 'id');
  await upsert('lfg_members', members, 'post_id,user_id');
  const postIds = new Set(postRows.map((p) => p.id));

  // 5. Reputación (el trigger recalcula el karma) ──────────────
  console.log('⭐ Reviews…');
  const reviewRows = reputations
    .map((r) => ({
      id: toUuid(r._id),
      author_id: uid(r.author),
      target_id: uid(r.target),
      rating: r.rating,
      comment: r.comment ?? null,
      played_together: !!r.playedTogether,
      created_at: iso(r.createdAt),
    }))
    .filter((r) => r.author_id && r.target_id && r.author_id !== r.target_id);
  await upsert('reputations', reviewRows, 'id');

  // 6. Conversaciones y mensajes ────────────────────────────────
  console.log('💬 Mensajería…');
  const messagesByConv = new Map();
  for (const m of messages) {
    const key = m.conversation.toString();
    if (!messagesByConv.has(key)) messagesByConv.set(key, []);
    messagesByConv.get(key).push(m);
  }

  const convRows = [];
  const participants = [];
  const messageRows = [];
  for (const c of conversations) {
    const id = toUuid(c._id);
    const teamId = c.teamId ? toUuid(c.teamId) : null;
    convRows.push({
      id,
      type: c.type ?? 'direct',
      name: c.name ?? null,
      group_image: c.groupImage ?? null,
      admin_id: uid(c.admin),
      team_id: teamId && teamIds.has(teamId) ? teamId : null,
      last_message_content: c.lastMessage?.content || null,
      last_message_sender: uid(c.lastMessage?.sender),
      last_message_at: iso(c.lastMessage?.createdAt),
      created_at: iso(c.createdAt),
      updated_at: iso(c.updatedAt),
    });

    const convMessages = messagesByConv.get(c._id.toString()) ?? [];
    const seen = new Set();
    for (const p of c.participants ?? []) {
      const user = uid(p);
      if (!user || seen.has(user)) continue;
      seen.add(user);
      // readBy[] → last_read_at: la lectura más reciente de este usuario en la conversación
      const lastRead = convMessages
        .flatMap((m) => m.readBy ?? [])
        .filter((r) => r.user?.toString() === p.toString())
        .reduce((max, r) => Math.max(max, new Date(r.readAt).getTime()), new Date(c.createdAt).getTime());
      participants.push({ conversation_id: id, user_id: user, joined_at: iso(c.createdAt), last_read_at: new Date(lastRead).toISOString() });
    }

    for (const m of convMessages) {
      const sender = uid(m.sender);
      if (!sender || !m.content?.trim()) continue;
      messageRows.push({
        id: toUuid(m._id),
        conversation_id: id,
        sender_id: sender,
        content: m.content.slice(0, 2000),
        created_at: iso(m.createdAt),
        updated_at: iso(m.updatedAt),
      });
    }
  }
  await upsert('conversations', convRows, 'id');
  await upsert('conversation_participants', participants, 'conversation_id,user_id');
  await upsert('messages', messageRows, 'id');

  // 7. Notificaciones ───────────────────────────────────────────
  console.log('🔔 Notificaciones…');
  const notifRows = notifications
    .map((n) => {
      const postId = n.lfgPost ? toUuid(n.lfgPost) : null;
      return {
        id: toUuid(n._id),
        recipient_id: uid(n.recipient),
        sender_id: uid(n.sender),
        type: n.type,
        lfg_post_id: postId && postIds.has(postId) ? postId : null,
        message: (n.message ?? '').slice(0, 300),
        read: !!n.read,
        created_at: iso(n.createdAt),
        expires_at: iso(n.expiresAt),
      };
    })
    .filter((n) => n.recipient_id && n.sender_id);
  // Reutilizar notificaciones antiguas no debe volver a emitirlas en Realtime: se insertan
  // con el trigger activo, pero nadie está suscrito durante la migración.
  await upsert('notifications', notifRows, 'id');

  await mongo.close();

  // 8. Verificación ─────────────────────────────────────────────
  console.log('\n📊 Resumen (filas enviadas):');
  console.table(stats);

  if (!DRY_RUN) {
    console.log('🔎 Conteos en Supabase:');
    const counts = {};
    for (const table of Object.keys(stats).filter((t) => t !== 'auth.users')) {
      const { count } = await supabase.from(table).select('*', { count: 'exact', head: true });
      counts[table] = { enviadas: stats[table], en_supabase: count, ok: count >= stats[table] ? '✅' : '❌' };
    }
    console.table(counts);
  }
  console.log('✅ Migración terminada');
}

main().catch((err) => {
  console.error('❌ Error en la migración:', err);
  process.exit(1);
});
