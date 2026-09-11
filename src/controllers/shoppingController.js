// Shopping Controller - Using global.db (pg Pool)

/**
 * Get shopping list page
 */
exports.getShopping = async (req, res, next) => {
  try {
    const userId = req.session.user.id;

    // Get the most recent shopping list for this user
    let listResult = await global.db.query(
      `SELECT id, name, "createdAt" FROM "ShoppingList" WHERE "userId" = $1 ORDER BY "createdAt" DESC LIMIT 1`,
      [userId]
    );

    let list = listResult.rows[0];

    // If no list exists, create one for this user
    if (!list) {
      const createResult = await global.db.query(
        `INSERT INTO "ShoppingList" ("userId", name, "createdAt")
         VALUES ($1, $2, NOW())
         RETURNING *`,
        [userId, 'Lista de Compras']
      );
      list = createResult.rows[0];
    }

    // Get items for this list
    const itemsResult = await global.db.query(
      `SELECT id, name, quantity, category, "isChecked", "order"
       FROM "ShoppingItem"
       WHERE "shoppingListId" = $1
       ORDER BY "order" ASC`,
      [list.id]
    );

    // Group items by category
    const itemsByCategory = {};
    let totalItems = 0;
    let checkedItems = 0;

    itemsResult.rows.forEach(item => {
      const category = item.category || 'Outros';
      if (!itemsByCategory[category]) {
        itemsByCategory[category] = [];
      }
      itemsByCategory[category].push(item);
      totalItems++;
      if (item.isChecked) checkedItems++;
    });

    // Get all lists for this user for switching
    const allListsResult = await global.db.query(
      `SELECT id, name, "createdAt" FROM "ShoppingList" WHERE "userId" = $1 ORDER BY "createdAt" DESC`,
      [userId]
    );

    res.render('shopping/index', {
      title: 'Lista de Compras',
      list,
      itemsByCategory,
      allLists: allListsResult.rows,
      totalItems,
      checkedItems,
    });
  } catch (error) {
    console.error('Error fetching shopping list:', error);
    next(error);
  }
};

/**
 * Create a new shopping list
 */
exports.createList = async (req, res, next) => {
  try {
    const userId = req.session.user.id;

    const result = await global.db.query(
      `INSERT INTO "ShoppingList" ("userId", name, "createdAt")
       VALUES ($1, $2, NOW())
       RETURNING *`,
      [userId, 'Lista de Compras']
    );

    res.json({ success: true, list: result.rows[0] });
  } catch (error) {
    console.error('Error creating shopping list:', error);
    next(error);
  }
};

/**
 * Add item to shopping list
 */
exports.addItem = async (req, res, next) => {
  try {
    const { shoppingListId, name, quantity, category, notes } = req.body;
    const userId = req.session.user.id;

    if (!name) {
      return res.status(400).json({ success: false, message: 'Nome é obrigatório' });
    }

    // Verify list belongs to user
    const listCheck = await global.db.query(
      'SELECT id FROM "ShoppingList" WHERE id = $1 AND "userId" = $2',
      [parseInt(shoppingListId), userId]
    );
    if (listCheck.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Lista não encontrada' });
    }

    const result = await global.db.query(
      `INSERT INTO "ShoppingItem" ("shoppingListId", name, quantity, category, notes, "isChecked", "createdAt")
       VALUES ($1, $2, $3, $4, $5, false, NOW())
       RETURNING *`,
      [parseInt(shoppingListId), name, quantity || null, category || 'Outros', notes || null]
    );

    res.json({ success: true, item: result.rows[0] });
  } catch (error) {
    console.error('Error adding item:', error);
    next(error);
  }
};

/**
 * Toggle item checked state
 */
exports.toggleItem = async (req, res, next) => {
  try {
    const { itemId } = req.params;
    const userId = req.session.user.id;

    // Verify item belongs to user's list
    const itemResult = await global.db.query(
      `SELECT si."isChecked" FROM "ShoppingItem" si
       JOIN "ShoppingList" sl ON si."shoppingListId" = sl.id
       WHERE si.id = $1 AND sl."userId" = $2`,
      [parseInt(itemId), userId]
    );

    if (itemResult.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Item não encontrado' });
    }

    const currentState = itemResult.rows[0].isChecked;

    const result = await global.db.query(
      `UPDATE "ShoppingItem" SET "isChecked" = $1 WHERE id = $2 RETURNING *`,
      [!currentState, parseInt(itemId)]
    );

    res.json({ success: true, item: result.rows[0] });
  } catch (error) {
    console.error('Error toggling item:', error);
    next(error);
  }
};

/**
 * Update item
 */
exports.updateItem = async (req, res, next) => {
  try {
    const { itemId } = req.params;
    const { name, quantity, category, notes } = req.body;
    const userId = req.session.user.id;

    // Verify item belongs to user's list
    const ownerCheck = await global.db.query(
      `SELECT si.id FROM "ShoppingItem" si
       JOIN "ShoppingList" sl ON si."shoppingListId" = sl.id
       WHERE si.id = $1 AND sl."userId" = $2`,
      [parseInt(itemId), userId]
    );
    if (ownerCheck.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Item não encontrado' });
    }

    // Build dynamic update query
    const updates = [];
    const values = [];
    let paramCount = 1;

    if (name !== undefined) {
      updates.push(`name = $${paramCount++}`);
      values.push(name);
    }
    if (quantity !== undefined) {
      updates.push(`quantity = $${paramCount++}`);
      values.push(quantity);
    }
    if (category !== undefined) {
      updates.push(`category = $${paramCount++}`);
      values.push(category);
    }
    if (notes !== undefined) {
      updates.push(`notes = $${paramCount++}`);
      values.push(notes);
    }

    if (updates.length === 0) {
      return res.status(400).json({ success: false, message: 'Nenhum campo para atualizar' });
    }

    values.push(parseInt(itemId));

    const result = await global.db.query(
      `UPDATE "ShoppingItem" SET ${updates.join(', ')} WHERE id = $${paramCount} RETURNING *`,
      values
    );

    res.json({ success: true, item: result.rows[0] });
  } catch (error) {
    console.error('Error updating item:', error);
    next(error);
  }
};

