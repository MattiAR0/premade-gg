/**
 * Middleware centralizado de errores.
 * Captura cualquier error que pase por next(err) en los controladores.
 */
const errorHandler = (err, _req, res, _next) => {
  console.error('❌ Error:', err.message);

  // Errores de validación de Mongoose
  if (err.name === 'ValidationError') {
    const messages = Object.values(err.errors).map((e) => e.message);
    return res.status(400).json({ message: 'Validation error', errors: messages });
  }

  // Error de cast (ID inválido de MongoDB)
  if (err.name === 'CastError') {
    return res.status(400).json({ message: `Invalid ${err.path}: ${err.value}` });
  }

  // Error genérico
  const statusCode = err.statusCode || 500;
  res.status(statusCode).json({
    message: err.message || 'Internal server error',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  });
};

module.exports = errorHandler;
