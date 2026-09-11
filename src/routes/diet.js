const express = require('express');
const dietController = require('../controllers/dietController');
const { foodSearchLimiter } = require('../middleware/rateLimiter');

const router = express.Router();

// GET /diet - main diet page
router.get('/', dietController.getDiet);

// POST /diet/plans - create new meal plan
router.post('/plans', dietController.createMealPlan);

// POST /diet/plans/:planId/activate - activate a meal plan
router.post('/plans/:planId/activate', dietController.activateMealPlan);

// PATCH /diet/plans/:planId - update meal plan name
router.patch('/plans/:planId', dietController.updateMealPlanName);

// POST /diet/meals - add a meal
router.post('/meals', dietController.addMeal);

// DELETE /diet/meals/:mealId - delete a meal
router.delete('/meals/:mealId', dietController.deleteMeal);

// POST /diet/meals/:mealId/foods - add food to meal
router.post('/meals/:mealId/foods', dietController.addFood);

// DELETE /diet/foods/:foodId - delete a food
router.delete('/foods/:foodId', dietController.deleteFood);

// PATCH /diet/plans/:planId/toggle-template - toggle template flag (admin)
router.patch('/plans/:planId/toggle-template', dietController.toggleTemplate);

// GET /diet/food-search - search food nutrition (admin only, rate limited)
router.get('/food-search', foodSearchLimiter, dietController.searchFood);

module.exports = router;