/**
 * Delete item from shopping list
 */
exports.deleteItem = async (req, res, next) => {
  try {
    const { itemId } = req.params;
    const userId = req.session.user.id;

    // Verify item belongs to user's list
    const ownerCheck = await global.db.query(
      `SELECT si.id FROM "ShoppingItem" si
       JOIN "ShoppingList" sl ON si."shoppingListId" = sl.id
       WHERE si.id = $1 AND sl."userId" = $2`,
      [parseInt(itemId), userId]
    );
    if (ownerCheck.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Item não encontrado' });
    }

    await global.db.query(
      `DELETE FROM "ShoppingItem" WHERE id = $1`,
      [parseInt(itemId)]
    );

    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting item:', error);
    next(error);
  }
};

/**
 * Clear all checked items
 */
exports.clearChecked = async (req, res, next) => {
  try {
    const { listId } = req.params;
    const userId = req.session.user.id;

    // Verify list belongs to user
    const listCheck = await global.db.query(
      'SELECT id FROM "ShoppingList" WHERE id = $1 AND "userId" = $2',
      [parseInt(listId), userId]
    );
    if (listCheck.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Lista não encontrada' });
    }

    await global.db.query(
      `DELETE FROM "ShoppingItem" WHERE "shoppingListId" = $1 AND "isChecked" = true`,
      [parseInt(listId)]
    );

    res.json({ success: true });
  } catch (error) {
    console.error('Error clearing checked items:', error);
    next(error);
  }
};

/**
 * Import foods from active meal plan
 */
exports.importFromDiet = async (req, res, next) => {
  try {
    const userId = req.session.user.id;

    // Get active meal plan for this user
    const planResult = await global.db.query(
      `SELECT id FROM "MealPlan" WHERE "isActive" = true AND "userId" = $1 LIMIT 1`,
      [userId]
    );

    if (planResult.rows.length === 0) {
      return res.status(400).json({ success: false, message: 'Nenhum plano de dieta ativo' });
    }

    const planId = planResult.rows[0].id;

    // Get the most recent shopping list for this user
    let listResult = await global.db.query(
      `SELECT id FROM "ShoppingList" WHERE "userId" = $1 ORDER BY "createdAt" DESC LIMIT 1`,
      [userId]
    );

    let listId;
    if (listResult.rows.length === 0) {
      const createResult = await global.db.query(
        `INSERT INTO "ShoppingList" ("userId", name, "createdAt")
         VALUES ($1, $2, NOW())
         RETURNING id`,
        [userId, 'Lista de Compras']
      );
      listId = createResult.rows[0].id;
    } else {
      listId = listResult.rows[0].id;
    }

    // Get all foods from active plan's meals, grouped by name
    // Sum quantities of the same food appearing in multiple meals
    const foodsResult = await global.db.query(
      `SELECT f.name, f.quantity
       FROM "MealFood" f
       JOIN "Meal" m ON f."mealId" = m.id
       WHERE m."mealPlanId" = $1`,
      [planId]
    );

    // Group by food name: sum numeric quantities, preserve unit
    // quantity is stored as e.g. "150g", "1 porção", "À vontade"
    const foodMap = new Map();

    function parseQty(str) {
      if (!str) return { num: NaN, unit: '' };
      const match = String(str).match(/^([\d.]+)\s*(.*)$/);
      if (match) return { num: parseFloat(match[1]), unit: match[2].trim() };
      return { num: NaN, unit: str.trim() };
    }

    for (const food of foodsResult.rows) {
      const key = food.name.trim().toLowerCase();
      const parsed = parseQty(food.quantity);
      if (!foodMap.has(key)) {
        foodMap.set(key, { name: food.name, num: parsed.num, unit: parsed.unit, rawQty: food.quantity });
      } else {
        const existing = foodMap.get(key);
        if (!isNaN(existing.num) && !isNaN(parsed.num)) {
          existing.num = existing.num + parsed.num;
        }
        // If not numeric, keep as-is
      }
    }

    // Multiply numeric quantities by 7 (one week)
    const DAYS = 7;
    const weekFoods = Array.from(foodMap.values()).map(food => {
      if (!isNaN(food.num)) {
        const weekQty = Math.round(food.num * DAYS * 10) / 10;
        // Re-attach unit: "1050g", "7 porção", etc.
        return { name: food.name, quantity: food.unit ? `${weekQty}${food.unit}` : String(weekQty) };
      }
      // Non-numeric (e.g. "À vontade"): keep original
      return { name: food.name, quantity: food.rawQty };
    });

    // Create shopping items from weekly totals
    const importedItems = [];
    for (const food of weekFoods) {
      const result = await global.db.query(
        `INSERT INTO "ShoppingItem" ("shoppingListId", name, quantity, category, "isChecked")
         VALUES ($1, $2, $3, $4, false)
         RETURNING *`,
        [listId, food.name, food.quantity, 'Outros']
      );
      importedItems.push(result.rows[0]);
    }

    res.json({ success: true, importedItems, count: importedItems.length });
  } catch (error) {
    console.error('Error importing from diet:', error);
    next(error);
  }
};
