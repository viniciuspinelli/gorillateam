const bcrypt = require('bcrypt');

// ========================
// DASHBOARD
// ========================
exports.getDashboard = async (req, res, next) => {
  try {
    const isAdmin = req.session.user.role === 'admin';
    const currentUserId = req.session.user.id;

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

    res.render('admin/dashboard', {
      title: isAdmin ? 'Painel Admin' : 'Meus Alunos',
      csrfToken: req.csrfToken(),
      isAdmin,
      stats: {
        users: parseInt(usersResult.rows[0].count),
        workoutTemplates: parseInt(workoutTemplatesResult.rows[0].count),
        dietTemplates: parseInt(dietTemplatesResult.rows[0].count),
        sessions: parseInt(sessionsResult.rows[0].count),
      },
    });
  } catch (err) {
    next(err);
  }
};

// ========================
// USER MANAGEMENT
// ========================
exports.getUsers = async (req, res, next) => {
  try {
    const isAdmin = req.session.user.role === 'admin';
    const currentUserId = req.session.user.id;

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
           WHERE "instructorId" = $1
           ORDER BY "createdAt" DESC`,
          [currentUserId]
        );

    res.render('admin/users', {
      title: 'Gerenciar Usuários',
      csrfToken: req.csrfToken(),
      isAdmin,
      users: result.rows,
    });
  } catch (err) {
    next(err);
  }
};

exports.getCreateUser = async (req, res, next) => {
  try {
    const isAdmin = req.session.user.role === 'admin';
    const instructors = isAdmin
      ? (await global.db.query(`SELECT id, username, "fullName" FROM "User" WHERE role = 'instructor' ORDER BY username ASC`)).rows
      : [];
    res.render('admin/user-form', {
      title: 'Novo Usuário',
      csrfToken: req.csrfToken(),
      editUser: null,
      error: null,
      isAdmin,
      instructors,
    });
  } catch (err) {
    next(err);
  }
};

exports.postCreateUser = async (req, res, next) => {
  try {
    const { username, fullName, password, role, email, instructorId } = req.body;
    const isAdmin = req.session.user.role === 'admin';
    const instructors = isAdmin
      ? (await global.db.query(`SELECT id, username, "fullName" FROM "User" WHERE role = 'instructor' ORDER BY username ASC`)).rows
      : [];
    if (!username || !password || !email) {
      return res.render('admin/user-form', {
        title: 'Novo Usuário',
        csrfToken: req.csrfToken(),
        editUser: null,
        error: 'Usuário, senha e e-mail são obrigatórios',
        isAdmin,
        instructors,
      });
    }

    if (username.length < 3 || username.length > 30 || !/^[a-zA-Z0-9_.-]+$/.test(username)) {
      return res.render('admin/user-form', {
        title: 'Novo Usuário',
        csrfToken: req.csrfToken(),
        editUser: null,
        error: 'Nome de usuário inválido (3-30 chars, apenas letras, números, _, . e -)',
        isAdmin,
        instructors,
      });
    }
    const safeUsername = username.trim().toLowerCase();

    const existing = await global.db.query(`SELECT id FROM "User" WHERE LOWER(username) = $1`, [safeUsername]);
    if (existing.rows.length > 0) {
      return res.render('admin/user-form', {
        title: 'Novo Usuário',
        csrfToken: req.csrfToken(),
        editUser: null,
        error: 'Nome de usuário já está em uso',
        isAdmin,
        instructors,
      });
    }
    const hashed = await bcrypt.hash(password, 12);
    let safeRole;
    if (isAdmin) {
      safeRole = ['admin', 'instructor', 'user'].includes(role) ? role : 'user';
    } else {
      safeRole = 'user';
    }
    const safeEmail = email && email.trim() ? email.trim().toLowerCase() : null;
    const safeFullName = fullName && fullName.trim() ? fullName.trim() : null;
    // instructorId: admin pode escolher; instructor auto-atribui a si mesmo
    let safeInstructorId = null;
    if (isAdmin && instructorId && parseInt(instructorId) > 0) {
      safeInstructorId = parseInt(instructorId);
    } else if (!isAdmin) {
      safeInstructorId = req.session.user.id;
    }
    await global.db.query(
      `INSERT INTO "User" (username, "fullName", password, role, email, "instructorId") VALUES ($1, $2, $3, $4, $5, $6)`,
      [safeUsername, safeFullName, hashed, safeRole, safeEmail, safeInstructorId]
    );
    res.redirect('/admin/users');
  } catch (err) {
    next(err);
  }
};

exports.getEditUser = async (req, res, next) => {
  try {
    const isAdmin = req.session.user.role === 'admin';
    const currentUserId = req.session.user.id;
    const result = await global.db.query(
      `SELECT id, username, "fullName", role, email, "instructorId" FROM "User" WHERE id = $1`, [req.params.id]
    );
    if (!result.rows[0]) return res.redirect('/admin/users');
    // Instructor can only edit their own students
    if (!isAdmin && result.rows[0].instructorId !== currentUserId) {
      return res.redirect('/admin/users');
    }
    const instructors = isAdmin
      ? (await global.db.query(`SELECT id, username, "fullName" FROM "User" WHERE role = 'instructor' ORDER BY username ASC`)).rows
      : [];
    res.render('admin/user-form', {
      title: 'Editar Usuário',
      csrfToken: req.csrfToken(),
      editUser: result.rows[0],
      error: null,
      isAdmin,
      instructors,
    });
  } catch (err) {
    next(err);
  }
};

exports.postEditUser = async (req, res, next) => {
  try {
    const { username, fullName, password, role, email, instructorId } = req.body;
    const userId = parseInt(req.params.id);
    const isAdmin = req.session.user.role === 'admin';
    const currentUserId = req.session.user.id;

    // Instructor can only edit their own students
    if (!isAdmin) {
      const check = await global.db.query(`SELECT "instructorId" FROM "User" WHERE id = $1`, [userId]);
      if (!check.rows[0] || check.rows[0].instructorId !== currentUserId) {
        return res.redirect('/admin/users');
      }
    }

    // Prevent demoting yourself
    if (userId === currentUserId && role !== 'admin') {
      const result = await global.db.query(`SELECT id, username, "fullName", role, email, "instructorId" FROM "User" WHERE id = $1`, [userId]);
      const instructors = isAdmin
        ? (await global.db.query(`SELECT id, username, "fullName" FROM "User" WHERE role = 'instructor' ORDER BY username ASC`)).rows
        : [];
      return res.render('admin/user-form', {
        title: 'Editar Usuário',
        csrfToken: req.csrfToken(),
        editUser: result.rows[0],
        error: 'Você não pode remover o seu próprio acesso de admin',
        isAdmin,
        instructors,
      });
    }

    let safeRole;
    if (isAdmin) {
      safeRole = ['admin', 'instructor', 'user'].includes(role) ? role : 'user';
    } else {
      safeRole = 'user';
    }
    const safeEmail = email && email.trim() ? email.trim().toLowerCase() : null;
    const safeFullName = fullName && fullName.trim() ? fullName.trim() : null;
    let safeInstructorId = null;
    if (isAdmin && instructorId && parseInt(instructorId) > 0) {
      safeInstructorId = parseInt(instructorId);
    } else if (!isAdmin) {
      safeInstructorId = currentUserId;
    }

    const safeUsername = username.trim().toLowerCase();

    if (password && password.trim() !== '') {
      const hashed = await bcrypt.hash(password, 12);
      await global.db.query(
        `UPDATE "User" SET username = $1, "fullName" = $2, password = $3, role = $4, email = $5, "instructorId" = $6 WHERE id = $7`,
        [safeUsername, safeFullName, hashed, safeRole, safeEmail, safeInstructorId, userId]
      );
    } else {
      await global.db.query(
        `UPDATE "User" SET username = $1, "fullName" = $2, role = $3, email = $4, "instructorId" = $5 WHERE id = $6`,
        [safeUsername, safeFullName, safeRole, safeEmail, safeInstructorId, userId]
      );
    }
    res.redirect('/admin/users');
  } catch (err) {
    next(err);
  }
};

exports.deleteUser = async (req, res, next) => {
  try {
    const userId = parseInt(req.params.id);
    const isAdmin = req.session.user.role === 'admin';
    const currentUserId = req.session.user.id;
    if (userId === currentUserId) {
      return res.status(400).json({ success: false, message: 'Você não pode deletar sua própria conta' });
    }
    // Instructor can only delete their own students
    if (!isAdmin) {
      const check = await global.db.query(`SELECT "instructorId" FROM "User" WHERE id = $1`, [userId]);
      if (!check.rows[0] || check.rows[0].instructorId !== currentUserId) {
        return res.status(403).json({ success: false, message: 'Sem permissão' });
      }
    }
    await global.db.query(`DELETE FROM "User" WHERE id = $1`, [userId]);
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
};

exports.getUserDetail = async (req, res, next) => {
  try {
    const userId = parseInt(req.params.id);
    const isAdmin = req.session.user.role === 'admin';
    const currentUserId = req.session.user.id;
    const userResult = await global.db.query(`SELECT id, username, "fullName", role, "instructorId" FROM "User" WHERE id = $1`, [userId]);
    if (!userResult.rows[0]) return res.redirect('/admin/users');
    const targetUser = userResult.rows[0];
    // Instructor can only view their own students
    if (!isAdmin && targetUser.instructorId !== currentUserId) {
      return res.redirect('/admin/users');
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

    res.render('admin/user-detail', {
      title: `Usuário: ${targetUser.username}`,
      csrfToken: req.csrfToken(),
      targetUser,
      workouts: workoutsResult.rows,
      diets: dietsResult.rows,
      workoutTemplates: workoutTemplatesResult.rows,
      dietTemplates: dietTemplatesResult.rows,
    });
  } catch (err) {
    next(err);
  }
};

// ========================
// TEMPLATE LIBRARY
// ========================
exports.getTemplates = async (req, res, next) => {
  try {
    const isAdmin = req.session.user.role === 'admin';
    const currentUserId = req.session.user.id;

    const workoutsResult = isAdmin
      ? await global.db.query(
          `SELECT wp.id, wp.name, wp.description, wp."dayOfWeek",
                  COUNT(e.id) AS exercise_count
           FROM "WorkoutPlan" wp
           LEFT JOIN "Exercise" e ON e."workoutPlanId" = wp.id
           WHERE wp."isTemplate" = true
           GROUP BY wp.id
           ORDER BY wp.name ASC`
        )
      : await global.db.query(
          `SELECT wp.id, wp.name, wp.description, wp."dayOfWeek",
                  COUNT(e.id) AS exercise_count
           FROM "WorkoutPlan" wp
           LEFT JOIN "Exercise" e ON e."workoutPlanId" = wp.id
           WHERE wp."isTemplate" = true AND wp."userId" = $1
           GROUP BY wp.id
           ORDER BY wp.name ASC`,
          [currentUserId]
        );

    const dietsResult = isAdmin
      ? await global.db.query(
          `SELECT mp.id, mp.name,
                  COUNT(m.id) AS meal_count
           FROM "MealPlan" mp
           LEFT JOIN "Meal" m ON m."mealPlanId" = mp.id
           WHERE mp."isTemplate" = true
           GROUP BY mp.id
           ORDER BY mp.name ASC`
        )
      : await global.db.query(
          `SELECT mp.id, mp.name,
                  COUNT(m.id) AS meal_count
           FROM "MealPlan" mp
           LEFT JOIN "Meal" m ON m."mealPlanId" = mp.id
           WHERE mp."isTemplate" = true AND mp."userId" = $1
           GROUP BY mp.id
           ORDER BY mp.name ASC`,
          [currentUserId]
        );

    res.render('admin/templates', {
      title: 'Biblioteca de Planos',
      csrfToken: req.csrfToken(),
      workoutTemplates: workoutsResult.rows,
      dietTemplates: dietsResult.rows,
    });
  } catch (err) {
    next(err);
  }
};

exports.createWorkoutTemplate = async (req, res, next) => {
  try {
    const { name, description, dayOfWeek } = req.body;
    const userId = req.session.user.id;
    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, message: 'Nome é obrigatório' });
    }
    const result = await global.db.query(
      `INSERT INTO "WorkoutPlan" ("userId", name, description, "dayOfWeek", "isActive", "isTemplate")
       VALUES ($1, $2, $3, $4, true, true)
       RETURNING id, name, description, "dayOfWeek"`,
      [userId, name.trim(), description?.trim() || null, dayOfWeek || null]
    );
    res.json({ success: true, plan: result.rows[0] });
  } catch (err) {
    next(err);
  }
};

exports.createDietTemplate = async (req, res, next) => {
  try {
    const { name } = req.body;
    const userId = req.session.user.id;
    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, message: 'Nome é obrigatório' });
    }
    const result = await global.db.query(
      `INSERT INTO "MealPlan" ("userId", name, "isActive", "isTemplate", "createdAt")
       VALUES ($1, $2, false, true, NOW())
       RETURNING id, name`,
      [userId, name.trim()]
    );
    res.json({ success: true, plan: result.rows[0] });
  } catch (err) {
    next(err);
  }
};

exports.getDietTemplateMeals = async (req, res, next) => {
  try {
    const id = parseInt(req.params.id);
    const planCheck = await global.db.query(
      `SELECT id FROM "MealPlan" WHERE id = $1 AND "isTemplate" = true`,
      [id]
    );
    if (!planCheck.rows[0]) {
      return res.status(404).json({ success: false, message: 'Template não encontrado' });
    }
    const mealsResult = await global.db.query(
      `SELECT id, name, "time" FROM "Meal" WHERE "mealPlanId" = $1 ORDER BY "order" ASC, id ASC`,
      [id]
    );
    const meals = await Promise.all(mealsResult.rows.map(async meal => {
      const foodsResult = await global.db.query(
        `SELECT id, name, quantity, calories, protein, carbs, fat FROM "MealFood" WHERE "mealId" = $1 ORDER BY "order" ASC, id ASC`,
        [meal.id]
      );
      return { ...meal, foods: foodsResult.rows };
    }));
    res.json({ success: true, meals });
  } catch (err) {
    next(err);
  }
};

exports.deleteWorkoutTemplate = async (req, res, next) => {
  try {
    const id = parseInt(req.params.id);
    const isAdmin = req.session.user.role === 'admin';
    if (!isAdmin) {
      const owner = await global.db.query(
        `SELECT "userId" FROM "WorkoutPlan" WHERE id = $1 AND "isTemplate" = true`, [id]
      );
      if (!owner.rows[0] || owner.rows[0].userId !== req.session.user.id) {
        return res.status(403).json({ success: false, message: 'Acesso negado' });
      }
    }
    await global.db.query(
      `DELETE FROM "WorkoutSession" WHERE "workoutPlanId" = $1`, [id]
    );
    await global.db.query(
      `DELETE FROM "Exercise" WHERE "workoutPlanId" = $1`, [id]
    );
    await global.db.query(
      `DELETE FROM "WorkoutPlan" WHERE id = $1 AND "isTemplate" = true`, [id]
    );
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
};

exports.deleteDietTemplate = async (req, res, next) => {
  try {
    const id = parseInt(req.params.id);
    const isAdmin = req.session.user.role === 'admin';
    if (!isAdmin) {
      const owner = await global.db.query(
        `SELECT "userId" FROM "MealPlan" WHERE id = $1 AND "isTemplate" = true`, [id]
      );
      if (!owner.rows[0] || owner.rows[0].userId !== req.session.user.id) {
        return res.status(403).json({ success: false, message: 'Acesso negado' });
      }
    }
    await global.db.query(
      `DELETE FROM "MealPlan" WHERE id = $1 AND "isTemplate" = true`,
      [id]
    );
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
};

// ========================
// ASSIGN PLANS TO USERS
// ========================
exports.assignWorkout = async (req, res, next) => {
  const client = await global.db.connect();
  try {
    const { templateId } = req.body;
    const userId = parseInt(req.params.id);

    const templateResult = await client.query(
      `SELECT * FROM "WorkoutPlan" WHERE id = $1 AND "isTemplate" = true`,
      [parseInt(templateId)]
    );
    if (!templateResult.rows[0]) {
      return res.status(404).json({ success: false, message: 'Template não encontrado' });
    }
    const template = templateResult.rows[0];

    await client.query('BEGIN');

    // Deep copy the workout plan for the user
    const newPlanResult = await client.query(
      `INSERT INTO "WorkoutPlan" (name, description, "dayOfWeek", "order", "isActive", "isTemplate", "userId")
       VALUES ($1, $2, $3, $4, true, false, $5) RETURNING id`,
      [template.name, template.description, template.dayOfWeek, template.order, userId]
    );
    const newPlanId = newPlanResult.rows[0].id;

    // Copy exercises
    const exercises = await client.query(
      `SELECT * FROM "Exercise" WHERE "workoutPlanId" = $1 ORDER BY "order" ASC`,
      [template.id]
    );
    for (const ex of exercises.rows) {
      await client.query(
        `INSERT INTO "Exercise" ("workoutPlanId", name, sets, reps, weight, "restSeconds", notes, "order")
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [newPlanId, ex.name, ex.sets, ex.reps, ex.weight, ex.restSeconds, ex.notes, ex.order]
      );
    }

    await client.query('COMMIT');
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
    const userId = parseInt(req.params.id);

    const templateResult = await client.query(
      `SELECT * FROM "MealPlan" WHERE id = $1 AND "isTemplate" = true`,
      [parseInt(templateId)]
    );
    if (!templateResult.rows[0]) {
      return res.status(404).json({ success: false, message: 'Template não encontrado' });
    }
    const template = templateResult.rows[0];

    // Deactivate current active plan
    await client.query('BEGIN');
    await client.query(
      `UPDATE "MealPlan" SET "isActive" = false WHERE "userId" = $1`, [userId]
    );

    // Deep copy
    const newPlanResult = await client.query(
      `INSERT INTO "MealPlan" (name, "isActive", "isTemplate", "userId")
       VALUES ($1, true, false, $2) RETURNING id`,
      [template.name, userId]
    );
    const newPlanId = newPlanResult.rows[0].id;

    const meals = await client.query(
      `SELECT * FROM "Meal" WHERE "mealPlanId" = $1 ORDER BY "order" ASC`,
      [template.id]
    );
    for (const meal of meals.rows) {
      const newMealResult = await client.query(
        `INSERT INTO "Meal" ("mealPlanId", name, time, "order") VALUES ($1, $2, $3, $4) RETURNING id`,
        [newPlanId, meal.name, meal.time, meal.order]
      );
      const newMealId = newMealResult.rows[0].id;

      const foods = await client.query(
        `SELECT * FROM "MealFood" WHERE "mealId" = $1 ORDER BY "order" ASC`,
        [meal.id]
      );
      for (const food of foods.rows) {
        await client.query(
          `INSERT INTO "MealFood" ("mealId", name, quantity, calories, protein, carbs, fat, notes, "order")
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
          [newMealId, food.name, food.quantity, food.calories, food.protein, food.carbs, food.fat, food.notes, food.order]
        );
      }
    }

    await client.query('COMMIT');
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
    const userId = parseInt(req.params.userId);
    const planId = parseInt(req.params.planId);
    // Delete sessions first (SessionExercise cascades from WorkoutSession)
    await global.db.query(
      `DELETE FROM "WorkoutSession" WHERE "workoutPlanId" = $1 AND "userId" = $2`,
      [planId, userId]
    );
    await global.db.query(
      `DELETE FROM "Exercise" WHERE "workoutPlanId" = $1`,
      [planId]
    );
    await global.db.query(
      `DELETE FROM "WorkoutPlan" WHERE id = $1 AND "userId" = $2 AND "isTemplate" = false`,
      [planId, userId]
    );
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
};

exports.removeDiet = async (req, res, next) => {
  try {
    const userId = parseInt(req.params.userId);
    const planId = parseInt(req.params.planId);
    await global.db.query(
      `DELETE FROM "MealPlan" WHERE id = $1 AND "userId" = $2 AND "isTemplate" = false`,
      [planId, userId]
    );
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
};
