// API Diet Controller - versão JSON da dieta ativa (usada pelo app mobile)
const dietController = require('../dietController');

exports.getDiet = async (req, res, next) => {
  try {
    const userId = req.user.id;

    let activePlanResult = await global.db.query(
      `SELECT id, name, "isActive", "isTemplate" FROM "MealPlan" WHERE "isActive" = true AND "userId" = $1 AND "isTemplate" = false LIMIT 1`,
      [userId]
    );
    let activePlan = activePlanResult.rows[0] || null;

    if (!activePlan) {
      const firstResult = await global.db.query(
        `SELECT id, name, "isActive", "isTemplate" FROM "MealPlan" WHERE "userId" = $1 AND "isTemplate" = false LIMIT 1`,
        [userId]
      );
      activePlan = firstResult.rows[0] || null;
    }

    const allPlansResult = await global.db.query(
      `SELECT id, name, "isActive", "isTemplate" FROM "MealPlan" WHERE "userId" = $1 AND "isTemplate" = false ORDER BY "createdAt" DESC`,
      [userId]
    );
    const allPlans = allPlansResult.rows;

    let totals = { totalCalories: 0, totalProtein: 0, totalCarbs: 0, totalFat: 0 };

    if (activePlan) {
      const mealsResult = await global.db.query(
        `SELECT id, name, "time" FROM "Meal" WHERE "mealPlanId" = $1 ORDER BY "order" ASC`,
        [activePlan.id]
      );
      const meals = mealsResult.rows;

      for (const meal of meals) {
        const foodsResult = await global.db.query(
          `SELECT id, name, quantity, notes, calories, protein, carbs, fat FROM "MealFood" WHERE "mealId" = $1 ORDER BY "order" ASC`,
          [meal.id]
        );

        const foods = foodsResult.rows.map((food) => ({
          id: food.id,
          name: food.name,
          quantity: food.quantity,
          notes: food.notes,
          calories: parseFloat(food.calories || 0),
          protein: parseFloat(food.protein || 0),
          carbs: parseFloat(food.carbs || 0),
          fat: parseFloat(food.fat || 0),
        }));

        for (const food of foods) {
          totals.totalCalories += food.calories || 0;
          totals.totalProtein += food.protein || 0;
          totals.totalCarbs += food.carbs || 0;
          totals.totalFat += food.fat || 0;
        }

        meal.foods = foods;
      }

      activePlan.meals = meals;
    }

    totals = {
      totalCalories: parseFloat(totals.totalCalories || 0),
      totalProtein: parseFloat(totals.totalProtein || 0),
      totalCarbs: parseFloat(totals.totalCarbs || 0),
      totalFat: parseFloat(totals.totalFat || 0),
    };

    res.json({ success: true, activePlan, allPlans, totals });
  } catch (error) {
    next(error);
  }
};

exports.createPlan = async (req, res, next) => {
  try {
    const { name } = req.body;
    if (!name || !name.trim()) return res.status(400).json({ success: false, message: 'Nome é obrigatório' });
    const result = await global.db.query(
      `INSERT INTO "MealPlan" ("userId", name, "isActive", "createdAt") VALUES ($1, $2, false, NOW()) RETURNING id, name, "isActive"`,
      [req.user.id, name.trim()]
    );
    res.status(201).json({ success: true, plan: result.rows[0] });
  } catch (error) { next(error); }
};

exports.activatePlan = async (req, res, next) => {
  try {
    const planId = Number.parseInt(req.params.planId, 10);
    const owner = await global.db.query(`SELECT id FROM "MealPlan" WHERE id = $1 AND "userId" = $2 AND "isTemplate" = false`, [planId, req.user.id]);
    if (!owner.rows[0]) return res.status(404).json({ success: false, message: 'Plano não encontrado' });
    await global.db.query(`UPDATE "MealPlan" SET "isActive" = false WHERE "userId" = $1 AND "isActive" = true`, [req.user.id]);
    const result = await global.db.query(`UPDATE "MealPlan" SET "isActive" = true WHERE id = $1 RETURNING *`, [planId]);
    res.json({ success: true, plan: result.rows[0] });
  } catch (error) { next(error); }
};

exports.updatePlanName = async (req, res, next) => {
  try {
    const { name } = req.body;
    if (!name || !name.trim()) return res.status(400).json({ success: false, message: 'Nome é obrigatório' });
    const result = await global.db.query(
      `UPDATE "MealPlan" SET name = $1 WHERE id = $2 AND "userId" = $3 AND "isTemplate" = false RETURNING *`,
      [name.trim(), Number.parseInt(req.params.planId, 10), req.user.id]
    );
    if (!result.rows[0]) return res.status(404).json({ success: false, message: 'Plano não encontrado' });
    res.json({ success: true, plan: result.rows[0] });
  } catch (error) { next(error); }
};

