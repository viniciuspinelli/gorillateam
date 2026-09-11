// API Shopping Controller - versão JSON da lista de compras (usada pelo app mobile)

exports.getShopping = async (req, res, next) => {
  try {
    const userId = req.user.id;

    const requestedListId = req.query.listId ? Number.parseInt(req.query.listId, 10) : null;
    let listResult = requestedListId
      ? await global.db.query(
        `SELECT id, name, "createdAt" FROM "ShoppingList" WHERE id = $1 AND "userId" = $2`,
        [requestedListId, userId]
      )
      : await global.db.query(
        `SELECT id, name, "createdAt" FROM "ShoppingList" WHERE "userId" = $1 ORDER BY "createdAt" DESC LIMIT 1`,
        [userId]
      );
    let list = listResult.rows[0];

    if (!list) {
      const createResult = await global.db.query(
        `INSERT INTO "ShoppingList" ("userId", name, "createdAt") VALUES ($1, $2, NOW()) RETURNING *`,
        [userId, 'Lista de Compras']
      );
      list = createResult.rows[0];
    }

    const itemsResult = await global.db.query(
      `SELECT id, name, quantity, category, "isChecked", "order" FROM "ShoppingItem" WHERE "shoppingListId" = $1 ORDER BY "order" ASC`,
      [list.id]
    );

    const itemsByCategory = {};
    let totalItems = 0;
    let checkedItems = 0;

    itemsResult.rows.forEach((item) => {
      const category = item.category || 'Outros';
      if (!itemsByCategory[category]) itemsByCategory[category] = [];
      itemsByCategory[category].push(item);
      totalItems++;
      if (item.isChecked) checkedItems++;
    });

    const allListsResult = await global.db.query(
      `SELECT id, name, "createdAt" FROM "ShoppingList" WHERE "userId" = $1 ORDER BY "createdAt" DESC`,
      [userId]
    );

    res.json({
      success: true,
      list,
      itemsByCategory,
      allLists: allListsResult.rows,
      totalItems,
      checkedItems,
    });
  } catch (error) {
    next(error);
  }
};

exports.toggleItem = async (req, res, next) => {
  try {
    const { itemId } = req.params;
    const userId = req.user.id;

    const itemResult = await global.db.query(
      `SELECT si."isChecked" FROM "ShoppingItem" si
       JOIN "ShoppingList" sl ON si."shoppingListId" = sl.id
       WHERE si.id = $1 AND sl."userId" = $2`,
      [parseInt(itemId, 10), userId]
    );
    if (itemResult.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Item não encontrado' });
    }

    const result = await global.db.query(
      `UPDATE "ShoppingItem" SET "isChecked" = $1 WHERE id = $2 RETURNING *`,
      [!itemResult.rows[0].isChecked, parseInt(itemId, 10)]
    );

    res.json({ success: true, item: result.rows[0] });
  } catch (error) {
    next(error);
  }
};

exports.updateItem = async (req, res, next) => {
  try {
    const itemId = Number.parseInt(req.params.itemId, 10);
    if (!Number.isInteger(itemId) || itemId <= 0) {
      return res.status(400).json({ success: false, message: 'Item inválido' });
    }

    const allowedFields = ['name', 'quantity', 'category', 'notes'];
    const updates = [];
    const values = [];

    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        if (req.body[field] !== null && typeof req.body[field] !== 'string') {
          return res.status(400).json({ success: false, message: `${field} deve ser texto` });
        }
        updates.push(`"${field}" = $${values.length + 1}`);
        values.push(req.body[field] === null ? null : (req.body[field].trim() || null));
      }
    }

    if (updates.length === 0) {
      return res.status(400).json({ success: false, message: 'Nenhum campo para atualizar' });
    }
    if (req.body.name !== undefined && (!req.body.name || !req.body.name.trim())) {
      return res.status(400).json({ success: false, message: 'O nome do item é obrigatório' });
    }

    const ownerCheck = await global.db.query(
      `SELECT si.id FROM "ShoppingItem" si
       JOIN "ShoppingList" sl ON si."shoppingListId" = sl.id
       WHERE si.id = $1 AND sl."userId" = $2`,
      [itemId, req.user.id]
    );
    if (ownerCheck.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Item não encontrado' });
    }

    values.push(itemId);
    const result = await global.db.query(
      `UPDATE "ShoppingItem" SET ${updates.join(', ')} WHERE id = $${values.length} RETURNING *`,
      values
    );

    res.json({ success: true, item: result.rows[0] });
  } catch (error) {
    next(error);
  }
};

exports.createList = async (req, res, next) => {
  try {
    const name = typeof req.body.name === 'string' && req.body.name.trim()
      ? req.body.name.trim()
      : 'Lista de Compras';
    const result = await global.db.query(
      `INSERT INTO "ShoppingList" ("userId", name, "createdAt") VALUES ($1, $2, NOW()) RETURNING *`,
      [req.user.id, name]
    );
    res.status(201).json({ success: true, list: result.rows[0] });
  } catch (error) {
    next(error);
  }
};

