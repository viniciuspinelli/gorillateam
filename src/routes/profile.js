const express = require('express');
const router = express.Router();
const profileController = require('../controllers/profileController');

// GET /profile
router.get('/', profileController.getProfile);

// POST /profile
router.post('/', profileController.postProfile);

module.exports = router;
