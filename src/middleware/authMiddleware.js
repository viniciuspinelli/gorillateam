/**
 * Authentication Middleware
 * Checks if user session exists and redirects to login if not
 */
const authMiddleware = (req, res, next) => {
  if (!req.session.user) {
    return res.redirect('/auth/login');
  }
  next();
};

module.exports = authMiddleware;
