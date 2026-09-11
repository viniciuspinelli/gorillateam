const multer = require('multer');

const IMAGE_MIME_TYPES = new Set([
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/avif',
]);

const exerciseImageUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: parseInt(process.env.MAX_EXERCISE_IMAGE_SIZE_BYTES || `${10 * 1024 * 1024}`, 10),
  },
  fileFilter: (req, file, cb) => {
    if (!IMAGE_MIME_TYPES.has(file.mimetype)) {
      return cb(new Error('Formato de imagem não suportado. Use JPG, PNG, WEBP, GIF ou AVIF.'));
    }
    cb(null, true);
  },
});

module.exports = {
  exerciseImageUpload,
};
