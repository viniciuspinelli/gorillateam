// "Minha Evolução" — student self-tracked body weight log and progress photos.
const { getStorageProvider } = require('../services/storage');

const storageProvider = getStorageProvider();

// pg returns DATE columns as JS Date objects (UTC midnight); the views build
// display dates by string-concatenating a local-time suffix onto this field,
// which only works against a plain "YYYY-MM-DD" string. toISOString().slice
// pulls that string back out without a local-timezone day-shift.
function toDateString(date) {
  return date.toISOString().slice(0, 10);
}

exports.getEvolution = async (req, res, next) => {
  try {
    const userId = req.session.user.id;

    const weightResult = await global.db.query(
      `SELECT id, weight, "recordedAt" FROM "BodyWeightLog" WHERE "userId" = $1 ORDER BY "recordedAt" ASC`,
      [userId]
    );
    const photosResult = await global.db.query(
      `SELECT id, "publicUrl", "fileName", "takenAt" FROM "ProgressPhoto" WHERE "userId" = $1 ORDER BY "takenAt" DESC, id DESC`,
      [userId]
    );

    res.render('body/evolution', {
      title: 'Minha Evolução',
      csrfToken: req.csrfToken(),
      weightLogs: weightResult.rows.map((row) => ({ ...row, recordedAt: toDateString(row.recordedAt) })),
      photos: photosResult.rows.map((row) => ({ ...row, takenAt: toDateString(row.takenAt) })),
    });
  } catch (error) {
    next(error);
  }
};

exports.addWeight = async (req, res, next) => {
  try {
    const userId = req.session.user.id;
    const { weight, recordedAt } = req.body;

    const parsedWeight = parseFloat(weight);
    if (!parsedWeight || parsedWeight <= 0 || parsedWeight > 999) {
      return res.status(400).json({ success: false, message: 'Informe um peso válido' });
    }

    const result = await global.db.query(
      `INSERT INTO "BodyWeightLog" ("userId", weight, "recordedAt")
       VALUES ($1, $2, COALESCE($3, CURRENT_DATE))
       ON CONFLICT ("userId", "recordedAt") DO UPDATE SET weight = $2
       RETURNING id, weight, "recordedAt"`,
      [userId, parsedWeight, recordedAt || null]
    );

    res.status(201).json({ success: true, entry: result.rows[0] });
  } catch (error) {
    next(error);
  }
};

exports.deleteWeight = async (req, res, next) => {
  try {
    const userId = req.session.user.id;
    const { id } = req.params;

    const result = await global.db.query(
      `DELETE FROM "BodyWeightLog" WHERE id = $1 AND "userId" = $2 RETURNING id`,
      [parseInt(id, 10), userId]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Registro não encontrado' });
    }

    res.json({ success: true });
  } catch (error) {
    next(error);
  }
};

exports.uploadPhoto = async (req, res, next) => {
  try {
    const userId = req.session.user.id;

    if (!req.file) {
      return res.status(400).json({ success: false, message: 'Nenhuma imagem enviada.' });
    }

    const upload = await storageProvider.uploadBuffer({
      buffer: req.file.buffer,
      mimeType: req.file.mimetype,
      originalName: req.file.originalname,
      folder: `body/${userId}`,
    });

    const inserted = await global.db.query(
      `INSERT INTO "ProgressPhoto"
       ("userId", "storageProvider", "storageKey", "publicUrl", "fileName", "mimeType", "sizeBytes", "takenAt")
       VALUES ($1, $2, $3, $4, $5, $6, $7, COALESCE($8, CURRENT_DATE))
       RETURNING id, "publicUrl", "fileName", "takenAt"`,
      [
        userId,
        process.env.STORAGE_PROVIDER || 'local',
        upload.key,
        upload.publicUrl,
        req.file.originalname,
        req.file.mimetype,
        upload.sizeBytes,
        req.body.takenAt || null,
      ]
    );

    res.status(201).json({ success: true, photo: inserted.rows[0] });
  } catch (error) {
    next(error);
  }
};

exports.deletePhoto = async (req, res, next) => {
  try {
    const userId = req.session.user.id;
    const { id } = req.params;

    const photoResult = await global.db.query(
      `SELECT id, "storageKey" FROM "ProgressPhoto" WHERE id = $1 AND "userId" = $2`,
      [parseInt(id, 10), userId]
    );
    if (photoResult.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Foto não encontrada' });
    }

    await storageProvider.deleteObject(photoResult.rows[0].storageKey);
    await global.db.query(`DELETE FROM "ProgressPhoto" WHERE id = $1`, [parseInt(id, 10)]);

    res.json({ success: true });
  } catch (error) {
    next(error);
  }
};
