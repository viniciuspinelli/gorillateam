/**
 * Admin Middleware
 * Ensures the user is authenticated and has the 'admin' or 'instructor' role
 */
const adminMiddleware = (req, res, next) => {
  if (!req.session.user) {
    return res.redirect('/auth/login');
  }
  if (req.session.user.role !== 'admin' && req.session.user.role !== 'instructor') {
    return res.status(403).render('error', {
      title: 'Acesso Negado',
      message: 'Você não tem permissão para acessar esta área.',
      error: { status: 403 },
    });
  }
  next();
};

module.exports = adminMiddleware;
