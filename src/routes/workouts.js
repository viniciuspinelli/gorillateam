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

// POST /workouts/plans/:planId/groups - add a muscle-group session to a program
router.post('/plans/:planId/groups', workoutController.createWorkoutGroup);

// PUT /workouts/groups/:groupId - rename a muscle-group session
router.put('/groups/:groupId', workoutController.updateWorkoutGroup);

// DELETE /workouts/groups/:groupId - remove a muscle-group session
router.delete('/groups/:groupId', workoutController.deleteWorkoutGroup);

// POST /workouts/groups/:groupId/exercises - add exercise to a muscle-group session
router.post('/groups/:groupId/exercises', workoutController.addExercise);

// PUT /workouts/exercises/:exerciseId - update exercise
router.put('/exercises/:exerciseId', workoutController.updateExercise);

// DELETE /workouts/exercises/:exerciseId - delete exercise
router.delete('/exercises/:exerciseId', workoutController.deleteExercise);

// GET /workouts/groups/:groupId/exercises - get exercises for a muscle-group session (API)
router.get('/groups/:groupId/exercises', workoutController.getExercisesForGroup);

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

// POST /workouts/groups/:groupId/start - start a new session for a muscle-group
router.post('/groups/:groupId/start', workoutController.startWorkout);

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
