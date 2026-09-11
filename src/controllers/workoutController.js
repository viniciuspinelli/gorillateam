// Workout Controller - Using global.db (pg Pool)
const { getStorageProvider } = require('../services/storage');

const storageProvider = getStorageProvider();

async function getExerciseOwnedByUser(exerciseId, userId) {
  const ownerCheck = await global.db.query(
    `SELECT e.id, e."workoutPlanId" FROM "Exercise" e
     JOIN "WorkoutPlan" wp ON e."workoutPlanId" = wp.id
     WHERE e.id = $1 AND wp."userId" = $2`,
    [parseInt(exerciseId, 10), userId]
  );

  return ownerCheck.rows[0] || null;
}

/**
 * Get all workout plans with exercises
 */
exports.getWorkouts = async (req, res, next) => {
  try {
    const userId = req.session.user.id;

    // Get all active workout plans for this user
    const plansResult = await global.db.query(
      'SELECT id, name, description, "isActive", "order", "dayOfWeek" FROM "WorkoutPlan" WHERE "isActive" = true AND "userId" = $1 AND "isTemplate" = false ORDER BY "order" ASC',
      [userId]
    );

    // Get total completed sessions for user
    const sessionsResult = await global.db.query(
      'SELECT COUNT(*) as count FROM "WorkoutSession" WHERE "userId" = $1 AND "isCompleted" = true',
      [userId]
    );

    // Get exercises and sessions for each plan
    const plans = await Promise.all(plansResult.rows.map(async (plan) => {
      const exercisesResult = await global.db.query(
        'SELECT id, name, sets, reps, weight, "restSeconds", notes, "order" FROM "Exercise" WHERE "workoutPlanId" = $1 ORDER BY "order" ASC',
        [plan.id]
      );

      const userSessionsResult = await global.db.query(
        'SELECT id FROM "WorkoutSession" WHERE "userId" = $1 AND "workoutPlanId" = $2 AND "isCompleted" = true',
        [userId, plan.id]
      );

      return {
        ...plan,
        exercises: exercisesResult.rows,
        sessions: userSessionsResult.rows
      };
    }));

    const totalSessions = parseInt(sessionsResult.rows[0].count);

    res.render('workouts/index', {
      title: 'Treinos',
      plans,
      totalSessions,
      csrfToken: req.csrfToken(),
    });
  } catch (error) {
    console.error('Error fetching workouts:', error);
    next(error);
  }
};

/**
 * Start a new workout session
 */
exports.startWorkout = async (req, res, next) => {
  try {
    const { id: planId } = req.params;
    const userId = req.session.user.id;

    // Verify workout plan exists and belongs to user
    const planResult = await global.db.query(
      'SELECT id, name, description FROM "WorkoutPlan" WHERE id = $1 AND "userId" = $2',
      [parseInt(planId), userId]
    );

    if (planResult.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Plano não encontrado' });
    }

    const plan = planResult.rows[0];

    // Resume existing in-progress session if any
    const existingSession = await global.db.query(
      `SELECT id FROM "WorkoutSession" WHERE "userId" = $1 AND "workoutPlanId" = $2 AND "isCompleted" = false ORDER BY "startedAt" DESC LIMIT 1`,
      [userId, plan.id]
    );

    if (existingSession.rows.length > 0) {
      return res.redirect(`/workouts/session/${existingSession.rows[0].id}`);
    }

    // Create new workout session
    const sessionResult = await global.db.query(
      `INSERT INTO "WorkoutSession" ("userId", "workoutPlanId", "startedAt", "isCompleted")
       VALUES ($1, $2, NOW(), false)
       RETURNING id`,
      [userId, plan.id]
    );

    const sessionId = sessionResult.rows[0].id;

    // Get exercises for this plan
    const exercisesResult = await global.db.query(
      'SELECT id FROM "Exercise" WHERE "workoutPlanId" = $1 ORDER BY "order" ASC',
      [plan.id]
    );

    // Create session exercises
    for (const exercise of exercisesResult.rows) {
      await global.db.query(
        `INSERT INTO "SessionExercise" ("workoutSessionId", "exerciseId", "isCompleted")
         VALUES ($1, $2, false)`,
        [sessionId, exercise.id]
      );
    }

    res.redirect(`/workouts/session/${sessionId}`);
  } catch (error) {
    console.error('Error starting workout:', error);
    next(error);
  }
};

