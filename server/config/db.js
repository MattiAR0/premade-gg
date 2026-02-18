/**
 * DATABASE CONFIGURATION - PremadeGG
 *
 * Centraliza la configuración y conexión a MongoDB.
 * Se importa desde app.js para mantener app.js limpio de lógica.
 */

const mongoose = require('mongoose');

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/premade-gg';

/**
 * Conecta a MongoDB y devuelve la conexión.
 * @returns {Promise<typeof mongoose>}
 */
const connectDB = async () => {
  const conn = await mongoose.connect(MONGO_URI);
  console.log('✅ MongoDB connected:', MONGO_URI);
  return conn;
};

module.exports = { connectDB, MONGO_URI };
