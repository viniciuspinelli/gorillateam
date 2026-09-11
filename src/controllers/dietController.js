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

function translateToEN(query) {
  const lower = query.toLowerCase().trim()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, ''); // strip accents
  const normalized = lower;
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

async function searchOpenFoodFacts(query) {
  // CGI endpoint — more stable than v2
  const url = `https://world.openfoodfacts.org/cgi/search.pl?search_terms=${encodeURIComponent(query)}&json=1&page_size=12&fields=product_name,nutriments&lc=pt&cc=br`;

  console.log(`[OFF] searching: "${query}"`);
  const response = await fetch(url, {
    signal: AbortSignal.timeout(8000),
    headers: { 'User-Agent': 'GymDiet/1.0' }
  });

  if (!response.ok) {
    console.warn(`[OFF] HTTP ${response.status}`);
    return [];
  }

  const data = await response.json();
  const products = data.products || [];
  console.log(`[OFF] returned ${products.length} products`);

  return products
    .filter(p => p.product_name && p.nutriments && (p.nutriments['energy-kcal_100g'] > 0 || p.nutriments['proteins_100g'] > 0))
    .map(p => ({
      name: p.product_name,
      calories: Math.round(p.nutriments['energy-kcal_100g'] || 0),
      protein: parseFloat((p.nutriments['proteins_100g'] || 0).toFixed(1)),
      carbs: parseFloat((p.nutriments['carbohydrates_100g'] || 0).toFixed(1)),
      fat: parseFloat((p.nutriments['fat_100g'] || 0).toFixed(1)),
      source: 'Open Food Facts',
    }));
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

    // Run both APIs in parallel
    const [usdaResult, offResult] = await Promise.allSettled([
      searchUSDA(query),
      searchOpenFoodFacts(query),
    ]);

    const usdaItems = usdaResult.status === 'fulfilled' ? usdaResult.value : [];
    const offItems  = offResult.status  === 'fulfilled' ? offResult.value  : [];

    if (usdaResult.status === 'rejected') console.warn('[USDA] failed:', usdaResult.reason?.message);
    if (offResult.status  === 'rejected') console.warn('[OFF] failed:',  offResult.reason?.message);

    console.log(`[food-search] USDA: ${usdaItems.length}, OFF: ${offItems.length}`);

    // Combine (USDA first), deduplicate by lowercase name
    const seen = new Set();
    const combined = [...usdaItems, ...offItems].filter(f => {
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
