const express = require('express');
const shoppingController = require('../controllers/shoppingController');

const router = express.Router();

// GET /shopping - main shopping list page
router.get('/', shoppingController.getShopping);

// POST /shopping/lists - create new shopping list
router.post('/lists', shoppingController.createList);

// POST /shopping/lists/:listId/items - add item to list
router.post('/lists/:listId/items', shoppingController.addItem);

// PATCH /shopping/items/:itemId/toggle - toggle item checked state
router.patch('/items/:itemId/toggle', shoppingController.toggleItem);

// PATCH /shopping/items/:itemId - update item
router.patch('/items/:itemId', shoppingController.updateItem);

// DELETE /shopping/items/:itemId - delete item
router.delete('/items/:itemId', shoppingController.deleteItem);

// DELETE /shopping/lists/:listId/checked - clear checked items
router.delete('/lists/:listId/checked', shoppingController.clearChecked);

// POST /shopping/import-from-diet - import foods from active meal plan
router.post('/import-from-diet', shoppingController.importFromDiet);

module.exports = router;
