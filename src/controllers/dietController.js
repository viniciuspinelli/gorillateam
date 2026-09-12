// Diet Controller - Using global.db (pg Pool)

/**
 * Get diet page with active meal plan
 */
exports.getDiet = async (req, res, next) => {
  try {
    const userId = req.session.user.id;

    // Get active meal plan for this user
    let activePlanResult = await global.db.query(
      `SELECT id, name, "isActive", "isTemplate" FROM "MealPlan" WHERE "isActive" = true AND "userId" = $1 AND "isTemplate" = false LIMIT 1`,
      [userId]
    );

    let activePlan = activePlanResult.rows[0] || null;

    // If no active plan, get the first one for this user
    if (!activePlan) {
      const firstResult = await global.db.query(
        `SELECT id, name, "isActive", "isTemplate" FROM "MealPlan" WHERE "userId" = $1 AND "isTemplate" = false LIMIT 1`,
        [userId]
      );
      activePlan = firstResult.rows[0] || null;
    }

    // Get all plans for this user for switching
    const allPlansResult = await global.db.query(
      `SELECT id, name, "isActive", "isTemplate" FROM "MealPlan" WHERE "userId" = $1 AND "isTemplate" = false ORDER BY "createdAt" DESC`,
      [userId]
    );
    const allPlans = allPlansResult.rows;

    // Calculate totals if there's an active plan
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

        // Convert food values to numbers to prevent .toFixed() errors
        const foods = foodsResult.rows.map(food => ({
          id: food.id,
          name: food.name,
          quantity: food.quantity,
          notes: food.notes,
          calories: parseFloat(food.calories || 0),
          protein: parseFloat(food.protein || 0),
          carbs: parseFloat(food.carbs || 0),
          fat: parseFloat(food.fat || 0)
        }));

        // Substitute options (informational only, never counted in totals)
        for (const food of foods) {
          const optionsResult = await global.db.query(
            `SELECT id, name, quantity, calories, protein, carbs, fat FROM "MealFoodOption" WHERE "mealFoodId" = $1 ORDER BY "order" ASC`,
            [food.id]
          );
          food.options = optionsResult.rows;
        }

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

    // Ensure totals are numbers
    totals = {
      totalCalories: parseFloat(totals.totalCalories || 0),
      totalProtein: parseFloat(totals.totalProtein || 0),
      totalCarbs: parseFloat(totals.totalCarbs || 0),
      totalFat: parseFloat(totals.totalFat || 0)
    };

    res.render('diet/index', {
      title: 'Dieta',
      activePlan,
      allPlans,
      totals,
      isAdmin: req.session.user.role === 'admin',
      csrfToken: req.csrfToken(),
    });
  } catch (error) {
    console.error('Error fetching diet:', error);
    next(error);
  }
};

/**
 * Create a new meal plan
 */
exports.createMealPlan = async (req, res, next) => {
  try {
    const { name } = req.body;
    const userId = req.session.user.id;

    if (req.session.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Apenas administradores podem criar planos de dieta.' });
    }

    if (!name) {
      return res.status(400).json({ success: false, message: 'Nome é obrigatório' });
    }

    const result = await global.db.query(
      `INSERT INTO "MealPlan" ("userId", name, "isActive", "createdAt")
       VALUES ($1, $2, false, NOW())
       RETURNING id, name, "isActive"`,
      [userId, name]
    );

    res.json({ success: true, plan: result.rows[0] });
  } catch (error) {
    console.error('Error creating meal plan:', error);
    next(error);
  }
};

/**
 * Activate a meal plan
 */
exports.activateMealPlan = async (req, res, next) => {
  try {
    const { planId } = req.params;
    const userId = req.session.user.id;

    // Verify plan belongs to user
    const planCheck = await global.db.query(
      'SELECT id FROM "MealPlan" WHERE id = $1 AND "userId" = $2',
      [parseInt(planId), userId]
    );
    if (planCheck.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Plano não encontrado' });
    }

    // Deactivate all other plans for this user
    await global.db.query(
      `UPDATE "MealPlan" SET "isActive" = false WHERE "isActive" = true AND "userId" = $1`,
      [userId]
    );

    // Activate selected plan
    const result = await global.db.query(
      `UPDATE "MealPlan" SET "isActive" = true WHERE id = $1 RETURNING *`,
      [parseInt(planId)]
    );

    res.json({ success: true, plan: result.rows[0] });
  } catch (error) {
    console.error('Error activating meal plan:', error);
    next(error);
  }
};

/**
 * Add a meal to a plan
 */
exports.addMeal = async (req, res, next) => {
  try {
    const { mealPlanId, name, time } = req.body;
    const userId = req.session.user.id;

    if (req.session.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Apenas administradores podem adicionar refeições.' });
    }

    if (!name) {
      return res.status(400).json({ success: false, message: 'Nome é obrigatório' });
    }

    // Verify plan belongs to user
    const planCheck = await global.db.query(
      'SELECT id FROM "MealPlan" WHERE id = $1 AND "userId" = $2',
      [parseInt(mealPlanId), userId]
    );
    if (planCheck.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Plano não encontrado' });
    }

    const result = await global.db.query(
      `INSERT INTO "Meal" ("mealPlanId", name, "time")
       VALUES ($1, $2, $3)
       RETURNING *`,
      [parseInt(mealPlanId), name, time || null]
    );

    res.json({ success: true, meal: result.rows[0] });
  } catch (error) {
    console.error('Error adding meal:', error);
    next(error);
  }
};

/**
 * Delete a meal
 */
