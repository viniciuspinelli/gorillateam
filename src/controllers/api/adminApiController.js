// API Admin Controller - versão JSON do painel admin/instrutor (usada pelo app mobile)
const { sendPushToUser } = require('../../services/pushNotifications');

exports.getDashboard = async (req, res, next) => {
  try {
    const isAdmin = req.user.role === 'admin';
    const currentUserId = req.user.id;

    const usersResult = isAdmin
      ? await global.db.query(`SELECT COUNT(*) FROM "User" WHERE role = 'user'`)
      : await global.db.query(`SELECT COUNT(*) FROM "User" WHERE role = 'user' AND "instructorId" = $1`, [currentUserId]);

    const workoutTemplatesResult = isAdmin
      ? await global.db.query(`SELECT COUNT(*) FROM "WorkoutPlan" WHERE "isTemplate" = true`)
      : await global.db.query(`SELECT COUNT(*) FROM "WorkoutPlan" WHERE "isTemplate" = true AND "userId" = $1`, [currentUserId]);
    const dietTemplatesResult = isAdmin
      ? await global.db.query(`SELECT COUNT(*) FROM "MealPlan" WHERE "isTemplate" = true`)
      : await global.db.query(`SELECT COUNT(*) FROM "MealPlan" WHERE "isTemplate" = true AND "userId" = $1`, [currentUserId]);

    const sessionsResult = isAdmin
      ? await global.db.query(`SELECT COUNT(*) FROM "WorkoutSession" WHERE "isCompleted" = true`)
      : await global.db.query(
          `SELECT COUNT(*) FROM "WorkoutSession" ws
           JOIN "User" u ON u.id = ws."userId"
           WHERE ws."isCompleted" = true AND u."instructorId" = $1`,
          [currentUserId]
        );

    res.json({
      success: true,
      isAdmin,
      stats: {
        users: parseInt(usersResult.rows[0].count, 10),
        workoutTemplates: parseInt(workoutTemplatesResult.rows[0].count, 10),
        dietTemplates: parseInt(dietTemplatesResult.rows[0].count, 10),
        sessions: parseInt(sessionsResult.rows[0].count, 10),
      },
    });
  } catch (err) {
    next(err);
  }
};

exports.getUsers = async (req, res, next) => {
  try {
    const isAdmin = req.user.role === 'admin';
    const currentUserId = req.user.id;

    const result = isAdmin
      ? await global.db.query(
          `SELECT u.id, u.username, u."fullName", u.role, u."createdAt",
                  i.username AS "instructorUsername", i."fullName" AS "instructorFullName"
           FROM "User" u
           LEFT JOIN "User" i ON i.id = u."instructorId"
           ORDER BY u."createdAt" DESC`
        )
      : await global.db.query(
          `SELECT id, username, "fullName", role, "createdAt" FROM "User"
           WHERE "instructorId" = $1 OR id = $1
           ORDER BY "createdAt" DESC`,
          [currentUserId]
        );

    res.json({ success: true, isAdmin, users: result.rows });
  } catch (err) {
    next(err);
  }
};