exports.toggleTemplate = async (req, res, next) => {
  try {
    const planId = Number.parseInt(req.params.planId, 10);
    const result = await global.db.query(
      `UPDATE "MealPlan" SET "isTemplate" = NOT "isTemplate" WHERE id = $1 AND "userId" = $2 RETURNING id, name, "isTemplate"`,
      [planId, req.user.id]
    );
    if (!result.rows[0]) return res.status(404).json({ success: false, message: 'Plano não encontrado' });
    res.json({ success: true, plan: result.rows[0] });
  } catch (error) { next(error); }
};

exports.addMeal = async (req, res, next) => {
  try {
    const { mealPlanId, name, time } = req.body;
    if (!name || !name.trim()) return res.status(400).json({ success: false, message: 'Nome é obrigatório' });
    const owner = await global.db.query(`SELECT id FROM "MealPlan" WHERE id = $1 AND "userId" = $2 AND "isTemplate" = false`, [Number.parseInt(mealPlanId, 10), req.user.id]);
    if (!owner.rows[0]) return res.status(404).json({ success: false, message: 'Plano não encontrado' });
    const result = await global.db.query(
      `INSERT INTO "Meal" ("mealPlanId", name, "time", "order") VALUES ($1, $2, $3, (SELECT COALESCE(MAX("order"), 0) + 1 FROM "Meal" WHERE "mealPlanId" = $1)) RETURNING *`,
      [Number.parseInt(mealPlanId, 10), name.trim(), typeof time === 'string' ? time.trim() || null : null]
    );
    res.status(201).json({ success: true, meal: result.rows[0] });
  } catch (error) { next(error); }
};

exports.deleteMeal = async (req, res, next) => {
  try {
    const mealId = Number.parseInt(req.params.mealId, 10);
    const owner = await global.db.query(`SELECT m.id FROM "Meal" m JOIN "MealPlan" mp ON m."mealPlanId" = mp.id WHERE m.id = $1 AND mp."userId" = $2 AND mp."isTemplate" = false`, [mealId, req.user.id]);
    if (!owner.rows[0]) return res.status(404).json({ success: false, message: 'Refeição não encontrada' });
    await global.db.query(`DELETE FROM "MealFood" WHERE "mealId" = $1`, [mealId]);
    await global.db.query(`DELETE FROM "Meal" WHERE id = $1`, [mealId]);
    res.json({ success: true });
  } catch (error) { next(error); }
};

exports.addFood = async (req, res, next) => {
  try {
    const { mealId, name, quantity, calories, protein, carbs, fat, notes } = req.body;
    if (!name || name.trim().length < 2) return res.status(400).json({ success: false, message: 'Nome do alimento inválido' });
    const owner = await global.db.query(`SELECT m.id FROM "Meal" m JOIN "MealPlan" mp ON m."mealPlanId" = mp.id WHERE m.id = $1 AND mp."userId" = $2 AND mp."isTemplate" = false`, [Number.parseInt(mealId, 10), req.user.id]);
    if (!owner.rows[0]) return res.status(404).json({ success: false, message: 'Refeição não encontrada' });
    const numbers = ['calories', 'protein', 'carbs', 'fat'].map((field) => {
      const value = req.body[field];
      return value === '' || value === null || value === undefined ? null : Number(value);
    });
    if (numbers.some((value) => value !== null && (!Number.isFinite(value) || value < 0))) return res.status(400).json({ success: false, message: 'Valores nutricionais inválidos' });
    if (numbers.every((value) => value === null)) return res.status(400).json({ success: false, message: 'Adicione pelo menos uma informação nutricional' });
    const result = await global.db.query(
      `INSERT INTO "MealFood" ("mealId", name, quantity, calories, protein, carbs, fat, notes, "order") VALUES ($1, $2, $3, $4, $5, $6, $7, $8, (SELECT COALESCE(MAX("order"), 0) + 1 FROM "MealFood" WHERE "mealId" = $1)) RETURNING *`,
      [Number.parseInt(mealId, 10), name.trim(), quantity?.trim() || null, ...numbers, notes?.trim() || null]
    );
    res.status(201).json({ success: true, food: result.rows[0] });
  } catch (error) { next(error); }
};

exports.deleteFood = async (req, res, next) => {
  try {
    const foodId = Number.parseInt(req.params.foodId, 10);
    const owner = await global.db.query(`SELECT mf.id FROM "MealFood" mf JOIN "Meal" m ON mf."mealId" = m.id JOIN "MealPlan" mp ON m."mealPlanId" = mp.id WHERE mf.id = $1 AND mp."userId" = $2 AND mp."isTemplate" = false`, [foodId, req.user.id]);
    if (!owner.rows[0]) return res.status(404).json({ success: false, message: 'Alimento não encontrado' });
    await global.db.query(`DELETE FROM "MealFood" WHERE id = $1`, [foodId]);
    res.json({ success: true });
  } catch (error) { next(error); }
};

exports.searchFood = (req, res, next) => {
  req.session = { user: req.user };
  return dietController.searchFood(req, res, next);
};
