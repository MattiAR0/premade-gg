/**
 * APP.JS - Entry Point de PremadeGG API
 *
 * Arquitectura MVC estricta:
 * - Este archivo SOLO configura Express, middlewares y monta rutas.
 * - Toda la lógica de negocio vive en /controllers.
 * - Las rutas se definen en /routes.
 * - Los errores se manejan en /middlewares/errorHandler.
 */

const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const compression = require('compression');
const morgan = require('morgan');
const path = require('path');
require('dotenv').config();

// Rutas
const userRoutes = require('./routes/userRoutes');
const reputationRoutes = require('./routes/reputationRoutes');
const lfgPostRoutes = require('./routes/lfgPostRoutes');
const teamRoutes = require('./routes/teamRoutes');
const riotRoutes = require('./routes/riotRoutes');
const authRoutes = require('./routes/authRoutes');
const uploadRoutes = require('./routes/uploadRoutes');

// Middlewares
const errorHandler = require('./middlewares/errorHandler');

// Services
const { verifyConnection: verifySmtp } = require('./services/emailService');

// ── Configuración ─────────────────────────────────────
const app = express();
const PORT = process.env.PORT || 4000;
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/premade-gg';

// ── Middlewares globales ──────────────────────────────
app.use(cors());
app.use(compression());       // Comprime respuestas JSON (~70% menos tamaño)
app.use(express.json());

// Logs condicionales (Requisito Rúbrica: 20%)
// development → logs detallados | production → solo errores
if (process.env.NODE_ENV === 'production') {
  app.use(
    morgan('combined', {
      skip: (_req, res) => res.statusCode < 400,
    }),
  );
} else {
  app.use(morgan('dev'));
}

// ── Cache-Control para la API ────────────────────────
// GETs: no-cache fuerza al navegador a revalidar siempre con el servidor,
// pero permite usar respuesta cacheada si no ha cambiado (304 Not Modified).
// Esto evita que el browser sirva respuestas vacías obsoletas (ej: antes del seed).
// La cache real de rendimiento la maneja ApiService en el frontend (in-memory, 60s TTL).
// Mutaciones: no-store prohíbe cualquier tipo de cache.
const apiCacheControl = (req, res, next) => {
  if (req.method === 'GET') {
    res.set('Cache-Control', 'no-cache');
  } else {
    res.set('Cache-Control', 'no-store');
  }
  next();
};

// ── Archivos estáticos (uploads de avatares) ─────────
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// ── Montaje de rutas (MVC) ────────────────────────────
app.use('/api/auth', apiCacheControl, authRoutes);
app.use('/api/upload', apiCacheControl, uploadRoutes);
app.use('/api/users', apiCacheControl, userRoutes);
app.use('/api/reviews', apiCacheControl, reputationRoutes);
app.use('/api/lfg', apiCacheControl, lfgPostRoutes);
app.use('/api/teams', apiCacheControl, teamRoutes);
app.use('/api/riot', riotRoutes); // Riot API no se cachea (datos en tiempo real)

// Ruta raíz (health check)
app.get('/', (_req, res) => {
  res.json({
    message: 'PremadeGG API is running',
    environment: process.env.NODE_ENV || 'development',
    endpoints: {
      auth: '/api/auth',
      users: '/api/users',
      reviews: '/api/reviews',
      lfg: '/api/lfg',
      teams: '/api/teams',
      riot: '/api/riot',
      upload: '/api/upload',
    },
  });
});

// ── Middleware de errores (siempre al final) ──────────
app.use(errorHandler);

// ── Conexión a MongoDB y arranque ─────────────────────
mongoose
  .connect(MONGO_URI)
  .then(async () => {
    console.log('✅ MongoDB connected:', MONGO_URI);
    await verifySmtp();
    app.listen(PORT, () => {
      console.log(`🚀 PremadeGG API running on port ${PORT}`);
    });
  })
  .catch((err) => {
    console.error('❌ MongoDB connection error:', err);
    process.exit(1);
  });

module.exports = app;
