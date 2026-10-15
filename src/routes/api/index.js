const express = require('express');

const authApiController = require('../../controllers/api/authApiController');
const workoutApiController = require('../../controllers/api/workoutApiController');
const dietApiController = require('../../controllers/api/dietApiController');
const shoppingApiController = require('../../controllers/api/shoppingApiController');
const profileApiController = require('../../controllers/api/profileApiController');
const adminApiController = require('../../controllers/api/adminApiController');
const templatesApiController = require('../../controllers/api/templatesApiController');
const pushApiController = require('../../controllers/api/pushApiController');
const apiAuthMiddleware = require('../../middleware/apiAuthMiddleware');
const apiAdminMiddleware = require('../../middleware/apiAdminMiddleware');
const { exerciseImageUpload } = require('../../middleware/uploadMiddleware');
const { loginLimiter, foodSearchLimiter } = require('../../middleware/rateLimiter');

const router = express.Router();

// ========================
// AUTH (público)
// ========================
router.post('/auth/login', loginLimiter, authApiController.login);
router.post('/auth/register', loginLimiter, authApiController.register);
router.get('/auth/me', apiAuthMiddleware, authApiController.me);

// ========================
// ROTAS PROTEGIDAS (requerem token JWT)
// ========================
router.get('/workouts', apiAuthMiddleware, workoutApiController.getWorkouts);
router.post('/workouts/groups/:groupId/start', apiAuthMiddleware, workoutApiController.startWorkout);
router.get('/workouts/history', apiAuthMiddleware, workoutApiController.getHistory);
router.get('/workouts/session/:sessionId', apiAuthMiddleware, workoutApiController.getActiveWorkout);
router.patch('/workouts/session/:sessionId/exercises/:sessionExerciseId/complete', apiAuthMiddleware, workoutApiController.completeExercise);
router.post('/workouts/session/:sessionId/complete', apiAuthMiddleware, workoutApiController.completeWorkout);

router.get('/diet', apiAuthMiddleware, dietApiController.getDiet);
router.post('/diet/plans', apiAuthMiddleware, apiAdminMiddleware, dietApiController.createPlan);
router.post('/diet/plans/:planId/activate', apiAuthMiddleware, dietApiController.activatePlan);
router.patch('/diet/plans/:planId', apiAuthMiddleware, dietApiController.updatePlanName);
router.patch('/diet/plans/:planId/toggle-template', apiAuthMiddleware, apiAdminMiddleware, dietApiController.toggleTemplate);
router.post('/diet/meals', apiAuthMiddleware, apiAdminMiddleware, dietApiController.addMeal);
router.delete('/diet/meals/:mealId', apiAuthMiddleware, apiAdminMiddleware, dietApiController.deleteMeal);
router.post('/diet/meals/:mealId/foods', apiAuthMiddleware, apiAdminMiddleware, dietApiController.addFood);
router.put('/diet/foods/:foodId', apiAuthMiddleware, apiAdminMiddleware, dietApiController.updateFood);
router.delete('/diet/foods/:foodId', apiAuthMiddleware, apiAdminMiddleware, dietApiController.deleteFood);
router.post('/diet/foods/:foodId/options', apiAuthMiddleware, apiAdminMiddleware, dietApiController.addFoodOption);
router.delete('/diet/food-options/:optionId', apiAuthMiddleware, apiAdminMiddleware, dietApiController.deleteFoodOption);
router.get('/diet/food-search', apiAuthMiddleware, apiAdminMiddleware, foodSearchLimiter, dietApiController.searchFood);

router.get('/shopping', apiAuthMiddleware, shoppingApiController.getShopping);
router.post('/shopping/lists', apiAuthMiddleware, shoppingApiController.createList);
router.post('/shopping/lists/:listId/items', apiAuthMiddleware, shoppingApiController.addItem);
router.patch('/shopping/items/:itemId/toggle', apiAuthMiddleware, shoppingApiController.toggleItem);
router.patch('/shopping/items/:itemId', apiAuthMiddleware, shoppingApiController.updateItem);
router.delete('/shopping/items/:itemId', apiAuthMiddleware, shoppingApiController.deleteItem);
router.delete('/shopping/lists/:listId/checked', apiAuthMiddleware, shoppingApiController.clearChecked);
router.post('/shopping/import-from-diet', apiAuthMiddleware, shoppingApiController.importFromDiet);

router.get('/profile', apiAuthMiddleware, profileApiController.getProfile);

router.post('/push/register', apiAuthMiddleware, pushApiController.registerToken);
router.post('/push/unregister', apiAuthMiddleware, pushApiController.unregisterToken);

