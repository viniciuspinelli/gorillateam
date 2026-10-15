// API Workout Controller - versão JSON das rotas de treino (usada pelo app mobile)
const { getStorageProvider } = require('../../services/storage');
const { sendPushToUser } = require('../../services/pushNotifications');

const storageProvider = getStorageProvider();

function resolveImageUrl(req, publicUrl) {
  if (!publicUrl || /^https?:\/\//i.test(publicUrl)) return publicUrl;
  return `${req.protocol}://${req.get('host')}${publicUrl.startsWith('/') ? '' : '/'}${publicUrl}`;
}

async function loadExercisesWithImages(req, workoutGroupId) {
  const exercisesResult = await global.db.query(
    'SELECT id, name, sets, reps, weight, "restSeconds", notes, "order" FROM "Exercise" WHERE "workoutGroupId" = $1 ORDER BY "order" ASC',
    [workoutGroupId]
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

  return exercisesResult.rows.map((exercise) => ({
    ...exercise,
    images: imagesByExerciseId.get(exercise.id) || [],
  }));
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
      const groupsResult = await global.db.query(
        'SELECT id, name, "order" FROM "WorkoutGroup" WHERE "workoutPlanId" = $1 ORDER BY "order" ASC',
        [plan.id]
      );

      const groups = await Promise.all(groupsResult.rows.map(async (group) => {
        const exercises = await loadExercisesWithImages(req, group.id);
        const groupSessionsResult = await global.db.query(
          'SELECT id FROM "WorkoutSession" WHERE "userId" = $1 AND "workoutGroupId" = $2 AND "isCompleted" = true',
          [userId, group.id]
        );
        const totalSets = exercises.reduce((sum, ex) => sum + (ex.sets || 0), 0);
        return { ...group, exercises, sessions: groupSessionsResult.rows, totalSets };
      }));

      return { ...plan, groups };
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
    const { groupId } = req.params;
    const userId = req.user.id;

    const groupResult = await global.db.query(
      `SELECT wg.id, wg.name, wg."workoutPlanId" FROM "WorkoutGroup" wg
       JOIN "WorkoutPlan" wp ON wg."workoutPlanId" = wp.id
       WHERE wg.id = $1 AND wp."userId" = $2`,
      [parseInt(groupId, 10), userId]
    );

    if (groupResult.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Treino não encontrado' });
    }

    const group = groupResult.rows[0];

    const existingSession = await global.db.query(
      `SELECT id FROM "WorkoutSession" WHERE "userId" = $1 AND "workoutGroupId" = $2 AND "isCompleted" = false ORDER BY "startedAt" DESC LIMIT 1`,
      [userId, group.id]
    );

    if (existingSession.rows.length > 0) {
      return res.json({ success: true, sessionId: existingSession.rows[0].id, resumed: true });
    }

    const sessionResult = await global.db.query(
      `INSERT INTO "WorkoutSession" ("userId", "workoutPlanId", "workoutGroupId", "startedAt", "isCompleted")
       VALUES ($1, $2, $3, NOW(), false) RETURNING id`,
      [userId, group.workoutPlanId, group.id]
    );
    const sessionId = sessionResult.rows[0].id;

    const exercisesResult = await global.db.query(
      'SELECT id FROM "Exercise" WHERE "workoutGroupId" = $1 ORDER BY "order" ASC',
      [group.id]
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
      `SELECT ws.id, ws."workoutPlanId", ws."startedAt", ws."completedAt", ws."durationMin", ws."notes", ws."instructorReply",
              wp.name as plan_name, wg.name as group_name
       FROM "WorkoutSession" ws
       JOIN "WorkoutPlan" wp ON ws."workoutPlanId" = wp.id
       LEFT JOIN "WorkoutGroup" wg ON ws."workoutGroupId" = wg.id
       WHERE ws."userId" = $1 AND ws."isCompleted" = true
       ORDER BY ws."completedAt" DESC`,
      [userId]
    );

    const sessions = await Promise.all(sessionsResult.rows.map(async (row) => {
      const exercisesResult = await global.db.query(
        `SELECT se.id, se."isCompleted", se."actualWeight", se."actualReps", e.name, e.sets, e.reps
         FROM "SessionExercise" se JOIN "Exercise" e ON se."exerciseId" = e.id
         WHERE se."workoutSessionId" = $1 ORDER BY e."order" ASC`,
        [row.id]
      );
      return {
        id: row.id,
        workoutPlanId: row.workoutPlanId,
        startedAt: row.startedAt,
        completedAt: row.completedAt,
        durationMin: row.durationMin,
        notes: row.notes,
        planName: row.plan_name,
        groupName: row.group_name,
        sessionExercises: exercisesResult.rows,
      };
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
      `SELECT ws.id, ws."startedAt", wp.name AS "planName", wg.name AS "groupName" FROM "WorkoutSession" ws
       JOIN "WorkoutPlan" wp ON wp.id = ws."workoutPlanId"
       LEFT JOIN "WorkoutGroup" wg ON wg.id = ws."workoutGroupId"
       WHERE ws.id = $1 AND ws."userId" = $2 AND ws."isCompleted" = false`,
      [sessionId, req.user.id]
    );
    if (!sessionResult.rows[0]) return res.status(404).json({ success: false, message: 'Sessão de treino não encontrada' });
    const exercisesResult = await global.db.query(
      `SELECT se.id AS "sessionExerciseId", se."isCompleted", se."actualWeight", se."actualReps", e.id, e.name, e.sets, e.reps, e.weight,
       (SELECT "publicUrl" FROM "WorkoutExerciseImage" WHERE "exerciseId" = e.id ORDER BY "sortOrder", id LIMIT 1) AS image
       FROM "SessionExercise" se JOIN "Exercise" e ON e.id = se."exerciseId"
       WHERE se."workoutSessionId" = $1 ORDER BY e."order" ASC`,
      [sessionId]
    );
    const exerciseIds = exercisesResult.rows.map((exercise) => exercise.id);
    const lastUsedResult = exerciseIds.length > 0
      ? await global.db.query(
          `SELECT DISTINCT ON (se."exerciseId") se."exerciseId", se."actualWeight", se."actualReps"
           FROM "SessionExercise" se
           JOIN "WorkoutSession" ws ON ws.id = se."workoutSessionId"
           WHERE ws."userId" = $1 AND ws."isCompleted" = true AND ws.id <> $2
             AND se."exerciseId" = ANY($3::int[]) AND se."actualWeight" IS NOT NULL
           ORDER BY se."exerciseId", ws."completedAt" DESC`,
          [req.user.id, sessionId, exerciseIds]
        )
      : { rows: [] };
    const lastUsedByExerciseId = new Map(lastUsedResult.rows.map((row) => [row.exerciseId, row]));

    const exercises = exercisesResult.rows.map((exercise) => ({
      ...exercise,
      lastWeight: lastUsedByExerciseId.get(exercise.id)?.actualWeight || null,
      lastReps: lastUsedByExerciseId.get(exercise.id)?.actualReps || null,
      image: resolveImageUrl(req, exercise.image),
    }));
    res.json({ success: true, session: sessionResult.rows[0], exercises });
  } catch (error) { next(error); }
};

exports.completeExercise = async (req, res, next) => {
  try {
    const { actualWeight, actualReps } = req.body || {};
    const result = await global.db.query(
      `UPDATE "SessionExercise" se SET "isCompleted" = true, "completedAt" = NOW(), "actualWeight" = $4, "actualReps" = $5
       FROM "WorkoutSession" ws WHERE se.id = $1 AND se."workoutSessionId" = $2
       AND ws.id = se."workoutSessionId" AND ws."userId" = $3 AND ws."isCompleted" = false RETURNING se.id`,
      [parseInt(req.params.sessionExerciseId, 10), parseInt(req.params.sessionId, 10), req.user.id, actualWeight?.trim() || null, actualReps?.trim() || null]
    );
    if (!result.rows[0]) return res.status(404).json({ success: false, message: 'Exercício não encontrado' });
    res.json({ success: true });
  } catch (error) { next(error); }
};

exports.completeWorkout = async (req, res, next) => {
  try {
    const { durationMin, notes } = req.body || {};
    const result = await global.db.query(
      `UPDATE "WorkoutSession" SET "isCompleted" = true, "completedAt" = NOW(), "durationMin" = $1, "notes" = $4
       WHERE id = $2 AND "userId" = $3 AND "isCompleted" = false RETURNING id`,
      [parseInt(durationMin, 10) || 0, parseInt(req.params.sessionId, 10), req.user.id, notes?.trim() || null]
    );
    if (!result.rows[0]) return res.status(404).json({ success: false, message: 'Sessão de treino não encontrada' });

    if (notes?.trim()) {
      const studentResult = await global.db.query('SELECT "instructorId", "fullName", username FROM "User" WHERE id = $1', [req.user.id]);
      const student = studentResult.rows[0];
      if (student?.instructorId) {
        sendPushToUser(student.instructorId, {
          title: 'Novo feedback de treino',
          body: `${student.fullName || student.username} comentou sobre o treino de hoje.`,
          data: { type: 'workout_feedback', studentId: req.user.id },
        });
      }
    }

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
    await global.db.query(`DELETE FROM "WorkoutGroup" WHERE "workoutPlanId" = $1`, [planId]);
    await global.db.query(`DELETE FROM "WorkoutPlan" WHERE id = $1`, [planId]);
    res.json({ success: true });
  } catch (error) {
    next(error);
  }
};

exports.getWorkoutGroups = async (req, res, next) => {
  try {
    const { planId } = req.params;
    const planCheck = await global.db.query('SELECT id FROM "WorkoutPlan" WHERE id = $1 AND "userId" = $2', [parseInt(planId, 10), req.user.id]);
    if (planCheck.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Plano não encontrado' });
    }
    const result = await global.db.query(
      `SELECT wg.id, wg.name, wg."order", COUNT(e.id) AS exercise_count, COALESCE(SUM(e.sets), 0) AS total_sets
       FROM "WorkoutGroup" wg LEFT JOIN "Exercise" e ON e."workoutGroupId" = wg.id
       WHERE wg."workoutPlanId" = $1 GROUP BY wg.id ORDER BY wg."order" ASC`,
      [parseInt(planId, 10)]
    );
    const groups = result.rows.map((g) => ({
      ...g,
      exercise_count: parseInt(g.exercise_count, 10),
      total_sets: parseInt(g.total_sets, 10),
    }));
    res.json({ success: true, groups });
  } catch (error) {
    next(error);
  }
};

exports.createWorkoutGroup = async (req, res, next) => {
  try {
    const { planId } = req.params;
    const { name } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, message: 'Nome do grupo muscular é obrigatório' });
    }
    const planCheck = await global.db.query('SELECT id FROM "WorkoutPlan" WHERE id = $1 AND "userId" = $2', [parseInt(planId, 10), req.user.id]);
    if (planCheck.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Plano não encontrado' });
    }
    const orderResult = await global.db.query(
      'SELECT COALESCE(MAX("order"), -1) + 1 AS next FROM "WorkoutGroup" WHERE "workoutPlanId" = $1',
      [parseInt(planId, 10)]
    );
    const result = await global.db.query(
      `INSERT INTO "WorkoutGroup" ("workoutPlanId", name, "order") VALUES ($1, $2, $3) RETURNING *`,
      [parseInt(planId, 10), name.trim(), orderResult.rows[0].next]
    );
    res.status(201).json({ success: true, group: { ...result.rows[0], exercises: [], sessions: [] } });
  } catch (error) {
    next(error);
  }
};

