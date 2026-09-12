/**
 * API Authentication Middleware
 * Verifies the JWT Bearer token issued by /api/auth/login|register and attaches req.user
 */
const jwt = require('jsonwebtoken');

const apiAuthMiddleware = async (req, res, next) => {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;

  if (!token) {
    return res.status(401).json({ success: false, message: 'Token de autenticação ausente' });
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET || 'dev-jwt-secret-only', { algorithms: ['HS256'] });

    // Reject tokens issued before the user's last password change/reset,
    // so a leaked JWT doesn't stay valid for up to 30 days after a reset.
    const result = await global.db.query(
      `SELECT "passwordChangedAt" FROM "User" WHERE id = $1`,
      [payload.id]
    );
    const user = result.rows[0];
    if (!user) {
      return res.status(401).json({ success: false, message: 'Token inválido ou expirado' });
    }
    // JWT `iat` has whole-second precision while Postgres NOW() doesn't, and a token
    // signed right after the very query that set passwordChangedAt (login/register)
    // would otherwise look "older" than it — so truncate and allow a small grace window.
    if (user.passwordChangedAt) {
      const passwordChangedAtSec = Math.floor(new Date(user.passwordChangedAt).getTime() / 1000);
      if (payload.iat < passwordChangedAtSec - 2) {
        return res.status(401).json({ success: false, message: 'Sessão expirada, faça login novamente' });
      }
    }

    req.user = { id: payload.id, username: payload.username, role: payload.role || 'user' };
    next();
  } catch (err) {
    return res.status(401).json({ success: false, message: 'Token inválido ou expirado' });
  }
};

module.exports = apiAuthMiddleware;
