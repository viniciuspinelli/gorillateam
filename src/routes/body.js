const express = require('express');
const router = express.Router();
const bodyController = require('../controllers/bodyController');
const { exerciseImageUpload } = require('../middleware/uploadMiddleware');

router.get('/evolution', bodyController.getEvolution);

router.post('/weight', bodyController.addWeight);
router.delete('/weight/:id', bodyController.deleteWeight);

router.post('/photos', exerciseImageUpload.single('photo'), bodyController.uploadPhoto);
router.delete('/photos/:id', bodyController.deletePhoto);

module.exports = router;