exports.addItem = async (req, res, next) => {
  try {
    const listId = Number.parseInt(req.params.listId, 10);
    const { name, quantity, category, notes } = req.body;
    if (!Number.isInteger(listId) || listId <= 0) {
      return res.status(400).json({ success: false, message: 'Lista inválida' });
    }
    if (typeof name !== 'string' || !name.trim()) {
      return res.status(400).json({ success: false, message: 'Nome é obrigatório' });
    }

    const listCheck = await global.db.query(
      `SELECT id FROM "ShoppingList" WHERE id = $1 AND "userId" = $2`,
      [listId, req.user.id]
    );
    if (listCheck.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Lista não encontrada' });
    }

    const result = await global.db.query(
      `INSERT INTO "ShoppingItem" ("shoppingListId", name, quantity, category, notes, "isChecked", "createdAt")
       VALUES ($1, $2, $3, $4, $5, false, NOW()) RETURNING *`,
      [listId, name.trim(), typeof quantity === 'string' ? quantity.trim() || null : null,
        typeof category === 'string' ? category.trim() || 'Outros' : 'Outros',
        typeof notes === 'string' ? notes.trim() || null : null]
    );
    res.status(201).json({ success: true, item: result.rows[0] });
  } catch (error) {
    next(error);
  }
};

exports.deleteItem = async (req, res, next) => {
  try {
    const itemId = Number.parseInt(req.params.itemId, 10);
    const result = await global.db.query(
      `DELETE FROM "ShoppingItem" si USING "ShoppingList" sl
       WHERE si.id = $1 AND si."shoppingListId" = sl.id AND sl."userId" = $2 RETURNING si.id`,
      [itemId, req.user.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Item não encontrado' });
    }
    res.json({ success: true });
  } catch (error) {
    next(error);
  }
};

exports.clearChecked = async (req, res, next) => {
  try {
    const listId = Number.parseInt(req.params.listId, 10);
    const listCheck = await global.db.query(
      `SELECT id FROM "ShoppingList" WHERE id = $1 AND "userId" = $2`,
      [listId, req.user.id]
    );
    if (listCheck.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Lista não encontrada' });
    }
    const result = await global.db.query(
      `DELETE FROM "ShoppingItem" WHERE "shoppingListId" = $1 AND "isChecked" = true RETURNING id`,
      [listId]
    );
    res.json({ success: true, removed: result.rowCount });
  } catch (error) {
    next(error);
  }
};

exports.importFromDiet = async (req, res, next) => {
  try {
    const listId = req.body.listId ? Number.parseInt(req.body.listId, 10) : null;
    if (listId) {
      const listCheck = await global.db.query(
        `SELECT id FROM "ShoppingList" WHERE id = $1 AND "userId" = $2`,
        [listId, req.user.id]
      );
      if (listCheck.rows.length === 0) {
        return res.status(404).json({ success: false, message: 'Lista não encontrada' });
      }
    }

    const planResult = await global.db.query(
      `SELECT id FROM "MealPlan" WHERE "isActive" = true AND "userId" = $1 LIMIT 1`,
      [req.user.id]
    );
    if (planResult.rows.length === 0) {
      return res.status(400).json({ success: false, message: 'Nenhum plano de dieta ativo' });
    }

    let targetListId = listId;
    if (!targetListId) {
      const listResult = await global.db.query(
        `SELECT id FROM "ShoppingList" WHERE "userId" = $1 ORDER BY "createdAt" DESC LIMIT 1`,
        [req.user.id]
      );
      if (listResult.rows.length > 0) targetListId = listResult.rows[0].id;
    }
    if (!targetListId) {
      const createResult = await global.db.query(
        `INSERT INTO "ShoppingList" ("userId", name, "createdAt") VALUES ($1, $2, NOW()) RETURNING id`,
        [req.user.id, 'Lista de Compras']
      );
      targetListId = createResult.rows[0].id;
    }

    const foodsResult = await global.db.query(
      `SELECT f.name, f.quantity FROM "MealFood" f
       JOIN "Meal" m ON f."mealId" = m.id WHERE m."mealPlanId" = $1`,
      [planResult.rows[0].id]
    );
    const foodMap = new Map();
    for (const food of foodsResult.rows) {
      const key = food.name.trim().toLowerCase();
      const match = String(food.quantity || '').match(/^([\d.]+)\s*(.*)$/);
      const current = foodMap.get(key);
      if (!current) {
        foodMap.set(key, { name: food.name, quantity: food.quantity, num: match ? Number(match[1]) : NaN, unit: match ? match[2].trim() : '' });
      } else if (match && !Number.isNaN(current.num)) {
        current.num += Number(match[1]);
      }
    }

    const importedItems = [];
    for (const food of foodMap.values()) {
      const quantity = Number.isNaN(food.num) ? food.quantity : `${Math.round(food.num * 70) / 10}${food.unit}`;
      const result = await global.db.query(
        `INSERT INTO "ShoppingItem" ("shoppingListId", name, quantity, category, "isChecked")
         VALUES ($1, $2, $3, 'Outros', false) RETURNING *`,
        [targetListId, food.name, quantity]
      );
      importedItems.push(result.rows[0]);
    }
    res.json({ success: true, importedItems, count: importedItems.length });
  } catch (error) {
    next(error);
  }
};
