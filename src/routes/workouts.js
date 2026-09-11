const express = require('express');
const workoutController = require('../controllers/workoutController');
const { exerciseImageUpload } = require('../middleware/uploadMiddleware');

const router = express.Router();

// ========================
// WORKOUT MANAGEMENT
// ========================

// GET /workouts/plans - manage workout plans
router.get('/plans', workoutController.getWorkoutPlans);

// POST /workouts/plans - create new workout plan
router.post('/plans', workoutController.createWorkoutPlan);

// PUT /workouts/plans/:planId - update workout plan
router.put('/plans/:planId', workoutController.updateWorkoutPlan);

// DELETE /workouts/plans/:planId - delete workout plan
router.delete('/plans/:planId', workoutController.deleteWorkoutPlan);

// POST /workouts/plans/:planId/exercises - add exercise
router.post('/plans/:planId/exercises', workoutController.addExercise);

// PUT /workouts/exercises/:exerciseId - update exercise
router.put('/exercises/:exerciseId', workoutController.updateExercise);

// DELETE /workouts/exercises/:exerciseId - delete exercise
router.delete('/exercises/:exerciseId', workoutController.deleteExercise);

// GET /workouts/plans/:planId/exercises - get exercises for plan (API)
router.get('/plans/:planId/exercises', workoutController.getExercisesForPlan);

// GET /workouts/exercises/:exerciseId/images - list exercise images
router.get('/exercises/:exerciseId/images', workoutController.listExerciseImages);

// POST /workouts/exercises/:exerciseId/images - upload exercise image
router.post(
	'/exercises/:exerciseId/images',
	exerciseImageUpload.single('image'),
	workoutController.uploadExerciseImage
);

// DELETE /workouts/exercises/:exerciseId/images/:imageId - remove exercise image
router.delete('/exercises/:exerciseId/images/:imageId', workoutController.deleteExerciseImage);

// PATCH /workouts/plans/:planId/toggle-template - toggle template flag (admin)
router.patch('/plans/:planId/toggle-template', workoutController.toggleTemplate);

// ========================
// WORKOUT EXECUTION
// ========================

// GET /workouts - list all active workouts
router.get('/', workoutController.getWorkouts);

// POST /workouts/:id/start - start a new workout session
router.post('/:id/start', workoutController.startWorkout);

// GET /workouts/session/:sessionId - active workout page
router.get('/session/:sessionId', workoutController.getActiveWorkout);

// PATCH /workouts/session/:sessionId/exercise/:exerciseId/complete - mark exercise done
router.patch('/session/:sessionId/exercise/:exerciseId/complete', workoutController.completeExercise);

// POST /workouts/session/:sessionId/complete - complete workout
router.post('/session/:sessionId/complete', workoutController.completeWorkout);

// GET /workouts/history - workout history
router.get('/history', workoutController.getHistory);

// DELETE /workouts/session/:sessionId - delete a session
router.delete('/session/:sessionId', workoutController.deleteSession);

module.exports = router;