/**
 * Get active workout session
 */
exports.getActiveWorkout = async (req, res, next) => {
  try {
    const { sessionId } = req.params;
    const userId = req.session.user.id;

    // Get session
    const sessionResult = await global.db.query(
      `SELECT id, "userId", "workoutPlanId", "startedAt", "isCompleted"
       FROM "WorkoutSession" WHERE id = $1`,
      [parseInt(sessionId)]
    );

    if (sessionResult.rows.length === 0 || sessionResult.rows[0].userId !== userId) {
      return res.status(404).render('error', {
        title: 'Erro',
        message: 'Sessão de treino não encontrada',
      });
    }

    const session = sessionResult.rows[0];

    // Get workout plan
    const planResult = await global.db.query(
      'SELECT id, name FROM "WorkoutPlan" WHERE id = $1',
      [session.workoutPlanId]
    );
    session.workoutPlan = planResult.rows[0];

    // Get session exercises with details
    const exercisesResult = await global.db.query(
      `SELECT se.id, se."exerciseId", se."isCompleted", se."completedAt",
              e.name, e.sets, e.reps, e.weight, e."restSeconds", e.notes
       FROM "SessionExercise" se
       JOIN "Exercise" e ON se."exerciseId" = e.id
       WHERE se."workoutSessionId" = $1
       ORDER BY e."order" ASC`,
      [parseInt(sessionId)]
    );

    const exerciseIds = exercisesResult.rows.map((row) => row.exerciseId);
    let imagesByExerciseId = new Map();

    if (exerciseIds.length > 0) {
      const imagesResult = await global.db.query(
        `SELECT id, "exerciseId", "publicUrl", "fileName", "mimeType", "sizeBytes", "sortOrder"
         FROM "WorkoutExerciseImage"
         WHERE "exerciseId" = ANY($1::int[])
         ORDER BY "sortOrder" ASC, id ASC`,
        [exerciseIds]
      );

      imagesByExerciseId = imagesResult.rows.reduce((map, image) => {
        if (!map.has(image.exerciseId)) {
          map.set(image.exerciseId, []);
        }
        map.get(image.exerciseId).push(image);
        return map;
      }, new Map());
    }

    session.sessionExercises = exercisesResult.rows.map(row => ({
      id: row.id,
      exerciseId: row.exerciseId,
      isCompleted: row.isCompleted,
      completedAt: row.completedAt,
      exercise: {
        name: row.name,
        sets: row.sets,
        reps: row.reps,
        weight: row.weight,
        restSeconds: row.restSeconds,
        notes: row.notes,
        images: imagesByExerciseId.get(row.exerciseId) || [],
      }
    }));

    const completedCount = session.sessionExercises.filter(se => se.isCompleted).length;
    const totalCount = session.sessionExercises.length;

    res.render('workouts/active', {
      title: 'Treino Ativo',
      session,
      completedCount,
      totalCount,
      csrfToken: req.csrfToken(),
    });
  } catch (error) {
    console.error('Error fetching active workout:', error);
    next(error);
  }
};

/**
 * Mark exercise as completed
 */
exports.completeExercise = async (req, res, next) => {
  try {
    const { sessionId, exerciseId } = req.params;
    const userId = req.session.user.id;

    // Verify session belongs to user
    const sessionResult = await global.db.query(
      'SELECT "userId" FROM "WorkoutSession" WHERE id = $1',
      [parseInt(sessionId)]
    );

    if (sessionResult.rows.length === 0 || sessionResult.rows[0].userId !== userId) {
      return res.status(403).json({ success: false, message: 'Acesso negado' });
    }

    // Update session exercise
    const updateResult = await global.db.query(
      `UPDATE "SessionExercise"
       SET "isCompleted" = true, "completedAt" = NOW()
       WHERE id = $1
       RETURNING *`,
      [parseInt(exerciseId)]
    );

    res.json({ success: true, exercise: updateResult.rows[0] });
  } catch (error) {
    console.error('Error completing exercise:', error);
    next(error);
  }
};