exports.deleteMeal = async (req, res, next) => {
  try {
    const { mealId } = req.params;
    const userId = req.session.user.id;

    if (req.session.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Apenas administradores podem remover refeições.' });
    }

    // Verify meal belongs to user's plan
    const ownerCheck = await global.db.query(
      `SELECT m.id FROM "Meal" m
       JOIN "MealPlan" mp ON m."mealPlanId" = mp.id
       WHERE m.id = $1 AND mp."userId" = $2`,
      [parseInt(mealId), userId]
    );
    if (ownerCheck.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Refeição não encontrada' });
    }

    // Delete foods first
    await global.db.query(
      `DELETE FROM "MealFood" WHERE "mealId" = $1`,
      [parseInt(mealId)]
    );

    // Delete meal
    await global.db.query(
      `DELETE FROM "Meal" WHERE id = $1`,
      [parseInt(mealId)]
    );

    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting meal:', error);
    next(error);
  }
};

/**
 * Add food to a meal
 */
exports.addFood = async (req, res, next) => {
  try {
    const { mealId, name, quantity, calories, protein, carbs, fat, notes } = req.body;
    const userId = req.session.user.id;

    if (req.session.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Apenas administradores podem adicionar alimentos.' });
    }

    // Verify meal belongs to user's plan
    const ownerCheck = await global.db.query(
      `SELECT m.id FROM "Meal" m
       JOIN "MealPlan" mp ON m."mealPlanId" = mp.id
       WHERE m.id = $1 AND mp."userId" = $2`,
      [parseInt(mealId), userId]
    );
    if (ownerCheck.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Refeição não encontrada' });
    }

    // 🔧 Validação de nome
    if (!name || typeof name !== 'string' || name.trim().length < 2) {
      return res.status(400).json({ success: false, message: 'Nome do alimento inválido (mín 2 caracteres)' });
    }

    if (name.length > 100) {
      return res.status(400).json({ success: false, message: 'Nome do alimento muito longo (máx 100 caracteres)' });
    }

    // 🔧 Validação de quantidade (opcional, mas se fornecida deve ser válida)
    if (quantity && typeof quantity !== 'string') {
      return res.status(400).json({ success: false, message: 'Quantidade deve ser um texto válido' });
    }

    // 🔧 Converter e validar valores numéricos
    let caloriesVal = null;
    let proteinVal = null;
    let carbsVal = null;
    let fatVal = null;

    if (calories !== null && calories !== undefined && calories !== '') {
      caloriesVal = parseFloat(calories);
      if (isNaN(caloriesVal) || caloriesVal < 0) {
        return res.status(400).json({ success: false, message: 'Calorias deve ser um número não-negativo' });
      }
      caloriesVal = Math.round(caloriesVal * 100) / 100; // Limit to 2 decimals
    }

    if (protein !== null && protein !== undefined && protein !== '') {
      proteinVal = parseFloat(protein);
      if (isNaN(proteinVal) || proteinVal < 0) {
        return res.status(400).json({ success: false, message: 'Proteína deve ser um número não-negativo' });
      }
      proteinVal = Math.round(proteinVal * 100) / 100;
    }

    if (carbs !== null && carbs !== undefined && carbs !== '') {
      carbsVal = parseFloat(carbs);
      if (isNaN(carbsVal) || carbsVal < 0) {
        return res.status(400).json({ success: false, message: 'Carboidratos deve ser um número não-negativo' });
      }
      carbsVal = Math.round(carbsVal * 100) / 100;
    }

    if (fat !== null && fat !== undefined && fat !== '') {
      fatVal = parseFloat(fat);
      if (isNaN(fatVal) || fatVal < 0) {
        return res.status(400).json({ success: false, message: 'Gordura deve ser um número não-negativo' });
      }
      fatVal = Math.round(fatVal * 100) / 100;
    }

    // 🔧 Validação: pelo menos uma propriedade nutricional deve estar definida
    if (caloriesVal === null && proteinVal === null && carbsVal === null && fatVal === null) {
      return res.status(400).json({ success: false, message: 'Adicione pelo menos uma informação nutricional' });
    }

    // 🔧 Validação de notes (opcional)
    let notesVal = null;
    if (notes && typeof notes === 'string') {
      notesVal = notes.trim() || null;
      if (notesVal && notesVal.length > 500) {
        return res.status(400).json({ success: false, message: 'Notas muito longas (máx 500 caracteres)' });
      }
    }

    const result = await global.db.query(
      `INSERT INTO "MealFood" ("mealId", name, quantity, calories, protein, carbs, fat, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [
        parseInt(mealId),
        name.trim(),
        quantity?.trim() || null,
        caloriesVal,
        proteinVal,
        carbsVal,
        fatVal,
        notesVal
      ]
    );

    res.json({ success: true, food: result.rows[0] });
  } catch (error) {
    console.error('Error adding food:', error);
    next(error);
  }
};

/**
 * Update a food
 */
exports.updateFood = async (req, res, next) => {
  try {
    const { foodId } = req.params;
    const { name, quantity, calories, protein, carbs, fat, notes } = req.body;
    const userId = req.session.user.id;

    if (req.session.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Apenas administradores podem editar alimentos.' });
    }

    // Verify food belongs to user's plan
    const ownerCheck = await global.db.query(
      `SELECT mf.id FROM "MealFood" mf
       JOIN "Meal" m ON mf."mealId" = m.id
       JOIN "MealPlan" mp ON m."mealPlanId" = mp.id
       WHERE mf.id = $1 AND mp."userId" = $2`,
      [parseInt(foodId), userId]
    );
    if (ownerCheck.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Alimento não encontrado' });
    }

    if (!name || typeof name !== 'string' || name.trim().length < 2) {
      return res.status(400).json({ success: false, message: 'Nome do alimento inválido (mín 2 caracteres)' });
    }
    if (name.length > 100) {
      return res.status(400).json({ success: false, message: 'Nome do alimento muito longo (máx 100 caracteres)' });
    }
    if (quantity && typeof quantity !== 'string') {
      return res.status(400).json({ success: false, message: 'Quantidade deve ser um texto válido' });
    }

    let caloriesVal = null;
    let proteinVal = null;
    let carbsVal = null;
    let fatVal = null;

    if (calories !== null && calories !== undefined && calories !== '') {
      caloriesVal = parseFloat(calories);
      if (isNaN(caloriesVal) || caloriesVal < 0) {
        return res.status(400).json({ success: false, message: 'Calorias deve ser um número não-negativo' });
      }
      caloriesVal = Math.round(caloriesVal * 100) / 100;
    }
    if (protein !== null && protein !== undefined && protein !== '') {
      proteinVal = parseFloat(protein);
      if (isNaN(proteinVal) || proteinVal < 0) {
        return res.status(400).json({ success: false, message: 'Proteína deve ser um número não-negativo' });
      }
      proteinVal = Math.round(proteinVal * 100) / 100;
    }
    if (carbs !== null && carbs !== undefined && carbs !== '') {
      carbsVal = parseFloat(carbs);
      if (isNaN(carbsVal) || carbsVal < 0) {
        return res.status(400).json({ success: false, message: 'Carboidratos deve ser um número não-negativo' });
      }
      carbsVal = Math.round(carbsVal * 100) / 100;
    }
    if (fat !== null && fat !== undefined && fat !== '') {
      fatVal = parseFloat(fat);
      if (isNaN(fatVal) || fatVal < 0) {
        return res.status(400).json({ success: false, message: 'Gordura deve ser um número não-negativo' });
      }
      fatVal = Math.round(fatVal * 100) / 100;
    }

    if (caloriesVal === null && proteinVal === null && carbsVal === null && fatVal === null) {
      return res.status(400).json({ success: false, message: 'Adicione pelo menos uma informação nutricional' });
    }

    let notesVal = null;
    if (notes && typeof notes === 'string') {
      notesVal = notes.trim() || null;
      if (notesVal && notesVal.length > 500) {
        return res.status(400).json({ success: false, message: 'Notas muito longas (máx 500 caracteres)' });
      }
    }

    const result = await global.db.query(
      `UPDATE "MealFood"
       SET name = $1, quantity = $2, calories = $3, protein = $4, carbs = $5, fat = $6, notes = $7
       WHERE id = $8
       RETURNING *`,
      [name.trim(), quantity?.trim() || null, caloriesVal, proteinVal, carbsVal, fatVal, notesVal, parseInt(foodId)]
    );

    res.json({ success: true, food: result.rows[0] });
  } catch (error) {
    console.error('Error updating food:', error);
    next(error);
  }
};

/**
 * Add a substitute option to a food (e.g. "or 115g patinho" instead of the
 * main "120g frango grelhado"). Purely informational — never counted in totals.
 */
exports.addFoodOption = async (req, res, next) => {
  try {
    const { foodId } = req.params;
    const { name, quantity, calories, protein, carbs, fat } = req.body;
    const userId = req.session.user.id;

    if (req.session.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Apenas administradores podem adicionar substitutos.' });
    }

    const ownerCheck = await global.db.query(
      `SELECT mf.id FROM "MealFood" mf
       JOIN "Meal" m ON mf."mealId" = m.id
       JOIN "MealPlan" mp ON m."mealPlanId" = mp.id
       WHERE mf.id = $1 AND mp."userId" = $2`,
      [parseInt(foodId), userId]
    );
    if (ownerCheck.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Alimento não encontrado' });
    }

    if (!name || typeof name !== 'string' || name.trim().length < 2) {
      return res.status(400).json({ success: false, message: 'Nome do substituto inválido (mín 2 caracteres)' });
    }

    const caloriesVal = calories !== null && calories !== undefined && calories !== '' ? Math.round(parseFloat(calories) * 100) / 100 : null;
    const proteinVal = protein !== null && protein !== undefined && protein !== '' ? Math.round(parseFloat(protein) * 100) / 100 : null;
    const carbsVal = carbs !== null && carbs !== undefined && carbs !== '' ? Math.round(parseFloat(carbs) * 100) / 100 : null;
    const fatVal = fat !== null && fat !== undefined && fat !== '' ? Math.round(parseFloat(fat) * 100) / 100 : null;

    const orderResult = await global.db.query(
      `SELECT COALESCE(MAX("order"), -1) + 1 AS next FROM "MealFoodOption" WHERE "mealFoodId" = $1`,
      [parseInt(foodId)]
    );

    const result = await global.db.query(
      `INSERT INTO "MealFoodOption" ("mealFoodId", name, quantity, calories, protein, carbs, fat, "order")
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [parseInt(foodId), name.trim(), quantity?.trim() || null, caloriesVal, proteinVal, carbsVal, fatVal, orderResult.rows[0].next]
    );

    res.json({ success: true, option: result.rows[0] });
  } catch (error) {
    console.error('Error adding food option:', error);
    next(error);
  }
};

