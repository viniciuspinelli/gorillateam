const bcrypt = require('bcrypt');

exports.getProfile = async (req, res, next) => {
  try {
    const userId = req.session.user.id;
    const result = await global.db.query(
      `SELECT id, username, "fullName", email FROM "User" WHERE id = $1`,
      [userId]
    );
    const profile = result.rows[0];
    if (!profile) return res.redirect('/auth/login');

    res.render('auth/profile', {
      title: 'Meu Perfil',
      csrfToken: req.csrfToken(),
      profile,
      success: null,
      error: null,
    });
  } catch (err) {
    next(err);
  }
};

exports.postProfile = async (req, res, next) => {
  try {
    const userId = req.session.user.id;
    const { fullName, email, currentPassword, newPassword, confirmPassword } = req.body;
    const csrfToken = req.csrfToken();

    const renderError = async (msg, profile) => {
      res.status(400).render('auth/profile', {
        title: 'Meu Perfil',
        csrfToken,
        profile,
        success: null,
        error: msg,
      });
    };

    // Load current user data
    const result = await global.db.query(
      `SELECT id, username, "fullName", email, password FROM "User" WHERE id = $1`,
      [userId]
    );
    const user = result.rows[0];
    if (!user) return res.redirect('/auth/login');

    const currentProfile = { ...user };

    // Validate email
    const safeEmail = (email || '').trim().toLowerCase();
    if (!safeEmail) return renderError('O e-mail é obrigatório.', currentProfile);
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(safeEmail)) return renderError('Informe um e-mail válido.', currentProfile);

    // Check if email is taken by someone else
    const emailConflict = await global.db.query(
      `SELECT id FROM "User" WHERE LOWER(email) = $1 AND id != $2`,
      [safeEmail, userId]
    );
    if (emailConflict.rows.length > 0) return renderError('Este e-mail já está em uso.', currentProfile);

    // Build update
    let hashedPassword = null;
    if (newPassword || currentPassword || confirmPassword) {
      if (!currentPassword) return renderError('Informe sua senha atual para alterá-la.', currentProfile);

      const passwordMatch = await bcrypt.compare(currentPassword, user.password);
      if (!passwordMatch) return renderError('Senha atual incorreta.', currentProfile);

      if (!newPassword || newPassword.length < 8)
        return renderError('A nova senha deve ter pelo menos 8 caracteres.', currentProfile);

      if (newPassword !== confirmPassword)
        return renderError('As novas senhas não coincidem.', currentProfile);

      hashedPassword = await bcrypt.hash(newPassword, 12);
    }

    const safeFullName = (fullName || '').trim() || null;

    if (hashedPassword) {
      await global.db.query(
        `UPDATE "User" SET email = $1, "fullName" = $2, password = $3 WHERE id = $4`,
        [safeEmail, safeFullName, hashedPassword, userId]
      );
      // Invalidate all OTHER active sessions (keeps the current one alive)
      // so compromised sessions on other devices are revoked immediately.
      await global.db.query(
        `DELETE FROM session WHERE sid != $1 AND sess::jsonb -> 'user' ->> 'id' = $2::text`,
        [req.sessionID, String(userId)]
      );
    } else {
      await global.db.query(
        `UPDATE "User" SET email = $1, "fullName" = $2 WHERE id = $3`,
        [safeEmail, safeFullName, userId]
      );
    }

    // Refresh session username (in case fullName changed)
    req.session.user = { ...req.session.user };

    const updatedResult = await global.db.query(
      `SELECT id, username, "fullName", email FROM "User" WHERE id = $1`,
      [userId]
    );

    res.render('auth/profile', {
      title: 'Meu Perfil',
      csrfToken: req.csrfToken(),
      profile: updatedResult.rows[0],
      success: 'Perfil atualizado com sucesso!',
      error: null,
    });
  } catch (err) {
    next(err);
  }
};
