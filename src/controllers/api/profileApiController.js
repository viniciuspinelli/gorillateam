// API Profile Controller - versão JSON do perfil (usada pelo app mobile)

exports.getProfile = async (req, res, next) => {
  try {
    const result = await global.db.query(
      `SELECT id, username, "fullName", email FROM "User" WHERE id = $1`,
      [req.user.id]
    );
    const profile = result.rows[0];
    if (!profile) return res.status(404).json({ success: false, message: 'Perfil não encontrado' });
    res.json({ success: true, profile });
  } catch (err) {
    next(err);
  }
};