/**
 * Delete a substitute option
 */
exports.deleteFoodOption = async (req, res, next) => {
  try {
    const { optionId } = req.params;
    const userId = req.session.user.id;

    if (req.session.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Apenas administradores podem remover substitutos.' });
    }

    const ownerCheck = await global.db.query(
      `SELECT o.id FROM "MealFoodOption" o
       JOIN "MealFood" mf ON o."mealFoodId" = mf.id
       JOIN "Meal" m ON mf."mealId" = m.id
       JOIN "MealPlan" mp ON m."mealPlanId" = mp.id
       WHERE o.id = $1 AND mp."userId" = $2`,
      [parseInt(optionId), userId]
    );
    if (ownerCheck.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Substituto não encontrado' });
    }

    await global.db.query(`DELETE FROM "MealFoodOption" WHERE id = $1`, [parseInt(optionId)]);
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting food option:', error);
    next(error);
  }
};

/**
 * Delete a food
 */
exports.deleteFood = async (req, res, next) => {
  try {
    const { foodId } = req.params;
    const userId = req.session.user.id;

    if (req.session.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Apenas administradores podem remover alimentos.' });
    }

    // Verify food belongs to user's plan
    const ownerCheck = await global.db.query(
      `SELECT mf.id FROM "MealFood" mf
       JOIN "Meal" m ON mf."mealId" = m.id
       JOIN "MealPlan" mp ON m."mealPlanId" = mp.id
       WHERE mf.id = $1 AND mp."userId" = $2`,
      [parseInt(foodId), userId]
    );
    if (ownerCheck.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Alimento não encontrado' });
    }

    await global.db.query(
      `DELETE FROM "MealFood" WHERE id = $1`,
      [parseInt(foodId)]
    );

    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting food:', error);
    next(error);
  }
};

