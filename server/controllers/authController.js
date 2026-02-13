/**
 * AUTH CONTROLLER - PremadeGG
 *
 * Maneja registro, login y obtención del usuario actual.
 */

const bcrypt = require('bcrypt');
const User = require('../models/User');
const { generateToken } = require('../middlewares/auth');
const { validateAccount, getPlayerRank } = require('../services/riotService');

const SALT_ROUNDS = 12;

/**
 * Sanitiza el objeto de usuario para no exponer campos sensibles.
 */
const sanitizeUser = (user) => {
  const obj = user.toObject ? user.toObject() : { ...user };
  delete obj.password;
  // Convertir availability Map a objeto plano si existe
  if (obj.availability instanceof Map) {
    obj.availability = Object.fromEntries(obj.availability);
  }
  return obj;
};

/**
 * POST /api/auth/register
 * Registra un nuevo usuario con email, contraseña y Riot ID validado.
 *
 * Body: { email, password, riotId, region?, role, schedule }
 */
const register = async (req, res, next) => {
  try {
    const { email, password, riotId, region = 'eu', role, schedule } = req.body;

    // Validaciones básicas
    if (!email || !password || !riotId || !role || !schedule) {
      return res.status(400).json({
        message: 'Missing required fields: email, password, riotId, role, schedule',
      });
    }

    if (password.length < 6) {
      return res.status(400).json({ message: 'Password must be at least 6 characters' });
    }

    if (!riotId.includes('#')) {
      return res.status(400).json({ message: 'riotId must be in format "Name#Tag"' });
    }

    // Verificar email único
    const existingEmail = await User.findOne({ email: email.toLowerCase() });
    if (existingEmail) {
      return res.status(409).json({ message: 'Email already registered' });
    }

    // Verificar Riot ID único
    const existingRiot = await User.findOne({ riotId });
    if (existingRiot) {
      return res.status(409).json({ message: 'Riot ID already registered' });
    }

    const [gameName, tagLine] = riotId.split('#');

    // 1. Validar cuenta Riot
    let riotAccount;
    try {
      riotAccount = await validateAccount(gameName, tagLine);
    } catch (err) {
      return res.status(err.statusCode || 502).json({ message: err.message });
    }

    // 2. Obtener rango de HenrikDev
    const rankData = await getPlayerRank(gameName, tagLine, region);
    const rank = rankData.normalizedRank || 'Iron';

    // 3. Hash de la contraseña
    const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);

    // 4. Crear usuario
    const user = await User.create({
      email: email.toLowerCase(),
      password: hashedPassword,
      riotId: `${riotAccount.gameName}#${riotAccount.tagLine}`,
      puuid: riotAccount.puuid,
      region,
      rank,
      role,
      schedule,
      accountLevel: rankData.accountLevel,
      cardImage: rankData.images?.large || null,
      lastRankUpdate: new Date(),
    });

    // 5. Generar token
    const token = generateToken(user);

    res.status(201).json({
      token,
      user: sanitizeUser(user),
    });
  } catch (err) {
    if (err.code === 11000) {
      const field = Object.keys(err.keyPattern)[0];
      return res.status(409).json({ message: `${field} already exists` });
    }
    next(err);
  }
};

/**
 * POST /api/auth/login
 * Autentica un usuario con email y contraseña.
 *
 * Body: { email, password }
 */
const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required' });
    }

    // Buscar usuario con password (select: false por defecto)
    const user = await User.findOne({ email: email.toLowerCase() }).select('+password');
    if (!user) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    // Comparar contraseña
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    const token = generateToken(user);

    res.json({
      token,
      user: sanitizeUser(user),
    });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/auth/me
 * Retorna el usuario autenticado actual.
 * Requiere middleware requireAuth.
 */
const getMe = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    res.json(sanitizeUser(user));
  } catch (err) {
    next(err);
  }
};

/**
 * PUT /api/auth/profile
 * Actualiza el perfil del usuario autenticado.
 * Solo permite actualizar campos de perfil (no email/password/rank).
 */
const updateProfile = async (req, res, next) => {
  try {
    const allowedFields = [
      'bio', 'profileImage', 'profileImageType', 'favoriteAgents',
      'favoriteRole', 'socialLinks', 'availability', 'schedule',
    ];

    const updates = {};
    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        updates[field] = req.body[field];
      }
    }

    const user = await User.findByIdAndUpdate(req.user.id, updates, {
      new: true,
      runValidators: true,
    });

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json(sanitizeUser(user));
  } catch (err) {
    next(err);
  }
};

module.exports = { register, login, getMe, updateProfile };
