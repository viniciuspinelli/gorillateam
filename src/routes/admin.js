const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');

// Dashboard
router.get('/', adminController.getDashboard);

// User management
router.get('/users', adminController.getUsers);
router.get('/users/new', adminController.getCreateUser);
router.post('/users/new', adminController.postCreateUser);
router.get('/users/:id/edit', adminController.getEditUser);
router.post('/users/:id/edit', adminController.postEditUser);
router.delete('/users/:id', adminController.deleteUser);
router.get('/users/:id', adminController.getUserDetail);

// Assign / remove plans from users
router.post('/users/:id/assign-workout', adminController.assignWorkout);
router.post('/users/:id/assign-diet', adminController.assignDiet);
router.delete('/users/:userId/workouts/:planId', adminController.removeWorkout);
router.delete('/users/:userId/diets/:planId', adminController.removeDiet);

// Template library
router.get('/templates', adminController.getTemplates);
router.post('/templates/workouts', adminController.createWorkoutTemplate);
router.post('/templates/diets', adminController.createDietTemplate);
router.get('/templates/diets/:id/meals', adminController.getDietTemplateMeals);
router.delete('/templates/workouts/:id', adminController.deleteWorkoutTemplate);
router.delete('/templates/diets/:id', adminController.deleteDietTemplate);

module.exports = router;
