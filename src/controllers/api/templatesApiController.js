// API Templates Controller - biblioteca de treinos/dietas (admin/instrutor)

// Confirma que a refeição pertence a um MealPlan-template, e que o usuário atual
// tem permissão sobre esse template (admin, ou o próprio instrutor que o criou).
async function assertMealTemplateAccess(mealId, user) {
  const result = await global.db.query(
    `SELECT mp."userId", mp."isTemplate"
     FROM "Meal" m JOIN "MealPlan" mp ON mp.id = m."mealPlanId"
     WHERE m.id = $1`,
    [mealId]
  );
  const row = result.rows[0];
  if (!row || !row.isTemplate) return false;
  return user.role === 'admin' || row.userId === user.id;
}

// Mesma verificação, mas a partir de um MealFood.
async function assertFoodTemplateAccess(foodId, user) {
  const result = await global.db.query(
    `SELECT mp."userId", mp."isTemplate"
     FROM "MealFood" mf
     JOIN "Meal" m ON m.id = mf."mealId"
     JOIN "MealPlan" mp ON mp.id = m."mealPlanId"
     WHERE mf.id = $1`,
    [foodId]
  );
  const row = result.rows[0];
  if (!row || !row.isTemplate) return false;
  return user.role === 'admin' || row.userId === user.id;
}

exports.getTemplates = async (req, res, next) => {
  try {
    const isAdmin = req.user.role === 'admin';
    const currentUserId = req.user.id;

    const workoutsResult = isAdmin
      ? await global.db.query(
          `SELECT wp.id, wp.name, wp.description, wp."dayOfWeek", COUNT(e.id) AS exercise_count,
                  (SELECT COUNT(*) FROM "WorkoutGroup" wg WHERE wg."workoutPlanId" = wp.id) AS group_count
           FROM "WorkoutPlan" wp LEFT JOIN "Exercise" e ON e."workoutPlanId" = wp.id
           WHERE wp."isTemplate" = true GROUP BY wp.id ORDER BY wp.name ASC`
        )
      : await global.db.query(
          `SELECT wp.id, wp.name, wp.description, wp."dayOfWeek", COUNT(e.id) AS exercise_count,
                  (SELECT COUNT(*) FROM "WorkoutGroup" wg WHERE wg."workoutPlanId" = wp.id) AS group_count
           FROM "WorkoutPlan" wp LEFT JOIN "Exercise" e ON e."workoutPlanId" = wp.id
           WHERE wp."isTemplate" = true AND wp."userId" = $1 GROUP BY wp.id ORDER BY wp.name ASC`,
          [currentUserId]
        );

    const dietsResult = isAdmin
      ? await global.db.query(
          `SELECT mp.id, mp.name, COUNT(m.id) AS meal_count
           FROM "MealPlan" mp LEFT JOIN "Meal" m ON m."mealPlanId" = mp.id
           WHERE mp."isTemplate" = true GROUP BY mp.id ORDER BY mp.name ASC`
        )
      : await global.db.query(
          `SELECT mp.id, mp.name, COUNT(m.id) AS meal_count
           FROM "MealPlan" mp LEFT JOIN "Meal" m ON m."mealPlanId" = mp.id
           WHERE mp."isTemplate" = true AND mp."userId" = $1 GROUP BY mp.id ORDER BY mp.name ASC`,
          [currentUserId]
        );

    res.json({ success: true, workoutTemplates: workoutsResult.rows, dietTemplates: dietsResult.rows });
  } catch (err) {
    next(err);
  }
};

exports.createWorkoutTemplate = async (req, res, next) => {
  try {
    const { name, description, dayOfWeek } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, message: 'Nome é obrigatório' });
    }
    const result = await global.db.query(
      `INSERT INTO "WorkoutPlan" ("userId", name, description, "dayOfWeek", "isActive", "isTemplate")
       VALUES ($1, $2, $3, $4, true, true)
       RETURNING id, name, description, "dayOfWeek"`,
      [req.user.id, name.trim(), description?.trim() || null, dayOfWeek || null]
    );
    res.status(201).json({ success: true, plan: result.rows[0] });
  } catch (err) {
    next(err);
  }
};

