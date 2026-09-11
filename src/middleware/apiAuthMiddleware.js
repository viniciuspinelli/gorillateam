/**
 * API Authentication Middleware
 * Verifies the JWT Bearer token issued by /api/auth/login|register and attaches req.user
 */
const jwt = require('jsonwebtoken');

const apiAuthMiddleware = (req, res, next) => {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;

  if (!token) {
    return res.status(401).json({ success: false, message: 'Token de autenticação ausente' });
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET || 'dev-jwt-secret-only');
    req.user = { id: payload.id, username: payload.username, role: payload.role || 'user' };
    next();
  } catch (err) {
    return res.status(401).json({ success: false, message: 'Token inválido ou expirado' });
  }
};

module.exports = apiAuthMiddleware;