// ========================
// ADMIN / INSTRUCTOR (requerem token JWT + role admin/instructor)
// ========================
router.get('/admin/dashboard', apiAuthMiddleware, apiAdminMiddleware, adminApiController.getDashboard);
router.get('/admin/users', apiAuthMiddleware, apiAdminMiddleware, adminApiController.getUsers);
router.get('/admin/users/:id', apiAuthMiddleware, apiAdminMiddleware, adminApiController.getUserDetail);
router.post('/admin/users/:id/assign-workout', apiAuthMiddleware, apiAdminMiddleware, adminApiController.assignWorkout);
router.post('/admin/users/:id/assign-diet', apiAuthMiddleware, apiAdminMiddleware, adminApiController.assignDiet);
router.delete('/admin/users/:userId/workouts/:planId', apiAuthMiddleware, apiAdminMiddleware, adminApiController.removeWorkout);
router.delete('/admin/users/:userId/diets/:planId', apiAuthMiddleware, apiAdminMiddleware, adminApiController.removeDiet);

// ========================
// BIBLIOTECA DE TEMPLATES (admin/instrutor)
// ========================
router.get('/templates', apiAuthMiddleware, apiAdminMiddleware, templatesApiController.getTemplates);
router.post('/templates/workouts', apiAuthMiddleware, apiAdminMiddleware, templatesApiController.createWorkoutTemplate);
router.delete('/templates/workouts/:id', apiAuthMiddleware, apiAdminMiddleware, templatesApiController.deleteWorkoutTemplate);
router.post('/templates/diets', apiAuthMiddleware, apiAdminMiddleware, templatesApiController.createDietTemplate);
router.get('/templates/diets/:id/meals', apiAuthMiddleware, apiAdminMiddleware, templatesApiController.getDietTemplateMeals);
router.post('/templates/diets/:id/meals', apiAuthMiddleware, apiAdminMiddleware, templatesApiController.addMeal);
router.delete('/templates/diets/meals/:mealId', apiAuthMiddleware, apiAdminMiddleware, templatesApiController.deleteMeal);
router.post('/templates/diets/meals/:mealId/foods', apiAuthMiddleware, apiAdminMiddleware, templatesApiController.addFood);
router.put('/templates/diets/meals/foods/:foodId', apiAuthMiddleware, apiAdminMiddleware, templatesApiController.updateFood);
router.delete('/templates/diets/meals/foods/:foodId', apiAuthMiddleware, apiAdminMiddleware, templatesApiController.deleteFood);
router.post('/templates/diets/meals/foods/:foodId/options', apiAuthMiddleware, apiAdminMiddleware, templatesApiController.addFoodOption);
router.delete('/templates/diets/meals/foods/options/:optionId', apiAuthMiddleware, apiAdminMiddleware, templatesApiController.deleteFoodOption);
router.delete('/templates/diets/:id', apiAuthMiddleware, apiAdminMiddleware, templatesApiController.deleteDietTemplate);

// Gerenciar planos/exercícios (usado para editar templates de treino)
router.post('/workouts/plans', apiAuthMiddleware, apiAdminMiddleware, workoutApiController.createWorkoutPlan);
router.delete('/workouts/plans/:planId', apiAuthMiddleware, apiAdminMiddleware, workoutApiController.deleteWorkoutPlan);
router.patch('/workouts/plans/:planId/toggle-template', apiAuthMiddleware, apiAdminMiddleware, workoutApiController.toggleTemplate);
router.put('/workouts/plans/:planId', apiAuthMiddleware, apiAdminMiddleware, workoutApiController.updateWorkoutPlan);
router.get('/workouts/plans/:planId/groups', apiAuthMiddleware, apiAdminMiddleware, workoutApiController.getWorkoutGroups);
router.post('/workouts/plans/:planId/groups', apiAuthMiddleware, apiAdminMiddleware, workoutApiController.createWorkoutGroup);
router.put('/workouts/groups/:groupId', apiAuthMiddleware, apiAdminMiddleware, workoutApiController.updateWorkoutGroup);
router.delete('/workouts/groups/:groupId', apiAuthMiddleware, apiAdminMiddleware, workoutApiController.deleteWorkoutGroup);
router.get('/workouts/groups/:groupId/exercises', apiAuthMiddleware, apiAdminMiddleware, workoutApiController.getExercisesForGroup);
router.post('/workouts/groups/:groupId/exercises', apiAuthMiddleware, apiAdminMiddleware, workoutApiController.addExercise);
router.put('/workouts/exercises/:exerciseId', apiAuthMiddleware, apiAdminMiddleware, workoutApiController.updateExercise);
router.delete('/workouts/exercises/:exerciseId', apiAuthMiddleware, apiAdminMiddleware, workoutApiController.deleteExercise);
router.get('/workouts/exercises/:exerciseId/images', apiAuthMiddleware, apiAdminMiddleware, workoutApiController.getExerciseImages);
router.post('/workouts/exercises/:exerciseId/images', apiAuthMiddleware, apiAdminMiddleware, exerciseImageUpload.single('image'), workoutApiController.uploadExerciseImage);
router.delete('/workouts/exercises/:exerciseId/images/:imageId', apiAuthMiddleware, apiAdminMiddleware, workoutApiController.deleteExerciseImage);

module.exports = router;
