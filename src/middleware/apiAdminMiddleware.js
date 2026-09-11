// API Admin Middleware - requer role admin ou instructor (equivalente a adminMiddleware.js)
module.exports = (req, res, next) => {
  if (!req.user || (req.user.role !== 'admin' && req.user.role !== 'instructor')) {
    return res.status(403).json({ success: false, message: 'Você não tem permissão para acessar esta área.' });
  }
  next();
};
