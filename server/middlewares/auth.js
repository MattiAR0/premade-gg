/**
 * AUTH MIDDLEWARE - PremadeGG
 *
 * Verifica el JWT del header Authorization: Bearer <token>.
 * Si es válido, adjunta req.user con { id, email }.
 * Si no, devuelve 401.
 */

const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'premadegg-dev-secret-change-in-prod';

/**
 * Middleware obligatorio: requiere token válido.
 */
const requireAuth = (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ message: 'Access denied. No token provided.' });
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, JWT_SECRET);

    req.user = { id: decoded.id, email: decoded.email };
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ message: 'Token expired.' });
    }
    return res.status(401).json({ message: 'Invalid token.' });
  }
};

/**
 * Middleware opcional: si hay token lo decodifica, si no, continúa sin user.
 */
const optionalAuth = (req, _res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.split(' ')[1];
      const decoded = jwt.verify(token, JWT_SECRET);
      req.user = { id: decoded.id, email: decoded.email };
    }
  } catch {
    // Token inválido, simplemente no adjuntamos user
  }
  next();
};

/**
 * Genera un JWT para un usuario.
 * @param {Object} user - Documento de usuario de Mongoose
 * @returns {string} Token JWT
 */
const generateToken = (user) => {
  return jwt.sign(
    { id: user._id, email: user.email },
    JWT_SECRET,
    { expiresIn: '7d' },
  );
};

module.exports = { requireAuth, optionalAuth, generateToken, JWT_SECRET };