/**
 * Complete workout session
 */
exports.completeWorkout = async (req, res, next) => {
  try {
    const { sessionId } = req.params;
    const userId = req.session.user.id;
    const { durationMin } = req.body;

    // Verify session belongs to user
    const sessionResult = await global.db.query(
      'SELECT "userId" FROM "WorkoutSession" WHERE id = $1',
      [parseInt(sessionId)]
    );

    if (sessionResult.rows.length === 0 || sessionResult.rows[0].userId !== userId) {
      return res.status(403).json({ success: false, message: 'Acesso negado' });
    }

    // Update session
    const updateResult = await global.db.query(
      `UPDATE "WorkoutSession"
       SET "isCompleted" = true, "completedAt" = NOW(), "durationMin" = $1
       WHERE id = $2
       RETURNING *`,
      [parseInt(durationMin) || 0, parseInt(sessionId)]
    );

    res.json({ success: true, session: updateResult.rows[0] });
  } catch (error) {
    console.error('Error completing workout:', error);
    next(error);
  }
};

/**
 * Get workout history
 */
exports.getHistory = async (req, res, next) => {
  try {
    const userId = req.session.user.id;

    // Get completed sessions
    const sessionsResult = await global.db.query(
      `SELECT ws.id, ws."workoutPlanId", ws."startedAt", ws."completedAt", ws."durationMin", ws."notes",
              wp.name as plan_name
       FROM "WorkoutSession" ws
       JOIN "WorkoutPlan" wp ON ws."workoutPlanId" = wp.id
       WHERE ws."userId" = $1 AND ws."isCompleted" = true
       ORDER BY ws."completedAt" DESC`,
      [userId]
    );

    // Load session exercises for each session
    const sessions = await Promise.all(
      sessionsResult.rows.map(async (row) => {
        const exercisesResult = await global.db.query(
          `SELECT id, "isCompleted" FROM "SessionExercise" WHERE "workoutSessionId" = $1`,
          [row.id]
        );
        
        return {
          id: row.id,
          workoutPlanId: row.workoutPlanId,
          startedAt: row.startedAt,
          completedAt: row.completedAt,
          durationMin: row.durationMin,
          notes: row.notes,
          workoutPlan: { name: row.plan_name },
          sessionExercises: exercisesResult.rows
        };
      })
    );

    // Group sessions by plan name
    const sessionsByPlan = {};
    sessions.forEach(session => {
      const planName = session.workoutPlan.name;
      if (!sessionsByPlan[planName]) {
        sessionsByPlan[planName] = [];
      }
      sessionsByPlan[planName].push(session);
    });

    const totalSessions = sessions.length;

    res.render('workouts/history', {
      title: 'Histórico de Treinos',
      sessions,
      sessionsByPlan,
      totalSessions,
    });
  } catch (error) {
    console.error('Error fetching history:', error);
    next(error);
  }
};

/**
 * Delete a workout session
 */
exports.deleteSession = async (req, res, next) => {
  try {
    const { sessionId } = req.params;
    const userId = req.session.user.id;

    // Verify session belongs to user
    const sessionResult = await global.db.query(
      'SELECT "userId" FROM "WorkoutSession" WHERE id = $1',
      [parseInt(sessionId)]
    );

    if (sessionResult.rows.length === 0 || sessionResult.rows[0].userId !== userId) {
      return res.status(403).json({ success: false, message: 'Acesso negado' });
    }

    // Delete session exercises first
    await global.db.query(
      'DELETE FROM "SessionExercise" WHERE "workoutSessionId" = $1',
      [parseInt(sessionId)]
    );

    // Delete session
    await global.db.query(
      'DELETE FROM "WorkoutSession" WHERE id = $1',
      [parseInt(sessionId)]
    );

    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting session:', error);
    next(error);
  }
};

/**
 * Get all workout plans for management
 */