exports.getUserDetail = async (req, res, next) => {
  try {
    const userId = parseInt(req.params.id, 10);
    const isAdmin = req.user.role === 'admin';
    const currentUserId = req.user.id;

    const userResult = await global.db.query(`SELECT id, username, "fullName", role, "instructorId" FROM "User" WHERE id = $1`, [userId]);
    if (!userResult.rows[0]) {
      return res.status(404).json({ success: false, message: 'Usuário não encontrado' });
    }
    const targetUser = userResult.rows[0];

    if (!isAdmin && targetUser.instructorId !== currentUserId && targetUser.id !== currentUserId) {
      return res.status(403).json({ success: false, message: 'Acesso negado' });
    }

    const workoutsResult = await global.db.query(
      `SELECT id, name, "isActive", "dayOfWeek" FROM "WorkoutPlan" WHERE "userId" = $1 AND "isTemplate" = false ORDER BY "order" ASC`,
      [userId]
    );
    const dietsResult = await global.db.query(
      `SELECT id, name, "isActive" FROM "MealPlan" WHERE "userId" = $1 AND "isTemplate" = false ORDER BY "createdAt" DESC`,
      [userId]
    );
    const workoutTemplatesResult = isAdmin
      ? await global.db.query(`SELECT id, name, "dayOfWeek" FROM "WorkoutPlan" WHERE "isTemplate" = true ORDER BY name ASC`)
      : await global.db.query(`SELECT id, name, "dayOfWeek" FROM "WorkoutPlan" WHERE "isTemplate" = true AND "userId" = $1 ORDER BY name ASC`, [currentUserId]);
    const dietTemplatesResult = isAdmin
      ? await global.db.query(`SELECT id, name FROM "MealPlan" WHERE "isTemplate" = true ORDER BY name ASC`)
      : await global.db.query(`SELECT id, name FROM "MealPlan" WHERE "isTemplate" = true AND "userId" = $1 ORDER BY name ASC`, [currentUserId]);

    const sessionsResult = await global.db.query(
      `SELECT ws.id, ws."completedAt", ws."durationMin", ws."notes",
              wp.name as plan_name, wg.name as group_name
       FROM "WorkoutSession" ws
       JOIN "WorkoutPlan" wp ON ws."workoutPlanId" = wp.id
       LEFT JOIN "WorkoutGroup" wg ON ws."workoutGroupId" = wg.id
       WHERE ws."userId" = $1 AND ws."isCompleted" = true
       ORDER BY ws."completedAt" DESC
       LIMIT 20`,
      [userId]
    );
    const workoutSessions = await Promise.all(sessionsResult.rows.map(async (row) => {
      const exercisesResult = await global.db.query(
        `SELECT se.id, se."actualWeight", se."actualReps", e.name, e.sets, e.reps
         FROM "SessionExercise" se JOIN "Exercise" e ON se."exerciseId" = e.id
         WHERE se."workoutSessionId" = $1 ORDER BY e."order" ASC`,
        [row.id]
      );
      return {
        id: row.id,
        completedAt: row.completedAt,
        durationMin: row.durationMin,
        notes: row.notes,
        planName: row.plan_name,
        groupName: row.group_name,
        sessionExercises: exercisesResult.rows,
      };
    }));

    res.json({
      success: true,
      targetUser,
      workouts: workoutsResult.rows,
      diets: dietsResult.rows,
      workoutTemplates: workoutTemplatesResult.rows,
      dietTemplates: dietTemplatesResult.rows,
      workoutSessions,
    });
  } catch (err) {
    next(err);
  }
};