exports.updateWorkoutGroup = async (req, res, next) => {
  try {
    const { groupId } = req.params;
    const { name } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, message: 'Nome do grupo muscular é obrigatório' });
    }
    const result = await global.db.query(
      `UPDATE "WorkoutGroup" wg SET name = $1
       FROM "WorkoutPlan" wp
       WHERE wg.id = $2 AND wg."workoutPlanId" = wp.id AND wp."userId" = $3
       RETURNING wg.*`,
      [name.trim(), parseInt(groupId, 10), req.user.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Grupo muscular não encontrado' });
    }
    res.json({ success: true, group: result.rows[0] });
  } catch (error) {
    next(error);
  }
};

exports.deleteWorkoutGroup = async (req, res, next) => {
  try {
    const { groupId } = req.params;
    const check = await global.db.query(
      `SELECT wg.id FROM "WorkoutGroup" wg JOIN "WorkoutPlan" wp ON wg."workoutPlanId" = wp.id
       WHERE wg.id = $1 AND wp."userId" = $2`,
      [parseInt(groupId, 10), req.user.id]
    );
    if (check.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Grupo muscular não encontrado' });
    }
    await global.db.query('DELETE FROM "WorkoutGroup" WHERE id = $1', [parseInt(groupId, 10)]);
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

exports.getExercisesForGroup = async (req, res, next) => {
  try {
    const { groupId } = req.params;
    const groupCheck = await global.db.query(
      `SELECT wg.id FROM "WorkoutGroup" wg JOIN "WorkoutPlan" wp ON wg."workoutPlanId" = wp.id WHERE wg.id = $1 AND wp."userId" = $2`,
      [parseInt(groupId, 10), req.user.id]
    );
    if (groupCheck.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Grupo muscular não encontrado' });
    }
    const result = await global.db.query(
      `SELECT id, name, sets, reps, weight, "restSeconds", notes, "order" FROM "Exercise" WHERE "workoutGroupId" = $1 ORDER BY "order" ASC`,
      [parseInt(groupId, 10)]
    );
    res.json({ success: true, exercises: result.rows });
  } catch (error) {
    next(error);
  }
};

exports.addExercise = async (req, res, next) => {
  try {
    const { groupId } = req.params;
    const { name, sets, reps, weight, restSeconds, notes } = req.body;
    if (!name || !sets || !reps) {
      return res.status(400).json({ success: false, message: 'Nome, séries e repetições são obrigatórios' });
    }
    const groupCheck = await global.db.query(
      `SELECT wg.id, wg."workoutPlanId" FROM "WorkoutGroup" wg JOIN "WorkoutPlan" wp ON wg."workoutPlanId" = wp.id WHERE wg.id = $1 AND wp."userId" = $2`,
      [parseInt(groupId, 10), req.user.id]
    );
    if (groupCheck.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Grupo muscular não encontrado' });
    }
    const group = groupCheck.rows[0];
    const result = await global.db.query(
      `INSERT INTO "Exercise" ("workoutPlanId", "workoutGroupId", name, sets, reps, weight, "restSeconds", notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
      [group.workoutPlanId, group.id, name, parseInt(sets, 10), reps, weight || null, restSeconds ? parseInt(restSeconds, 10) : null, notes || null]
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
      `SELECT e.id FROM "Exercise" e
       JOIN "WorkoutGroup" wg ON e."workoutGroupId" = wg.id
       JOIN "WorkoutPlan" wp ON wg."workoutPlanId" = wp.id
       WHERE e.id = $1 AND wp."userId" = $2`,
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