/**
 * Update meal plan name
 */
exports.updateMealPlanName = async (req, res, next) => {
  try {
    const { planId } = req.params;
    const { name } = req.body;
    const userId = req.session.user.id;

    if (!name) {
      return res.status(400).json({ success: false, message: 'Nome é obrigatório' });
    }

    const result = await global.db.query(
      `UPDATE "MealPlan" SET name = $1 WHERE id = $2 AND "userId" = $3 RETURNING *`,
      [name, parseInt(planId), userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Plano não encontrado' });
    }

    res.json({ success: true, plan: result.rows[0] });
  } catch (error) {
    console.error('Error updating meal plan:', error);
    next(error);
  }
};

/**
 * Mark/unmark a meal plan as template (admin only)
 */
exports.toggleTemplate = async (req, res, next) => {
  try {
    const { planId } = req.params;
    const userId = req.session.user.id;

    const planCheck = await global.db.query(
      'SELECT id, "isTemplate" FROM "MealPlan" WHERE id = $1 AND "userId" = $2',
      [parseInt(planId), userId]
    );
    if (planCheck.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Plano não encontrado' });
    }

    const newValue = !planCheck.rows[0].isTemplate;
    await global.db.query(
      'UPDATE "MealPlan" SET "isTemplate" = $1 WHERE id = $2',
      [newValue, parseInt(planId)]
    );

    res.json({ success: true, isTemplate: newValue });
  } catch (error) {
    next(error);
  }
};

// ========================
// FOOD NUTRITION SEARCH
// ========================

// Simple in-memory cache to avoid hammering APIs on repeated/rapid searches
const _foodCache = new Map(); // key -> { results, expiresAt }
const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes

function getCached(key) {
  const entry = _foodCache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) { _foodCache.delete(key); return null; }
  return entry.results;
}
function setCache(key, results) {
  _foodCache.set(key, { results, expiresAt: Date.now() + CACHE_TTL_MS });
  // Limit cache size
  if (_foodCache.size > 200) {
    const firstKey = _foodCache.keys().next().value;
    _foodCache.delete(firstKey);
  }
}

// Common PT→EN translations for gym foods (for USDA which is English-only)
const PT_EN_MAP = {
  'frango': 'chicken breast', 'peito de frango': 'chicken breast', 'file de frango': 'chicken breast',
  'carne': 'beef', 'carne bovina': 'beef', 'patinho': 'beef lean', 'alcatra': 'beef sirloin',
  'peixe': 'fish', 'tilapia': 'tilapia', 'tilápia': 'tilapia', 'salmao': 'salmon', 'salmão': 'salmon', 'atum': 'tuna',
  'ovo': 'egg', 'ovos': 'eggs', 'clara': 'egg white', 'clara de ovo': 'egg white',
  'arroz': 'rice', 'arroz branco': 'white rice', 'arroz integral': 'brown rice',
  'feijao': 'beans', 'feijão': 'beans', 'lentilha': 'lentils',
  'batata': 'potato', 'batata doce': 'sweet potato', 'batata-doce': 'sweet potato',
  'pao': 'bread', 'pão': 'bread', 'pao integral': 'whole wheat bread', 'pão integral': 'whole wheat bread',
  'macarrao': 'pasta', 'macarrão': 'pasta', 'aveia': 'oats', 'granola': 'granola',
  'leite': 'milk', 'iogurte': 'yogurt', 'queijo': 'cheese', 'requeijao': 'cream cheese', 'requeijão': 'cream cheese',
  'whey': 'whey protein', 'proteina': 'protein', 'caseina': 'casein',
  'amendoim': 'peanut', 'pasta de amendoim': 'peanut butter',
  'banana': 'banana', 'maca': 'apple', 'maçã': 'apple', 'laranja': 'orange', 'morango': 'strawberry',
  'brocolis': 'broccoli', 'brócolis': 'broccoli', 'espinafre': 'spinach', 'cenoura': 'carrot',
  'azeite': 'olive oil', 'oleo': 'oil', 'óleo': 'oil',
  'chocolate': 'chocolate', 'cacau': 'cocoa',
};