exports.createDietTemplate = async (req, res, next) => {
  try {
    const { name } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, message: 'Nome é obrigatório' });
    }
    const result = await global.db.query(
      `INSERT INTO "MealPlan" ("userId", name, "isActive", "isTemplate", "createdAt")
       VALUES ($1, $2, false, true, NOW())
       RETURNING id, name`,
      [req.user.id, name.trim()]
    );
    res.status(201).json({ success: true, plan: result.rows[0] });
  } catch (err) {
    next(err);
  }
};

exports.getDietTemplateMeals = async (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);
    const planCheck = await global.db.query(`SELECT id FROM "MealPlan" WHERE id = $1 AND "isTemplate" = true`, [id]);
    if (!planCheck.rows[0]) {
      return res.status(404).json({ success: false, message: 'Template não encontrado' });
    }
    const mealsResult = await global.db.query(
      `SELECT id, name, "time" FROM "Meal" WHERE "mealPlanId" = $1 ORDER BY "order" ASC, id ASC`,
      [id]
    );
    const meals = await Promise.all(mealsResult.rows.map(async (meal) => {
      const foodsResult = await global.db.query(
        `SELECT id, name, quantity, calories, protein, carbs, fat FROM "MealFood" WHERE "mealId" = $1 ORDER BY "order" ASC, id ASC`,
        [meal.id]
      );
      const foods = await Promise.all(foodsResult.rows.map(async (food) => {
        const optionsResult = await global.db.query(
          `SELECT id, name, quantity, calories, protein, carbs, fat FROM "MealFoodOption" WHERE "mealFoodId" = $1 ORDER BY "order" ASC`,
          [food.id]
        );
        return { ...food, options: optionsResult.rows };
      }));
      return { ...meal, foods };
    }));
    res.json({ success: true, meals });
  } catch (err) {
    next(err);
  }
};

exports.addMeal = async (req, res, next) => {
  try {
    const mealPlanId = parseInt(req.params.id, 10);
    const { name, time } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, message: 'Nome da refeição é obrigatório' });
    }
    const planCheck = await global.db.query(`SELECT "userId" FROM "MealPlan" WHERE id = $1 AND "isTemplate" = true`, [mealPlanId]);
    if (!planCheck.rows[0]) {
      return res.status(404).json({ success: false, message: 'Template não encontrado' });
    }
    if (req.user.role !== 'admin' && planCheck.rows[0].userId !== req.user.id) {
      return res.status(403).json({ success: false, message: 'Acesso negado' });
    }
    const result = await global.db.query(
      `INSERT INTO "Meal" ("mealPlanId", name, "time", "order")
       VALUES ($1, $2, $3, (SELECT COALESCE(MAX("order"), 0) + 1 FROM "Meal" WHERE "mealPlanId" = $1))
       RETURNING id, name, "time"`,
      [mealPlanId, name.trim(), time || null]
    );
    res.status(201).json({ success: true, meal: { ...result.rows[0], foods: [] } });
  } catch (err) {
    next(err);
  }
};

exports.deleteMeal = async (req, res, next) => {
  try {
    const mealId = parseInt(req.params.mealId, 10);
    if (!(await assertMealTemplateAccess(mealId, req.user))) {
      return res.status(404).json({ success: false, message: 'Refeição não encontrada' });
    }
    await global.db.query(`DELETE FROM "MealFood" WHERE "mealId" = $1`, [mealId]);
    await global.db.query(`DELETE FROM "Meal" WHERE id = $1`, [mealId]);
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
};

exports.addFood = async (req, res, next) => {
  try {
    const mealId = parseInt(req.params.mealId, 10);
    if (!(await assertMealTemplateAccess(mealId, req.user))) {
      return res.status(404).json({ success: false, message: 'Refeição não encontrada' });
    }
    const { name, quantity, calories, protein, carbs, fat } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, message: 'Nome do alimento é obrigatório' });
    }
    const result = await global.db.query(
      `INSERT INTO "MealFood" ("mealId", name, quantity, calories, protein, carbs, fat, "order")
       VALUES ($1, $2, $3, $4, $5, $6, $7, (SELECT COALESCE(MAX("order"), 0) + 1 FROM "MealFood" WHERE "mealId" = $1))
       RETURNING id, name, quantity, calories, protein, carbs, fat`,
      [mealId, name.trim(), quantity || null, calories || 0, protein || 0, carbs || 0, fat || 0]
    );
    res.status(201).json({ success: true, food: result.rows[0] });
  } catch (err) {
    next(err);
  }
};

