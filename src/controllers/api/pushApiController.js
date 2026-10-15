exports.registerToken = async (req, res, next) => {
  try {
    const { token, platform } = req.body;
    if (!token || typeof token !== 'string') {
      return res.status(400).json({ success: false, message: 'Token é obrigatório' });
    }

    await global.db.query(
      `INSERT INTO "PushToken" ("userId", token, platform)
       VALUES ($1, $2, $3)
       ON CONFLICT (token) DO UPDATE SET "userId" = $1, platform = $3`,
      [req.user.id, token, platform || null]
    );

    res.json({ success: true });
  } catch (err) {
    next(err);
  }
};

exports.unregisterToken = async (req, res, next) => {
  try {
    const { token } = req.body;
    if (!token) {
      return res.status(400).json({ success: false, message: 'Token é obrigatório' });
    }
    await global.db.query('DELETE FROM "PushToken" WHERE token = $1 AND "userId" = $2', [token, req.user.id]);
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
};