exports.assignWorkout = async (req, res, next) => {
  const client = await global.db.connect();
  try {
    const { templateId } = req.body;
    const userId = parseInt(req.params.id, 10);
    const isAdmin = req.user.role === 'admin';
    const currentUserId = req.user.id;

    if (!isAdmin) {
      const studentCheck = await client.query(`SELECT "instructorId" FROM "User" WHERE id = $1`, [userId]);
      if (!studentCheck.rows[0] || (studentCheck.rows[0].instructorId !== currentUserId && userId !== currentUserId)) {
        return res.status(403).json({ success: false, message: 'Acesso negado' });
      }
    }

    const templateResult = await client.query(
      `SELECT * FROM "WorkoutPlan" WHERE id = $1 AND "isTemplate" = true`,
      [parseInt(templateId, 10)]
    );
    if (!templateResult.rows[0]) {
      return res.status(404).json({ success: false, message: 'Template não encontrado' });
    }
    const template = templateResult.rows[0];
    if (!isAdmin && template.userId !== currentUserId) {
      return res.status(403).json({ success: false, message: 'Acesso negado' });
    }

    const existingResult = await client.query(
      `SELECT id FROM "WorkoutPlan" WHERE "userId" = $1 AND "isTemplate" = false AND name = $2`,
      [userId, template.name]
    );
    if (existingResult.rows[0]) {
      return res.status(409).json({ success: false, message: 'Este aluno já possui esse plano de treino atribuído.' });
    }

    await client.query('BEGIN');
    const newPlanResult = await client.query(
      `INSERT INTO "WorkoutPlan" (name, description, "dayOfWeek", "order", "isActive", "isTemplate", "userId")
       VALUES ($1, $2, $3, $4, true, false, $5) RETURNING id`,
      [template.name, template.description, template.dayOfWeek, template.order, userId]
    );
    const newPlanId = newPlanResult.rows[0].id;

    // Deep copy every muscle-group session and its exercises, so the whole
    // program (all its groups) goes to the student at once.
    const groups = await client.query(
      `SELECT * FROM "WorkoutGroup" WHERE "workoutPlanId" = $1 ORDER BY "order" ASC`,
      [template.id]
    );
    for (const group of groups.rows) {
      const newGroupResult = await client.query(
        `INSERT INTO "WorkoutGroup" ("workoutPlanId", name, "order") VALUES ($1, $2, $3) RETURNING id`,
        [newPlanId, group.name, group.order]
      );
      const newGroupId = newGroupResult.rows[0].id;

      const exercises = await client.query(
        `SELECT * FROM "Exercise" WHERE "workoutGroupId" = $1 ORDER BY "order" ASC`,
        [group.id]
      );
      for (const ex of exercises.rows) {
        await client.query(
          `INSERT INTO "Exercise" ("workoutPlanId", "workoutGroupId", name, sets, reps, weight, "restSeconds", notes, "order")
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
          [newPlanId, newGroupId, ex.name, ex.sets, ex.reps, ex.weight, ex.restSeconds, ex.notes, ex.order]
        );
      }
    }

    await client.query('COMMIT');
    sendPushToUser(userId, { title: 'Novo treino disponível', body: `${template.name} foi atribuído a você.`, data: { type: 'workout_assigned', planId: newPlanId } });
    res.json({ success: true });
  } catch (err) {
    await client.query('ROLLBACK');
    next(err);
  } finally {
    client.release();
  }
};

exports.assignDiet = async (req, res, next) => {
  const client = await global.db.connect();
  try {
    const { templateId } = req.body;
    const userId = parseInt(req.params.id, 10);
    const isAdmin = req.user.role === 'admin';
    const currentUserId = req.user.id;

    if (!isAdmin) {
      const studentCheck = await client.query(`SELECT "instructorId" FROM "User" WHERE id = $1`, [userId]);
      if (!studentCheck.rows[0] || (studentCheck.rows[0].instructorId !== currentUserId && userId !== currentUserId)) {
        return res.status(403).json({ success: false, message: 'Acesso negado' });
      }
    }

    const templateResult = await client.query(
      `SELECT * FROM "MealPlan" WHERE id = $1 AND "isTemplate" = true`,
      [parseInt(templateId, 10)]
    );
    if (!templateResult.rows[0]) {
      return res.status(404).json({ success: false, message: 'Template não encontrado' });
    }
    const template = templateResult.rows[0];
    if (!isAdmin && template.userId !== currentUserId) {
      return res.status(403).json({ success: false, message: 'Acesso negado' });
    }

    const existingResult = await client.query(
      `SELECT id FROM "MealPlan" WHERE "userId" = $1 AND "isTemplate" = false AND name = $2`,
      [userId, template.name]
    );
    if (existingResult.rows[0]) {
      return res.status(409).json({ success: false, message: 'Este aluno já possui essa dieta atribuída.' });
    }

    await client.query('BEGIN');
    await client.query(`UPDATE "MealPlan" SET "isActive" = false WHERE "userId" = $1`, [userId]);

    const newPlanResult = await client.query(
      `INSERT INTO "MealPlan" (name, "isActive", "isTemplate", "userId")
       VALUES ($1, true, false, $2) RETURNING id`,
      [template.name, userId]
    );
    const newPlanId = newPlanResult.rows[0].id;

    const meals = await client.query(`SELECT * FROM "Meal" WHERE "mealPlanId" = $1 ORDER BY "order" ASC`, [template.id]);
    for (const meal of meals.rows) {
      const newMealResult = await client.query(
        `INSERT INTO "Meal" ("mealPlanId", name, time, "order") VALUES ($1, $2, $3, $4) RETURNING id`,
        [newPlanId, meal.name, meal.time, meal.order]
      );
      const newMealId = newMealResult.rows[0].id;

      const foods = await client.query(`SELECT * FROM "MealFood" WHERE "mealId" = $1 ORDER BY "order" ASC`, [meal.id]);
      for (const food of foods.rows) {
        const newFoodResult = await client.query(
          `INSERT INTO "MealFood" ("mealId", name, quantity, calories, protein, carbs, fat, notes, "order")
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING id`,
          [newMealId, food.name, food.quantity, food.calories, food.protein, food.carbs, food.fat, food.notes, food.order]
        );
        const newFoodId = newFoodResult.rows[0].id;

        const options = await client.query(`SELECT * FROM "MealFoodOption" WHERE "mealFoodId" = $1 ORDER BY "order" ASC`, [food.id]);
        for (const opt of options.rows) {
          await client.query(
            `INSERT INTO "MealFoodOption" ("mealFoodId", name, quantity, calories, protein, carbs, fat, "order")
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
            [newFoodId, opt.name, opt.quantity, opt.calories, opt.protein, opt.carbs, opt.fat, opt.order]
          );
        }
      }
    }

    await client.query('COMMIT');
    sendPushToUser(userId, { title: 'Nova dieta disponível', body: `${template.name} foi atribuída a você.`, data: { type: 'diet_assigned', planId: newPlanId } });
    res.json({ success: true });
  } catch (err) {
    await client.query('ROLLBACK');
    next(err);
  } finally {
    client.release();
  }
};