exports.updateFood = async (req, res, next) => {
  try {
    const foodId = parseInt(req.params.foodId, 10);
    if (!(await assertFoodTemplateAccess(foodId, req.user))) {
      return res.status(404).json({ success: false, message: 'Alimento não encontrado' });
    }
    const { name, quantity, calories, protein, carbs, fat, notes } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, message: 'Nome do alimento é obrigatório' });
    }
    const result = await global.db.query(
      `UPDATE "MealFood" SET name = $1, quantity = $2, calories = $3, protein = $4, carbs = $5, fat = $6, notes = $7
       WHERE id = $8 RETURNING id, name, quantity, calories, protein, carbs, fat, notes`,
      [name.trim(), quantity || null, calories || 0, protein || 0, carbs || 0, fat || 0, notes?.trim() || null, foodId]
    );
    res.json({ success: true, food: result.rows[0] });
  } catch (err) {
    next(err);
  }
};

exports.deleteFood = async (req, res, next) => {
  try {
    const foodId = parseInt(req.params.foodId, 10);
    if (!(await assertFoodTemplateAccess(foodId, req.user))) {
      return res.status(404).json({ success: false, message: 'Alimento não encontrado' });
    }
    await global.db.query(`DELETE FROM "MealFood" WHERE id = $1`, [foodId]);
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
};

exports.addFoodOption = async (req, res, next) => {
  try {
    const foodId = parseInt(req.params.foodId, 10);
    if (!(await assertFoodTemplateAccess(foodId, req.user))) {
      return res.status(404).json({ success: false, message: 'Alimento não encontrado' });
    }
    const { name, quantity, calories, protein, carbs, fat } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, message: 'Nome do substituto é obrigatório' });
    }
    const orderResult = await global.db.query(`SELECT COALESCE(MAX("order"), -1) + 1 AS next FROM "MealFoodOption" WHERE "mealFoodId" = $1`, [foodId]);
    const result = await global.db.query(
      `INSERT INTO "MealFoodOption" ("mealFoodId", name, quantity, calories, protein, carbs, fat, "order")
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
      [foodId, name.trim(), quantity || null, calories || null, protein || null, carbs || null, fat || null, orderResult.rows[0].next]
    );
    res.status(201).json({ success: true, option: result.rows[0] });
  } catch (err) {
    next(err);
  }
};

exports.deleteFoodOption = async (req, res, next) => {
  try {
    const optionId = parseInt(req.params.optionId, 10);
    const result = await global.db.query(
      `SELECT mp."userId", mp."isTemplate"
       FROM "MealFoodOption" o
       JOIN "MealFood" mf ON o."mealFoodId" = mf.id
       JOIN "Meal" m ON m.id = mf."mealId"
       JOIN "MealPlan" mp ON mp.id = m."mealPlanId"
       WHERE o.id = $1`,
      [optionId]
    );
    const row = result.rows[0];
    const hasAccess = row && row.isTemplate && (req.user.role === 'admin' || row.userId === req.user.id);
    if (!hasAccess) {
      return res.status(404).json({ success: false, message: 'Substituto não encontrado' });
    }
    await global.db.query(`DELETE FROM "MealFoodOption" WHERE id = $1`, [optionId]);
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
};

exports.deleteWorkoutTemplate = async (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (req.user.role !== 'admin') {
      const owner = await global.db.query(`SELECT "userId" FROM "WorkoutPlan" WHERE id = $1 AND "isTemplate" = true`, [id]);
      if (!owner.rows[0] || owner.rows[0].userId !== req.user.id) {
        return res.status(403).json({ success: false, message: 'Acesso negado' });
      }
    }
    await global.db.query(`DELETE FROM "WorkoutSession" WHERE "workoutPlanId" = $1`, [id]);
    await global.db.query(`DELETE FROM "Exercise" WHERE "workoutPlanId" = $1`, [id]);
    await global.db.query(`DELETE FROM "WorkoutPlan" WHERE id = $1 AND "isTemplate" = true`, [id]);
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
};

exports.deleteDietTemplate = async (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (req.user.role !== 'admin') {
      const owner = await global.db.query(`SELECT "userId" FROM "MealPlan" WHERE id = $1 AND "isTemplate" = true`, [id]);
      if (!owner.rows[0] || owner.rows[0].userId !== req.user.id) {
        return res.status(403).json({ success: false, message: 'Acesso negado' });
      }
    }
    await global.db.query(`DELETE FROM "MealPlan" WHERE id = $1 AND "isTemplate" = true`, [id]);
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
};