exports.getWorkoutPlans = async (req, res, next) => {
  try {
    const userId = req.session.user.id;
    const isAdmin = req.session.user.role === 'admin';
    const isInstructor = req.session.user.role === 'instructor';

    if (!isAdmin && !isInstructor) {
      return res.redirect('/workouts');
    }

    const result = await global.db.query(`
      SELECT 
        wp.id, 
        wp.name, 
        wp.description, 
        wp."dayOfWeek",
        wp."order",
        wp."isActive",
        wp."isTemplate",
        COUNT(e.id) as exercise_count
      FROM "WorkoutPlan" wp
      LEFT JOIN "Exercise" e ON wp.id = e."workoutPlanId"
      WHERE wp."userId" = $1
      GROUP BY wp.id
      ORDER BY wp."isTemplate" DESC, wp."order" ASC
    `, [userId]);

    res.render('workouts/plans', {
      title: 'Gerenciar Treinos',
      plans: result.rows,
      isAdmin: isAdmin || isInstructor,
      csrfToken: req.csrfToken(),
    });
  } catch (error) {
    console.error('Error fetching workout plans:', error);
    next(error);
  }
};

/**
 * Create a new workout plan
 */
exports.createWorkoutPlan = async (req, res, next) => {
  try {
    const { name, description, dayOfWeek } = req.body;
    const userId = req.session.user.id;

    if (req.session.user.role !== 'admin' && req.session.user.role !== 'instructor') {
      return res.status(403).json({ success: false, message: 'Apenas administradores e instrutores podem criar planos de treino.' });
    }

    if (!name) {
      return res.status(400).json({ success: false, message: 'Nome é obrigatório' });
    }

    const result = await global.db.query(
      `INSERT INTO "WorkoutPlan" ("userId", name, description, "dayOfWeek", "isActive")
       VALUES ($1, $2, $3, $4, true)
       RETURNING *`,
      [userId, name, description || null, dayOfWeek || null]
    );

    res.json({ success: true, plan: result.rows[0] });
  } catch (error) {
    console.error('Error creating workout plan:', error);
    next(error);
  }
};

/**
 * Update a workout plan
 */
