// API Workout Controller - versão JSON das rotas de treino (usada pelo app mobile)
const { getStorageProvider } = require('../../services/storage');

const storageProvider = getStorageProvider();

function resolveImageUrl(req, publicUrl) {
  if (!publicUrl || /^https?:\/\//i.test(publicUrl)) return publicUrl;
  return `${req.protocol}://${req.get('host')}${publicUrl.startsWith('/') ? '' : '/'}${publicUrl}`;
}

exports.getWorkouts = async (req, res, next) => {
  try {
    const userId = req.user.id;

    const plansResult = await global.db.query(
      'SELECT id, name, description, "isActive", "order", "dayOfWeek" FROM "WorkoutPlan" WHERE "isActive" = true AND "userId" = $1 AND "isTemplate" = false ORDER BY "order" ASC',
      [userId]
    );

    const sessionsResult = await global.db.query(
      'SELECT COUNT(*) as count FROM "WorkoutSession" WHERE "userId" = $1 AND "isCompleted" = true',
      [userId]
    );

    const plans = await Promise.all(plansResult.rows.map(async (plan) => {
      const exercisesResult = await global.db.query(
        'SELECT id, name, sets, reps, weight, "restSeconds", notes, "order" FROM "Exercise" WHERE "workoutPlanId" = $1 ORDER BY "order" ASC',
        [plan.id]
      );
      const exerciseIds = exercisesResult.rows.map((exercise) => exercise.id);
      const imagesResult = exerciseIds.length > 0
        ? await global.db.query(
            `SELECT "exerciseId", "publicUrl" FROM "WorkoutExerciseImage"
             WHERE "exerciseId" = ANY($1::int[])
             ORDER BY "sortOrder" ASC, id ASC`,
            [exerciseIds]
          )
        : { rows: [] };
      const imagesByExerciseId = imagesResult.rows.reduce((map, image) => {
        if (!map.has(image.exerciseId)) map.set(image.exerciseId, []);
          map.get(image.exerciseId).push(resolveImageUrl(req, image.publicUrl));
        return map;
      }, new Map());

      const userSessionsResult = await global.db.query(
        'SELECT id FROM "WorkoutSession" WHERE "userId" = $1 AND "workoutPlanId" = $2 AND "isCompleted" = true',
        [userId, plan.id]
      );

      return {
        ...plan,
        exercises: exercisesResult.rows.map((exercise) => ({
          ...exercise,
          images: imagesByExerciseId.get(exercise.id) || [],
        })),
        sessions: userSessionsResult.rows,
      };
    }));

    res.json({
      success: true,
      plans,
      totalSessions: parseInt(sessionsResult.rows[0].count, 10),
    });
  } catch (error) {
    next(error);
  }
};

exports.startWorkout = async (req, res, next) => {
  try {
    const { id: planId } = req.params;
    const userId = req.user.id;

    const planResult = await global.db.query(
      'SELECT id, name, description FROM "WorkoutPlan" WHERE id = $1 AND "userId" = $2',
      [parseInt(planId, 10), userId]
    );

    if (planResult.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Plano não encontrado' });
    }

    const plan = planResult.rows[0];

    const existingSession = await global.db.query(
      `SELECT id FROM "WorkoutSession" WHERE "userId" = $1 AND "workoutPlanId" = $2 AND "isCompleted" = false ORDER BY "startedAt" DESC LIMIT 1`,
      [userId, plan.id]
    );

    if (existingSession.rows.length > 0) {
      return res.json({ success: true, sessionId: existingSession.rows[0].id, resumed: true });
    }

    const sessionResult = await global.db.query(
      `INSERT INTO "WorkoutSession" ("userId", "workoutPlanId", "startedAt", "isCompleted")
       VALUES ($1, $2, NOW(), false) RETURNING id`,
      [userId, plan.id]
    );
    const sessionId = sessionResult.rows[0].id;

    const exercisesResult = await global.db.query(
      'SELECT id FROM "Exercise" WHERE "workoutPlanId" = $1 ORDER BY "order" ASC',
      [plan.id]
    );

    for (const exercise of exercisesResult.rows) {
      await global.db.query(
        `INSERT INTO "SessionExercise" ("workoutSessionId", "exerciseId", "isCompleted")
         VALUES ($1, $2, false)`,
        [sessionId, exercise.id]
      );
    }

    res.status(201).json({ success: true, sessionId, resumed: false });
  } catch (error) {
    next(error);
  }
};

exports.getHistory = async (req, res, next) => {
  try {
    const userId = req.user.id;

    const sessionsResult = await global.db.query(
      `SELECT ws.id, ws."workoutPlanId", ws."startedAt", ws."completedAt", ws."durationMin", ws."notes",
              wp.name as plan_name
       FROM "WorkoutSession" ws
       JOIN "WorkoutPlan" wp ON ws."workoutPlanId" = wp.id
       WHERE ws."userId" = $1 AND ws."isCompleted" = true
       ORDER BY ws."completedAt" DESC`,
      [userId]
    );

    const sessions = sessionsResult.rows.map((row) => ({
      id: row.id,
      workoutPlanId: row.workoutPlanId,
      startedAt: row.startedAt,
      completedAt: row.completedAt,
      durationMin: row.durationMin,
      notes: row.notes,
      planName: row.plan_name,
    }));

    res.json({ success: true, sessions, totalSessions: sessions.length });
  } catch (error) {
    next(error);
  }
};

exports.getActiveWorkout = async (req, res, next) => {
  try {
    const sessionId = parseInt(req.params.sessionId, 10);
    const sessionResult = await global.db.query(
      `SELECT ws.id, ws."startedAt", wp.name AS "planName" FROM "WorkoutSession" ws
       JOIN "WorkoutPlan" wp ON wp.id = ws."workoutPlanId"
       WHERE ws.id = $1 AND ws."userId" = $2 AND ws."isCompleted" = false`,
      [sessionId, req.user.id]
    );
    if (!sessionResult.rows[0]) return res.status(404).json({ success: false, message: 'Sessão de treino não encontrada' });
    const exercisesResult = await global.db.query(
      `SELECT se.id AS "sessionExerciseId", se."isCompleted", e.id, e.name, e.sets, e.reps, e.weight,
       (SELECT "publicUrl" FROM "WorkoutExerciseImage" WHERE "exerciseId" = e.id ORDER BY "sortOrder", id LIMIT 1) AS image
       FROM "SessionExercise" se JOIN "Exercise" e ON e.id = se."exerciseId"
       WHERE se."workoutSessionId" = $1 ORDER BY e."order" ASC`,
      [sessionId]
    );
    const exercises = exercisesResult.rows.map((exercise) => ({
      ...exercise,
      image: resolveImageUrl(req, exercise.image),
    }));
    res.json({ success: true, session: sessionResult.rows[0], exercises });
  } catch (error) { next(error); }
};

exports.completeExercise = async (req, res, next) => {
  try {
    const result = await global.db.query(
      `UPDATE "SessionExercise" se SET "isCompleted" = true, "completedAt" = NOW()
       FROM "WorkoutSession" ws WHERE se.id = $1 AND se."workoutSessionId" = $2
       AND ws.id = se."workoutSessionId" AND ws."userId" = $3 AND ws."isCompleted" = false RETURNING se.id`,
      [parseInt(req.params.sessionExerciseId, 10), parseInt(req.params.sessionId, 10), req.user.id]
    );
    if (!result.rows[0]) return res.status(404).json({ success: false, message: 'Exercício não encontrado' });
    res.json({ success: true });
  } catch (error) { next(error); }
};

exports.completeWorkout = async (req, res, next) => {
  try {
    const result = await global.db.query(
      `UPDATE "WorkoutSession" SET "isCompleted" = true, "completedAt" = NOW(), "durationMin" = $1
       WHERE id = $2 AND "userId" = $3 AND "isCompleted" = false RETURNING id`,
      [parseInt(req.body.durationMin, 10) || 0, parseInt(req.params.sessionId, 10), req.user.id]
    );
    if (!result.rows[0]) return res.status(404).json({ success: false, message: 'Sessão de treino não encontrada' });
    res.json({ success: true });
  } catch (error) { next(error); }
};

// ========================
// GERENCIAR PLANOS/TEMPLATES (admin/instrutor)
// ========================

exports.createWorkoutPlan = async (req, res, next) => {
  try {
    const { name, description, dayOfWeek } = req.body;
    if (typeof name !== 'string' || !name.trim()) {
      return res.status(400).json({ success: false, message: 'Nome é obrigatório' });
    }
    const result = await global.db.query(
      `INSERT INTO "WorkoutPlan" ("userId", name, description, "dayOfWeek", "isActive", "isTemplate")
       VALUES ($1, $2, $3, $4, true, false) RETURNING *`,
      [req.user.id, name.trim(), typeof description === 'string' ? description.trim() || null : null,
        typeof dayOfWeek === 'string' ? dayOfWeek.trim() || null : null]
    );
    res.status(201).json({ success: true, plan: result.rows[0] });
  } catch (error) {
    next(error);
  }
};

exports.deleteWorkoutPlan = async (req, res, next) => {
  try {
    const planId = Number.parseInt(req.params.planId, 10);
    const planCheck = await global.db.query(
      `SELECT id FROM "WorkoutPlan" WHERE id = $1 AND "userId" = $2`,
      [planId, req.user.id]
    );
    if (planCheck.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Plano não encontrado' });
    }
    await global.db.query(`DELETE FROM "WorkoutSession" WHERE "workoutPlanId" = $1`, [planId]);
    await global.db.query(`DELETE FROM "Exercise" WHERE "workoutPlanId" = $1`, [planId]);
    await global.db.query(`DELETE FROM "WorkoutPlan" WHERE id = $1`, [planId]);
    res.json({ success: true });
  } catch (error) {
    next(error);
  }
};

exports.toggleTemplate = async (req, res, next) => {
  try {
    const planId = Number.parseInt(req.params.planId, 10);
    const result = await global.db.query(
      `UPDATE "WorkoutPlan" SET "isTemplate" = NOT "isTemplate"
       WHERE id = $1 AND "userId" = $2 RETURNING id, "isTemplate"`,
      [planId, req.user.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Plano não encontrado' });
    }
    res.json({ success: true, plan: result.rows[0] });
  } catch (error) {
    next(error);
  }
};

exports.updateWorkoutPlan = async (req, res, next) => {
  try {
    const { planId } = req.params;
    const { name, description, dayOfWeek, isActive } = req.body;
    if (!name) {
      return res.status(400).json({ success: false, message: 'Nome é obrigatório' });
    }
    const result = await global.db.query(
      `UPDATE "WorkoutPlan" SET name = $1, description = $2, "dayOfWeek" = $3, "isActive" = $4
       WHERE id = $5 AND "userId" = $6 RETURNING *`,
      [name, description || null, dayOfWeek || null, isActive !== undefined ? isActive : true, parseInt(planId, 10), req.user.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Plano não encontrado' });
    }
    res.json({ success: true, plan: result.rows[0] });
  } catch (error) {
    next(error);
  }
};

exports.getExercisesForPlan = async (req, res, next) => {
  try {
    const { planId } = req.params;
    const planCheck = await global.db.query('SELECT id FROM "WorkoutPlan" WHERE id = $1 AND "userId" = $2', [parseInt(planId, 10), req.user.id]);
    if (planCheck.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Plano não encontrado' });
    }
    const result = await global.db.query(
      `SELECT id, name, sets, reps, weight, "restSeconds", notes, "order" FROM "Exercise" WHERE "workoutPlanId" = $1 ORDER BY "order" ASC`,
      [parseInt(planId, 10)]
    );
    res.json({ success: true, exercises: result.rows });
  } catch (error) {
    next(error);
  }
};

exports.addExercise = async (req, res, next) => {
  try {
    const { planId } = req.params;
    const { name, sets, reps, weight, restSeconds, notes } = req.body;
    if (!name || !sets || !reps) {
      return res.status(400).json({ success: false, message: 'Nome, séries e repetições são obrigatórios' });
    }
    const planCheck = await global.db.query('SELECT id FROM "WorkoutPlan" WHERE id = $1 AND "userId" = $2', [parseInt(planId, 10), req.user.id]);
    if (planCheck.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Plano não encontrado' });
    }
    const result = await global.db.query(
      `INSERT INTO "Exercise" ("workoutPlanId", name, sets, reps, weight, "restSeconds", notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [parseInt(planId, 10), name, parseInt(sets, 10), reps, weight || null, restSeconds ? parseInt(restSeconds, 10) : null, notes || null]
    );
    res.status(201).json({ success: true, exercise: result.rows[0] });
  } catch (error) {
    next(error);
  }
};

exports.updateExercise = async (req, res, next) => {
  try {
    const { exerciseId } = req.params;
    const { name, sets, reps, weight, restSeconds, notes } = req.body;
    if (!name || !sets || !reps) {
      return res.status(400).json({ success: false, message: 'Nome, séries e repetições são obrigatórios' });
    }
    const ownerCheck = await global.db.query(
      `SELECT e.id FROM "Exercise" e JOIN "WorkoutPlan" wp ON e."workoutPlanId" = wp.id WHERE e.id = $1 AND wp."userId" = $2`,
      [parseInt(exerciseId, 10), req.user.id]
    );
    if (ownerCheck.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Exercício não encontrado' });
    }
    const result = await global.db.query(
      `UPDATE "Exercise" SET name = $1, sets = $2, reps = $3, weight = $4, "restSeconds" = $5, notes = $6
       WHERE id = $7 RETURNING *`,
      [name, parseInt(sets, 10), reps, weight || null, restSeconds ? parseInt(restSeconds, 10) : null, notes || null, parseInt(exerciseId, 10)]
    );
    res.json({ success: true, exercise: result.rows[0] });
  } catch (error) {
    next(error);
  }
};

exports.uploadExerciseImage = async (req, res, next) => {
  try {
    const exerciseId = Number.parseInt(req.params.exerciseId, 10);
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'Nenhuma imagem enviada.' });
    }

    const ownerCheck = await global.db.query(
      `SELECT e.id FROM "Exercise" e JOIN "WorkoutPlan" wp ON e."workoutPlanId" = wp.id
       WHERE e.id = $1 AND wp."userId" = $2`,
      [exerciseId, req.user.id]
    );
    if (ownerCheck.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Exercício não encontrado.' });
    }

    const upload = await storageProvider.uploadBuffer({
      buffer: req.file.buffer,
      mimeType: req.file.mimetype,
      originalName: req.file.originalname,
      folder: `workouts/exercises/${exerciseId}`,
    });
    const result = await global.db.query(
      `INSERT INTO "WorkoutExerciseImage"
       ("exerciseId", "createdBy", "storageProvider", "storageKey", "publicUrl", "fileName", "mimeType", "sizeBytes")
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING id, "exerciseId", "publicUrl", "fileName", "mimeType", "sizeBytes", "createdAt"`,
      [exerciseId, req.user.id, process.env.STORAGE_PROVIDER || 'local', upload.key, upload.publicUrl,
        req.file.originalname, req.file.mimetype, upload.sizeBytes]
    );
    const image = result.rows[0];
    image.publicUrl = resolveImageUrl(req, image.publicUrl);
    res.status(201).json({ success: true, image });
  } catch (error) {
    next(error);
  }
};

exports.getExerciseImages = async (req, res, next) => {
  try {
    const exerciseId = Number.parseInt(req.params.exerciseId, 10);
    const ownerCheck = await global.db.query(
      `SELECT e.id FROM "Exercise" e JOIN "WorkoutPlan" wp ON e."workoutPlanId" = wp.id
       WHERE e.id = $1 AND wp."userId" = $2`,
      [exerciseId, req.user.id]
    );
    if (ownerCheck.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Exercício não encontrado.' });
    }
    const result = await global.db.query(
      `SELECT id, "exerciseId", "publicUrl", "fileName", "mimeType", "sizeBytes", "createdAt", "sortOrder"
       FROM "WorkoutExerciseImage" WHERE "exerciseId" = $1 ORDER BY "sortOrder" ASC, id ASC`,
      [exerciseId]
    );
    res.json({ success: true, images: result.rows.map((image) => ({ ...image, publicUrl: resolveImageUrl(req, image.publicUrl) })) });
  } catch (error) {
    next(error);
  }
};

exports.deleteExerciseImage = async (req, res, next) => {
  try {
    const exerciseId = Number.parseInt(req.params.exerciseId, 10);
    const imageId = Number.parseInt(req.params.imageId, 10);
    const result = await global.db.query(
      `SELECT wei.id, wei."storageKey" FROM "WorkoutExerciseImage" wei
       JOIN "Exercise" e ON e.id = wei."exerciseId"
       JOIN "WorkoutPlan" wp ON wp.id = e."workoutPlanId"
       WHERE wei.id = $1 AND wei."exerciseId" = $2 AND wp."userId" = $3`,
      [imageId, exerciseId, req.user.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Imagem não encontrada.' });
    }
    await storageProvider.deleteObject(result.rows[0].storageKey);
    await global.db.query(`DELETE FROM "WorkoutExerciseImage" WHERE id = $1`, [imageId]);
    res.json({ success: true });
  } catch (error) {
    next(error);
  }
};

exports.deleteExercise = async (req, res, next) => {
  try {
    const id = parseInt(req.params.exerciseId, 10);
    const checkResult = await global.db.query(
      `SELECT e.id FROM "Exercise" e JOIN "WorkoutPlan" wp ON e."workoutPlanId" = wp.id WHERE e.id = $1 AND wp."userId" = $2`,
      [id, req.user.id]
    );
    if (checkResult.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Exercício não encontrado' });
    }
    await global.db.query('DELETE FROM "SessionExercise" WHERE "exerciseId" = $1', [id]);
    await global.db.query('DELETE FROM "Exercise" WHERE id = $1', [id]);
    res.json({ success: true });
  } catch (error) {
    next(error);
  }
};