function normalizeText(s) {
  return String(s || '').toLowerCase().trim()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

// Curated whole-food entries (per 100g), based on typical TACO/USDA reference values.
// Covers the foods most commonly tracked in Brazilian diet/fitness plans, grouped by
// category. This is now the ONLY food source \u2014 Open Food Facts (a barcode/packaged-
// product database) was removed because it mostly returns branded ready-meals
// ("Frango Grelhado, Arroz e Br\u00f3colis") instead of plain ingredients; USDA stays as a
// fallback (translated, English) for anything not covered here.
const LOCAL_FOODS = [
  // Prote\u00ednas animais
  { name: 'Frango grelhado (peito)', aliases: ['frango grelhado', 'peito de frango grelhado', 'frango'], calories: 165, protein: 31, carbs: 0, fat: 3.6 },
  { name: 'Frango cozido (peito)', aliases: ['frango cozido'], calories: 163, protein: 29, carbs: 0, fat: 4 },
  { name: 'Frango assado (peito)', aliases: ['frango assado'], calories: 190, protein: 29, carbs: 0, fat: 7.5 },
  { name: 'Coxa de frango assada (com pele)', aliases: ['coxa de frango', 'coxa de frango assada'], calories: 253, protein: 26, carbs: 0, fat: 16 },
  { name: 'Carne mo\u00edda cozida', aliases: ['carne moida', 'carne bovina moida'], calories: 212, protein: 26.7, carbs: 0, fat: 11.3 },
  { name: 'Carne mo\u00edda magra cozida (patinho)', aliases: ['carne moida magra', 'patinho moido'], calories: 137, protein: 21, carbs: 0, fat: 5 },
  { name: 'Patinho grelhado', aliases: ['patinho grelhado', 'patinho', 'carne grelhada', 'carne bovina grelhada'], calories: 219, protein: 35.9, carbs: 0, fat: 7.3 },
  { name: 'Alcatra grelhada', aliases: ['alcatra grelhada', 'alcatra'], calories: 195, protein: 32, carbs: 0, fat: 7 },
  { name: 'Contra fil\u00e9 grelhado', aliases: ['contra file grelhado', 'contra file'], calories: 217, protein: 32, carbs: 0, fat: 9 },
  { name: 'Picanha grelhada', aliases: ['picanha grelhada', 'picanha'], calories: 289, protein: 26, carbs: 0, fat: 20 },
  { name: 'Cox\u00e3o mole cozido', aliases: ['coxao mole'], calories: 219, protein: 34, carbs: 0, fat: 8.5 },
  { name: 'Lombo su\u00edno grelhado', aliases: ['lombo suino', 'lombo de porco', 'carne de porco grelhada'], calories: 210, protein: 28, carbs: 0, fat: 10 },
  { name: 'Til\u00e1pia grelhada', aliases: ['tilapia grelhada', 'peixe grelhado', 'tilapia'], calories: 129, protein: 26.2, carbs: 0, fat: 2.7 },
  { name: 'Salm\u00e3o grelhado', aliases: ['salmao grelhado', 'salmao'], calories: 208, protein: 22, carbs: 0, fat: 13 },
  { name: 'Atum em \u00e1gua (lata)', aliases: ['atum em agua', 'atum'], calories: 116, protein: 25.5, carbs: 0, fat: 0.8 },
  { name: 'Atum em \u00f3leo (lata)', aliases: ['atum em oleo'], calories: 189, protein: 24, carbs: 0, fat: 9.8 },
  { name: 'Sardinha em lata (\u00f3leo)', aliases: ['sardinha'], calories: 208, protein: 24.6, carbs: 0, fat: 11.5 },
  { name: 'Camar\u00e3o cozido', aliases: ['camarao cozido', 'camarao'], calories: 99, protein: 21, carbs: 0.2, fat: 1.4 },
  { name: 'Ovo cozido', aliases: ['ovo cozido', 'ovo'], calories: 146, protein: 13.3, carbs: 0.6, fat: 9.5 },
  { name: 'Ovo frito', aliases: ['ovo frito'], calories: 196, protein: 13.6, carbs: 0.6, fat: 15.1 },
  { name: 'Ovo mexido', aliases: ['ovo mexido'], calories: 168, protein: 12, carbs: 1.6, fat: 12.7 },
  { name: 'Clara de ovo cozida', aliases: ['clara de ovo', 'clara'], calories: 52, protein: 10.9, carbs: 0.7, fat: 0.2 },
  { name: 'Gema de ovo cozida', aliases: ['gema de ovo', 'gema'], calories: 322, protein: 15.9, carbs: 3.6, fat: 27 },
  { name: 'Peito de peru fatiado', aliases: ['peito de peru'], calories: 97, protein: 20, carbs: 1, fat: 1 },
  { name: 'Presunto magro', aliases: ['presunto magro', 'presunto'], calories: 106, protein: 17, carbs: 2, fat: 3 },
  { name: 'Queijo cottage', aliases: ['queijo cottage', 'cottage'], calories: 98, protein: 11, carbs: 3.4, fat: 4.3 },
  { name: 'Ricota', aliases: ['ricota'], calories: 138, protein: 11, carbs: 3, fat: 8 },

  // Prote\u00ednas vegetais / leguminosas
  { name: 'Tofu', aliases: ['tofu'], calories: 76, protein: 8, carbs: 1.9, fat: 4.8 },
  { name: 'Prote\u00edna de soja texturizada (hidratada)', aliases: ['proteina de soja', 'pts', 'soja texturizada'], calories: 116, protein: 18, carbs: 8, fat: 1 },
  { name: 'Gr\u00e3o-de-bico cozido', aliases: ['grao de bico', 'grao-de-bico'], calories: 121, protein: 6.7, carbs: 20.4, fat: 1.9 },
  { name: 'Lentilha cozida', aliases: ['lentilha'], calories: 93, protein: 6.3, carbs: 16.3, fat: 0.5 },
  { name: 'Ervilha cozida', aliases: ['ervilha'], calories: 84, protein: 5.4, carbs: 14.5, fat: 0.4 },
  { name: 'Feij\u00e3o carioca cozido', aliases: ['feijao carioca', 'feijao'], calories: 76, protein: 4.8, carbs: 13.6, fat: 0.5 },
  { name: 'Feij\u00e3o preto cozido', aliases: ['feijao preto'], calories: 77, protein: 4.5, carbs: 14, fat: 0.5 },
  { name: 'Feij\u00e3o branco cozido', aliases: ['feijao branco'], calories: 91, protein: 6.6, carbs: 16.6, fat: 0.3 },
  { name: 'Whey protein (p\u00f3)', aliases: ['whey protein', 'whey'], calories: 400, protein: 80, carbs: 8, fat: 6 },
  { name: 'Case\u00edna (p\u00f3)', aliases: ['caseina'], calories: 360, protein: 78, carbs: 6, fat: 2 },
  { name: 'Albumina (p\u00f3)', aliases: ['albumina'], calories: 375, protein: 84, carbs: 3, fat: 1 },

  // Carboidratos
  { name: 'Arroz branco cozido', aliases: ['arroz branco', 'arroz'], calories: 128, protein: 2.5, carbs: 28.1, fat: 0.2 },
  { name: 'Arroz integral cozido', aliases: ['arroz integral'], calories: 124, protein: 2.6, carbs: 25.8, fat: 1 },
  { name: 'Arroz parboilizado cozido', aliases: ['arroz parboilizado'], calories: 123, protein: 2.7, carbs: 26.2, fat: 0.3 },
  { name: 'Batata inglesa cozida', aliases: ['batata cozida', 'batata inglesa', 'batata'], calories: 52, protein: 1.2, carbs: 11.9, fat: 0.1 },
  { name: 'Batata doce cozida', aliases: ['batata doce'], calories: 77, protein: 0.6, carbs: 18.4, fat: 0.1 },
  { name: 'Mandioca cozida', aliases: ['mandioca', 'aipim', 'macaxeira'], calories: 125, protein: 0.6, carbs: 30.1, fat: 0.3 },
  { name: 'Inhame cozido', aliases: ['inhame'], calories: 118, protein: 2.1, carbs: 27.6, fat: 0.2 },
  { name: 'Car\u00e1 cozido', aliases: ['cara cozido', 'cara'], calories: 97, protein: 1.9, carbs: 22.9, fat: 0.1 },
  { name: 'Batata baroa cozida (mandioquinha)', aliases: ['batata baroa', 'mandioquinha'], calories: 80, protein: 1.5, carbs: 18.6, fat: 0.3 },
  { name: 'Macarr\u00e3o cozido', aliases: ['macarrao', 'massa'], calories: 111, protein: 3.5, carbs: 21.6, fat: 0.9 },
  { name: 'Macarr\u00e3o integral cozido', aliases: ['macarrao integral', 'massa integral'], calories: 124, protein: 5, carbs: 25, fat: 1.1 },
  { name: 'P\u00e3o franc\u00eas', aliases: ['pao frances'], calories: 300, protein: 8, carbs: 58.6, fat: 3.1 },
  { name: 'P\u00e3o integral', aliases: ['pao integral'], calories: 253, protein: 9.4, carbs: 49.9, fat: 3.4 },
  { name: 'P\u00e3o de forma tradicional', aliases: ['pao de forma'], calories: 253, protein: 8, carbs: 49, fat: 3 },
  { name: 'P\u00e3o de forma light', aliases: ['pao de forma light', 'pao light'], calories: 245, protein: 11, carbs: 45, fat: 2.5 },
  { name: 'Tapioca (goma hidratada)', aliases: ['tapioca'], calories: 156, protein: 0.2, carbs: 38.5, fat: 0.1 },
  { name: 'Cuscuz de milho cozido', aliases: ['cuscuz'], calories: 112, protein: 2.2, carbs: 25, fat: 0.2 },
  { name: 'Aveia em flocos', aliases: ['aveia'], calories: 394, protein: 13.9, carbs: 67, fat: 8.5 },
  { name: 'Farelo de aveia', aliases: ['farelo de aveia'], calories: 246, protein: 17, carbs: 66, fat: 7 },
  { name: 'Granola', aliases: ['granola'], calories: 471, protein: 10.1, carbs: 65.5, fat: 19.4 },
  { name: 'Quinoa cozida', aliases: ['quinoa'], calories: 120, protein: 4.4, carbs: 21.3, fat: 1.9 },
  { name: 'Milho verde cozido', aliases: ['milho verde', 'milho'], calories: 98, protein: 3.3, carbs: 21, fat: 1.2 },

  // Vegetais e verduras
  { name: 'Alface crespa crua', aliases: ['alface'], calories: 11, protein: 1.3, carbs: 1.7, fat: 0.2 },
  { name: 'R\u00facula crua', aliases: ['rucula'], calories: 25, protein: 2.6, carbs: 3.7, fat: 0.7 },
  { name: 'Couve crua', aliases: ['couve'], calories: 27, protein: 2.9, carbs: 4.3, fat: 0.5 },
  { name: 'Repolho cru', aliases: ['repolho'], calories: 25, protein: 1.3, carbs: 5.8, fat: 0.1 },
  { name: 'Tomate cru', aliases: ['tomate'], calories: 15, protein: 1.1, carbs: 3.1, fat: 0.2 },
  { name: 'Pepino cru', aliases: ['pepino'], calories: 10, protein: 0.7, carbs: 2.1, fat: 0.1 },
  { name: 'Abobrinha cozida', aliases: ['abobrinha'], calories: 19, protein: 1.4, carbs: 4.1, fat: 0.2 },
  { name: 'Berinjela cozida', aliases: ['berinjela'], calories: 21, protein: 0.8, carbs: 4.8, fat: 0.2 },
  { name: 'Chuchu cozido', aliases: ['chuchu'], calories: 19, protein: 0.6, carbs: 4.4, fat: 0.1 },
  { name: 'Cenoura crua', aliases: ['cenoura crua'], calories: 34, protein: 1.3, carbs: 7.7, fat: 0.2 },
  { name: 'Cenoura cozida', aliases: ['cenoura cozida', 'cenoura'], calories: 32, protein: 0.9, carbs: 7.7, fat: 0.2 },
  { name: 'Beterraba cozida', aliases: ['beterraba'], calories: 32, protein: 1.3, carbs: 7.2, fat: 0.1 },
  { name: 'Br\u00f3colis cozido', aliases: ['brocolis'], calories: 25, protein: 2.1, carbs: 4.4, fat: 0.5 },
  { name: 'Couve-flor cozida', aliases: ['couve flor', 'couve-flor'], calories: 23, protein: 1.9, carbs: 4.3, fat: 0.2 },
  { name: 'Espinafre cozido', aliases: ['espinafre'], calories: 16, protein: 1.7, carbs: 2.7, fat: 0.3 },
  { name: 'Vagem cozida', aliases: ['vagem'], calories: 25, protein: 1.5, carbs: 5, fat: 0.1 },
  { name: 'Piment\u00e3o cru', aliases: ['pimentao'], calories: 20, protein: 0.9, carbs: 4.6, fat: 0.2 },

  // Frutas
  { name: 'Banana prata', aliases: ['banana'], calories: 98, protein: 1.3, carbs: 26, fat: 0.1 },
  { name: 'Ma\u00e7\u00e3 com casca', aliases: ['maca'], calories: 56, protein: 0.3, carbs: 15.2, fat: 0.1 },
  { name: 'Laranja p\u00eara', aliases: ['laranja'], calories: 45, protein: 1, carbs: 11.3, fat: 0.1 },
  { name: 'Mam\u00e3o papaia', aliases: ['mamao'], calories: 40, protein: 0.5, carbs: 10.4, fat: 0.1 },
  { name: 'Melancia', aliases: ['melancia'], calories: 33, protein: 0.6, carbs: 8.1, fat: 0.2 },
  { name: 'Mel\u00e3o', aliases: ['melao'], calories: 29, protein: 0.7, carbs: 7.5, fat: 0.1 },
  { name: 'Abacaxi', aliases: ['abacaxi'], calories: 48, protein: 0.9, carbs: 12.3, fat: 0.1 },
  { name: 'Uva', aliases: ['uva'], calories: 53, protein: 0.6, carbs: 13.3, fat: 0.2 },
  { name: 'Morango', aliases: ['morango'], calories: 30, protein: 0.9, carbs: 6.8, fat: 0.3 },
  { name: 'Manga', aliases: ['manga'], calories: 64, protein: 0.4, carbs: 16.7, fat: 0.3 },
  { name: 'Abacate', aliases: ['abacate'], calories: 96, protein: 1.2, carbs: 6, fat: 8.4 },
  { name: 'Kiwi', aliases: ['kiwi'], calories: 51, protein: 1.1, carbs: 11.5, fat: 0.4 },
  { name: 'Pera', aliases: ['pera'], calories: 53, protein: 0.3, carbs: 13.8, fat: 0.1 },

  // Gorduras e oleaginosas
  { name: 'Azeite de oliva', aliases: ['azeite'], calories: 884, protein: 0, carbs: 0, fat: 100 },
  { name: '\u00d3leo de coco', aliases: ['oleo de coco'], calories: 862, protein: 0, carbs: 0, fat: 100 },
  { name: 'Castanha do Par\u00e1', aliases: ['castanha do para'], calories: 656, protein: 14.3, carbs: 12.3, fat: 66.4 },
  { name: 'Castanha de caju', aliases: ['castanha de caju'], calories: 570, protein: 18.5, carbs: 29, fat: 46 },
  { name: 'Am\u00eandoas', aliases: ['amendoas'], calories: 575, protein: 21, carbs: 22, fat: 49 },
  { name: 'Nozes', aliases: ['nozes'], calories: 654, protein: 15, carbs: 14, fat: 65 },
  { name: 'Amendoim torrado', aliases: ['amendoim'], calories: 544, protein: 27.2, carbs: 20.3, fat: 43.9 },
  { name: 'Pasta de amendoim', aliases: ['pasta de amendoim'], calories: 588, protein: 25, carbs: 20, fat: 50 },
  { name: 'Coco ralado seco', aliases: ['coco ralado'], calories: 660, protein: 6.9, carbs: 24, fat: 65 },
  { name: 'Semente de chia', aliases: ['chia'], calories: 486, protein: 17, carbs: 42, fat: 31 },
  { name: 'Semente de linha\u00e7a', aliases: ['linhaca'], calories: 495, protein: 18, carbs: 29, fat: 42 },

  // Latic\u00ednios
  { name: 'Leite integral', aliases: ['leite integral', 'leite'], calories: 61, protein: 2.9, carbs: 4.3, fat: 3.2 },
  { name: 'Leite desnatado', aliases: ['leite desnatado'], calories: 35, protein: 3.4, carbs: 5, fat: 0.1 },
  { name: 'Leite semidesnatado', aliases: ['leite semidesnatado'], calories: 46, protein: 3.1, carbs: 4.6, fat: 1.6 },
  { name: 'Iogurte natural integral', aliases: ['iogurte natural', 'iogurte'], calories: 51, protein: 4.1, carbs: 1.9, fat: 3 },
  { name: 'Iogurte natural desnatado', aliases: ['iogurte desnatado'], calories: 41, protein: 4.1, carbs: 5.9, fat: 0.2 },
  { name: 'Iogurte grego natural', aliases: ['iogurte grego'], calories: 97, protein: 9, carbs: 4, fat: 5 },
  { name: 'Queijo minas frescal', aliases: ['queijo minas', 'queijo'], calories: 264, protein: 17.4, carbs: 3.2, fat: 20.2 },
  { name: 'Queijo mu\u00e7arela', aliases: ['queijo mucarela', 'mucarela', 'muzzarela'], calories: 330, protein: 22.6, carbs: 3, fat: 25 },
  { name: 'Queijo prato', aliases: ['queijo prato'], calories: 360, protein: 23, carbs: 1.9, fat: 29 },
  { name: 'Queijo parmes\u00e3o', aliases: ['queijo parmesao', 'parmesao'], calories: 431, protein: 38, carbs: 3.4, fat: 29 },
  { name: 'Requeij\u00e3o cremoso', aliases: ['requeijao'], calories: 257, protein: 9.6, carbs: 3.2, fat: 23.4 },
];

function searchLocalFoods(query) {
  const words = normalizeText(query).split(/\s+/).filter(Boolean);
  if (words.length === 0) return [];
  return LOCAL_FOODS.filter(f => {
    const haystack = normalizeText(f.name + ' ' + f.aliases.join(' '));
    return words.every(w => haystack.includes(w));
  }).map(f => ({
    name: f.name,
    calories: f.calories,
    protein: f.protein,
    carbs: f.carbs,
    fat: f.fat,
    source: 'Alimento comum',
  }));
}

function translateToEN(query) {
  const normalized = normalizeText(query);
  // Try full phrase first, then first word
  for (const [pt, en] of Object.entries(PT_EN_MAP)) {
    const ptNorm = pt.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    if (normalized.includes(ptNorm)) return en;
  }
  return null;
}

async function searchUSDA(query) {
  const apiKey = process.env.USDA_API_KEY || 'DEMO_KEY';

  // Try English translation first, fallback to original query
  const enQuery = translateToEN(query) || query;
  const url = `https://api.nal.usda.gov/fdc/v1/foods/search?query=${encodeURIComponent(enQuery)}&api_key=${apiKey}&dataType=Foundation,SR%20Legacy&pageSize=8`;

  console.log(`[USDA] searching: "${enQuery}" (original: "${query}")`);
  const response = await fetch(url, { signal: AbortSignal.timeout(6000) });
  if (!response.ok) {
    console.warn(`[USDA] HTTP ${response.status}`);
    return [];
  }

  const data = await response.json();
  if (!data.foods || data.foods.length === 0) {
    console.log('[USDA] no results');
    return [];
  }

  return data.foods.map(food => {
    const nutrients = {};
    (food.foodNutrients || []).forEach(n => { nutrients[n.nutrientId] = n.value; });
    return {
      name: food.description,
      calories: Math.round(nutrients[1008] || 0),
      protein: parseFloat((nutrients[1003] || 0).toFixed(1)),
      carbs: parseFloat((nutrients[1005] || 0).toFixed(1)),
      fat: parseFloat((nutrients[1004] || 0).toFixed(1)),
      source: 'USDA',
    };
  }).filter(f => f.name && (f.calories > 0 || f.protein > 0));
}

exports.searchFood = async (req, res) => {
  try {
    if (req.session.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Acesso negado' });
    }

    const { q } = req.query;
    if (!q || q.trim().length < 2) {
      return res.json({ success: true, results: [] });
    }

    const query = q.trim();
    const cacheKey = query.toLowerCase();

    // Serve from cache if available
    const cached = getCached(cacheKey);
    if (cached) {
      console.log(`[food-search] cache hit for "${query}"`);
      return res.json({ success: true, results: cached });
    }

    const localItems = searchLocalFoods(query);

    // USDA (English) only fills in when our curated PT-BR table has no match at all —
    // avoids mixing in English results when we already have a clean local answer.
    let usdaItems = [];
    if (localItems.length === 0) {
      try {
        usdaItems = await searchUSDA(query);
      } catch (err) {
        console.warn('[USDA] failed:', err.message);
      }
    }

    console.log(`[food-search] local: ${localItems.length}, USDA: ${usdaItems.length}`);

    // Combine (curated whole foods first, USDA fills in only when nothing local matched), dedup by name
    const seen = new Set();
    const combined = [...localItems, ...usdaItems].filter(f => {
      const key = f.name.toLowerCase().trim();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    const results = combined.slice(0, 8);
    setCache(cacheKey, results);
    res.json({ success: true, results });
  } catch (error) {
    console.error('Error searching food:', error);
    res.json({ success: true, results: [] });
  }
};
