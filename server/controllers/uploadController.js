/**
 * UPLOAD CONTROLLER - PremadeGG
 *
 * Maneja la subida de avatares de perfil.
 * Usa Multer para recibir el archivo y lo guarda en /uploads.
 */

const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Asegurar que el directorio de uploads existe
const UPLOADS_DIR = path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

// Configuración de Multer
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, UPLOADS_DIR);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const uniqueName = `avatar-${req.user.id}-${Date.now()}${ext}`;
    cb(null, uniqueName);
  },
});

const fileFilter = (_req, file, cb) => {
  const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif'];
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    const err = new Error('Only image files are allowed (jpeg, png, webp, gif)');
    err.statusCode = 400;
    cb(err, false);
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 2 * 1024 * 1024 }, // 2MB
});

/**
 * POST /api/upload/avatar
 * Sube una imagen de avatar. Requiere auth.
 * Retorna la URL relativa de la imagen.
 */
const uploadAvatar = [
  upload.single('avatar'),
  (req, res, next) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: 'No file uploaded' });
      }

      const imageUrl = `/uploads/${req.file.filename}`;

      res.json({
        message: 'Avatar uploaded successfully',
        url: imageUrl,
      });
    } catch (err) {
      next(err);
    }
  },
];

module.exports = { uploadAvatar };