exports.removeWorkout = async (req, res, next) => {
  try {
    const userId = parseInt(req.params.userId, 10);
    const planId = parseInt(req.params.planId, 10);
    if (req.user.role !== 'admin') {
      const studentCheck = await global.db.query(`SELECT "instructorId" FROM "User" WHERE id = $1`, [userId]);
      if (!studentCheck.rows[0] || (studentCheck.rows[0].instructorId !== req.user.id && userId !== req.user.id)) {
        return res.status(403).json({ success: false, message: 'Acesso negado' });
      }
    }
    await global.db.query(`DELETE FROM "WorkoutSession" WHERE "workoutPlanId" = $1 AND "userId" = $2`, [planId, userId]);
    await global.db.query(`DELETE FROM "Exercise" WHERE "workoutPlanId" = $1`, [planId]);
    await global.db.query(`DELETE FROM "WorkoutPlan" WHERE id = $1 AND "userId" = $2 AND "isTemplate" = false`, [planId, userId]);
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
};

exports.removeDiet = async (req, res, next) => {
  try {
    const userId = parseInt(req.params.userId, 10);
    const planId = parseInt(req.params.planId, 10);
    if (req.user.role !== 'admin') {
      const studentCheck = await global.db.query(`SELECT "instructorId" FROM "User" WHERE id = $1`, [userId]);
      if (!studentCheck.rows[0] || (studentCheck.rows[0].instructorId !== req.user.id && userId !== req.user.id)) {
        return res.status(403).json({ success: false, message: 'Acesso negado' });
      }
    }
    await global.db.query(`DELETE FROM "MealPlan" WHERE id = $1 AND "userId" = $2 AND "isTemplate" = false`, [planId, userId]);
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
};
