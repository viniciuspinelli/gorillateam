const express = require('express');
const authController = require('../controllers/authController');
const { loginLimiter, forgotPasswordLimiter } = require('../middleware/rateLimiter');

const router = express.Router();

// GET /auth/login
router.get('/login', authController.getLogin);

// POST /auth/login
router.post('/login', loginLimiter, authController.postLogin);

// GET /auth/register
router.get('/register', authController.getRegister);

// POST /auth/register
router.post('/register', loginLimiter, authController.postRegister);

// POST /auth/logout (POST para proteção CSRF)
router.post('/logout', authController.postLogout);

// GET /auth/forgot-password
router.get('/forgot-password', authController.getForgotPassword);

// POST /auth/forgot-password
router.post('/forgot-password', forgotPasswordLimiter, authController.postForgotPassword);

// GET /auth/reset-password/:token
router.get('/reset-password/:token', authController.getResetPassword);

// POST /auth/reset-password/:token
router.post('/reset-password/:token', forgotPasswordLimiter, authController.postResetPassword);

module.exports = router;