exports.updateWorkoutPlan = async (req, res, next) => {
  try {
    const { planId } = req.params;
    const { name, description, dayOfWeek, isActive } = req.body;

    if (!name) {
      return res.status(400).json({ success: false, message: 'Nome é obrigatório' });
    }

    const userId = req.session.user.id;

    const result = await global.db.query(
      `UPDATE "WorkoutPlan" 
       SET name = $1, 
           description = $2,
           "dayOfWeek" = $3,
           "isActive" = $4
       WHERE id = $5 AND "userId" = $6
       RETURNING *`,
      [name, description || null, dayOfWeek || null, isActive !== undefined ? isActive : true, parseInt(planId), userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Plano não encontrado' });
    }

    res.json({ success: true, plan: result.rows[0] });
  } catch (error) {
    console.error('Error updating workout plan:', error);
    next(error);
  }
};

/**
 * Delete a workout plan
 */
exports.deleteWorkoutPlan = async (req, res, next) => {
  try {
    const { planId } = req.params;
    const userId = req.session.user.id;

    // Verify plan belongs to user before deleting
    const planCheck = await global.db.query(
      'SELECT id FROM "WorkoutPlan" WHERE id = $1 AND "userId" = $2',
      [parseInt(planId), userId]
    );
    if (planCheck.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Plano não encontrado' });
    }

    // Delete sessions first (SessionExercise cascades from WorkoutSession)
    await global.db.query(
      'DELETE FROM "WorkoutSession" WHERE "workoutPlanId" = $1',
      [parseInt(planId)]
    );

    // Delete associated exercises
    await global.db.query(
      'DELETE FROM "Exercise" WHERE "workoutPlanId" = $1',
      [parseInt(planId)]
    );

    // Delete the plan
    await global.db.query(
      'DELETE FROM "WorkoutPlan" WHERE id = $1',
      [parseInt(planId)]
    );

    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting workout plan:', error);
    next(error);
  }
};

/**
 * Add an exercise to a workout plan
 */
exports.addExercise = async (req, res, next) => {
  try {
    const { planId } = req.params;
    const { name, sets, reps, weight, restSeconds, notes } = req.body;
    const userId = req.session.user.id;

    if (!name || !sets || !reps) {
      return res.status(400).json({ 
        success: false, 
        message: 'Nome, séries e repetições são obrigatórios' 
      });
    }

    // Verify plan belongs to user
    const planCheck = await global.db.query(
      'SELECT id FROM "WorkoutPlan" WHERE id = $1 AND "userId" = $2',
      [parseInt(planId), userId]
    );
    if (planCheck.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Plano não encontrado' });
    }

    const result = await global.db.query(
      `INSERT INTO "Exercise" (
        "workoutPlanId", name, sets, reps, weight, "restSeconds", notes
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [
        parseInt(planId), 
        name, 
        parseInt(sets), 
        reps, 
        weight || null, 
        restSeconds ? parseInt(restSeconds) : null,
        notes || null
      ]
    );

    res.json({ success: true, exercise: result.rows[0] });
  } catch (error) {
    console.error('Error adding exercise:', error);
    next(error);
  }
};

/**
 * Update an exercise
 */
exports.updateExercise = async (req, res, next) => {
  try {
    const { exerciseId } = req.params;
    const { name, sets, reps, weight, restSeconds, notes } = req.body;
    const userId = req.session.user.id;

    if (!name || !sets || !reps) {
      return res.status(400).json({ success: false, message: 'Nome, séries e repetições são obrigatórios' });
    }

    // Verify exercise belongs to user's plan
    const ownerCheck = await global.db.query(
      `SELECT e.id FROM "Exercise" e
       JOIN "WorkoutPlan" wp ON e."workoutPlanId" = wp.id
       WHERE e.id = $1 AND wp."userId" = $2`,
      [parseInt(exerciseId), userId]
    );
    if (ownerCheck.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Exercício não encontrado' });
    }

    const result = await global.db.query(
      `UPDATE "Exercise" 
       SET name = $1,
           sets = $2,
           reps = $3,
           weight = $4,
           "restSeconds" = $5,
           notes = $6
       WHERE id = $7
       RETURNING *`,
      [
        name,
        parseInt(sets),
        reps,
        weight || null,
        restSeconds ? parseInt(restSeconds) : null,
        notes || null,
        parseInt(exerciseId)
      ]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Exercício não encontrado' });
    }

    res.json({ success: true, exercise: result.rows[0] });
  } catch (error) {
    console.error('Error updating exercise:', error);
    next(error);
  }
};

/**
 * Delete an exercise
 */
exports.deleteExercise = async (req, res, next) => {
  try {
    const { exerciseId } = req.params;
    const id = parseInt(exerciseId);
    const userId = req.session.user.id;

    // Check if exercise exists and belongs to user's plan
    const checkResult = await global.db.query(
      `SELECT e.id FROM "Exercise" e
       JOIN "WorkoutPlan" wp ON e."workoutPlanId" = wp.id
       WHERE e.id = $1 AND wp."userId" = $2`,
      [id, userId]
    );

    if (checkResult.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Exercício não encontrado' });
    }

    // Remove dependent session records first (no ON DELETE CASCADE on this FK)
    await global.db.query(
      'DELETE FROM "SessionExercise" WHERE "exerciseId" = $1',
      [id]
    );

    // Delete the exercise
    await global.db.query(
      'DELETE FROM "Exercise" WHERE id = $1',
      [id]
    );

    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting exercise:', error);
    next(error);
  }
};

/**
 * Get exercises for a plan (API)
 */
exports.getExercisesForPlan = async (req, res, next) => {
  try {
    const { planId } = req.params;
    const userId = req.session.user.id;

    // Verify plan belongs to user
    const planCheck = await global.db.query(
      'SELECT id FROM "WorkoutPlan" WHERE id = $1 AND "userId" = $2',
      [parseInt(planId), userId]
    );
    if (planCheck.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Plano não encontrado' });
    }

    const result = await global.db.query(
      `SELECT id, name, sets, reps, weight, "restSeconds", notes, "order"
       FROM "Exercise" 
       WHERE "workoutPlanId" = $1
       ORDER BY "order" ASC`,
      [parseInt(planId)]
    );

    res.json({ success: true, exercises: result.rows });
  } catch (error) {
    console.error('Error fetching exercises:', error);
    next(error);
  }
};

/**
 * Upload image for an exercise
 */
exports.uploadExerciseImage = async (req, res, next) => {
  try {
    const { exerciseId } = req.params;
    const userId = req.session.user.id;

    if (!req.file) {
      return res.status(400).json({ success: false, message: 'Nenhuma imagem enviada.' });
    }

    const exercise = await getExerciseOwnedByUser(exerciseId, userId);
    if (!exercise) {
      return res.status(404).json({ success: false, message: 'Exercício não encontrado.' });
    }

    const upload = await storageProvider.uploadBuffer({
      buffer: req.file.buffer,
      mimeType: req.file.mimetype,
      originalName: req.file.originalname,
      folder: `workouts/exercises/${exercise.id}`,
    });

    const inserted = await global.db.query(
      `INSERT INTO "WorkoutExerciseImage"
       ("exerciseId", "createdBy", "storageProvider", "storageKey", "publicUrl", "fileName", "mimeType", "sizeBytes")
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING id, "exerciseId", "publicUrl", "fileName", "mimeType", "sizeBytes", "createdAt"`,
      [
        exercise.id,
        userId,
        process.env.STORAGE_PROVIDER || 'local',
        upload.key,
        upload.publicUrl,
        req.file.originalname,
        req.file.mimetype,
        upload.sizeBytes,
      ]
    );

    return res.status(201).json({
      success: true,
      image: inserted.rows[0],
    });
  } catch (error) {
    console.error('Error uploading exercise image:', error);
    next(error);
  }
};

/**
 * List images for an exercise
 */
exports.listExerciseImages = async (req, res, next) => {
  try {
    const { exerciseId } = req.params;
    const userId = req.session.user.id;

    const exercise = await getExerciseOwnedByUser(exerciseId, userId);
    if (!exercise) {
      return res.status(404).json({ success: false, message: 'Exercício não encontrado.' });
    }

    const imagesResult = await global.db.query(
      `SELECT id, "exerciseId", "publicUrl", "fileName", "mimeType", "sizeBytes", "createdAt", "sortOrder"
       FROM "WorkoutExerciseImage"
       WHERE "exerciseId" = $1
       ORDER BY "sortOrder" ASC, id ASC`,
      [exercise.id]
    );

    return res.json({
      success: true,
      images: imagesResult.rows,
    });
  } catch (error) {
    console.error('Error listing exercise images:', error);
    next(error);
  }
};

/**
 * Delete one exercise image
 */
exports.deleteExerciseImage = async (req, res, next) => {
  try {
    const { exerciseId, imageId } = req.params;
    const userId = req.session.user.id;

    const exercise = await getExerciseOwnedByUser(exerciseId, userId);
    if (!exercise) {
      return res.status(404).json({ success: false, message: 'Exercício não encontrado.' });
    }

    const imageResult = await global.db.query(
      `SELECT id, "storageKey" FROM "WorkoutExerciseImage"
       WHERE id = $1 AND "exerciseId" = $2`,
      [parseInt(imageId, 10), exercise.id]
    );

    if (imageResult.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Imagem não encontrada.' });
    }

    const image = imageResult.rows[0];

    await storageProvider.deleteObject(image.storageKey);

    await global.db.query(
      'DELETE FROM "WorkoutExerciseImage" WHERE id = $1',
      [image.id]
    );

    return res.json({ success: true });
  } catch (error) {
    console.error('Error deleting exercise image:', error);
    next(error);
  }
};

/**
 * Mark/unmark a workout plan as template (admin only)
 */
exports.toggleTemplate = async (req, res, next) => {
  try {
    const { planId } = req.params;
    const userId = req.session.user.id;

    const planCheck = await global.db.query(
      'SELECT id, "isTemplate" FROM "WorkoutPlan" WHERE id = $1 AND "userId" = $2',
      [parseInt(planId), userId]
    );
    if (planCheck.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Plano não encontrado' });
    }

    const newValue = !planCheck.rows[0].isTemplate;
    await global.db.query(
      'UPDATE "WorkoutPlan" SET "isTemplate" = $1 WHERE id = $2',
      [newValue, parseInt(planId)]
    );

    res.json({ success: true, isTemplate: newValue });
  } catch (error) {
    next(error);
  }
};
