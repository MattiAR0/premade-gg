/**
 * AUTHOR CACHE - PremadeGG
 *
 * Cache en memoria para datos de autores (usuarios) usados en populate de LFG posts.
 *
 * Problema que resuelve:
 * Mongoose populate() ejecuta queries a la colección Users por cada batch de posts.
 * Si el usuario hace scroll (pág 1, 2, 3...), los mismos autores se re-consultan
 * porque populate no tiene cache entre peticiones HTTP.
 *
 * Solución:
 * - Cache en Map<userId, { data, expiresAt }> con TTL de 30 segundos.
 * - resolveAuthors() recibe un array de posts con author como ObjectId,
 *   busca en cache primero, y solo consulta MongoDB para los IDs que faltan.
 * - Se proyectan solo los campos necesarios (riotId, rank, role, karma).
 */

const User = require('../models/User');

const AUTHOR_FIELDS = 'riotId rank role karma';
const TTL_MS = 30_000; // 30 segundos

// Cache: Map<string(userId), { data: object, expiresAt: number }>
const cache = new Map();

/**
 * Limpia entradas expiradas del cache.
 * Se ejecuta periódicamente para evitar memory leaks.
 */
const cleanup = () => {
  const now = Date.now();
  for (const [key, entry] of cache) {
    if (now >= entry.expiresAt) {
      cache.delete(key);
    }
  }
};

// Limpieza cada 60 segundos
setInterval(cleanup, 60_000).unref();

/**
 * Resuelve los datos de autores para un array de posts lean().
 * Usa cache en memoria: solo consulta MongoDB para autores no cacheados.
 *
 * @param {Object[]} posts - Array de posts con campo author (ObjectId string)
 * @returns {Object[]} - Los mismos posts con author reemplazado por { _id, riotId, rank, role, karma }
 */
const resolveAuthors = async (posts) => {
  if (!posts || posts.length === 0) return posts;

  const now = Date.now();

  // 1. Recopilar todos los author IDs únicos
  const authorIds = [...new Set(posts.map((p) => p.author?.toString()).filter(Boolean))];

  // 2. Separar los que están en cache (y no expirados) de los que faltan
  const resolved = {};
  const missing = [];

  for (const id of authorIds) {
    const entry = cache.get(id);
    if (entry && now < entry.expiresAt) {
      resolved[id] = entry.data;
    } else {
      missing.push(id);
    }
  }

  // 3. Consultar MongoDB solo para los que faltan (una sola query con $in)
  if (missing.length > 0) {
    const users = await User.find({ _id: { $in: missing } })
      .select(AUTHOR_FIELDS)
      .lean();

    for (const user of users) {
      const id = user._id.toString();
      resolved[id] = user;
      cache.set(id, { data: user, expiresAt: now + TTL_MS });
    }
  }

  // 4. Inyectar los datos de autor en cada post
  return posts.map((post) => ({
    ...post,
    author: resolved[post.author?.toString()] || post.author,
  }));
};

/** Invalida un autor específico del cache (útil tras updates) */
const invalidate = (userId) => {
  cache.delete(userId.toString());
};

/** Invalida todo el cache */
const invalidateAll = () => {
  cache.clear();
};

module.exports = {
  resolveAuthors,
  invalidate,
  invalidateAll,
};
