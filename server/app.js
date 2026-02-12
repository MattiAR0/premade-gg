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
require('dotenv').config();

// Rutas
const userRoutes = require('./routes/userRoutes');
const reputationRoutes = require('./routes/reputationRoutes');
const lfgPostRoutes = require('./routes/lfgPostRoutes');
const riotRoutes = require('./routes/riotRoutes');

// Middlewares
const errorHandler = require('./middlewares/errorHandler');

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

// ── Montaje de rutas (MVC) ────────────────────────────
app.use('/api/users', userRoutes);
app.use('/api/reviews', reputationRoutes);
app.use('/api/lfg', lfgPostRoutes);
app.use('/api/riot', riotRoutes);

// Ruta raíz (health check)
app.get('/', (_req, res) => {
  res.json({
    message: 'PremadeGG API is running',
    environment: process.env.NODE_ENV || 'development',
    endpoints: {
      users: '/api/users',
      reviews: '/api/reviews',
      lfg: '/api/lfg',
      riot: '/api/riot',
    },
  });
});

// ── Middleware de errores (siempre al final) ──────────
app.use(errorHandler);

// ── Conexión a MongoDB y arranque ─────────────────────
mongoose
  .connect(MONGO_URI)
  .then(() => {
    console.log('✅ MongoDB connected:', MONGO_URI);
    app.listen(PORT, () => {
      console.log(`🚀 PremadeGG API running on port ${PORT}`);
    });
  })
  .catch((err) => {
    console.error('❌ MongoDB connection error:', err);
    process.exit(1);
  });

module.exports = app;
