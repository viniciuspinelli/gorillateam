const bcrypt = require('bcrypt');
const crypto = require('crypto');
const nodemailer = require('nodemailer');

/**
 * Display login page
 */
exports.getLogin = (req, res) => {
  // Redirect if already logged in
  if (req.session.user) {
    return res.redirect('/workouts');
  }
  
  // Ensure CSRF token is passed
  const csrfToken = req.csrfToken ? req.csrfToken() : '';
  res.render('auth/login', { 
    title: 'Login',
    csrfToken 
  });
};

/**
 * Handle login submission
 */
exports.postLogin = async (req, res, next) => {
  try {
    const { username, password } = req.body;

    // Validate inputs
    if (!username || !password) {
      const csrfToken = req.csrfToken ? req.csrfToken() : '';
      return res.status(400).render('auth/login', {
        title: 'Login',
        error: 'Usuário e senha são obrigatórios',
        csrfToken
      });
    }

    // Find user by username (case-insensitive)
    const result = await global.db.query(
      'SELECT id, username, password, role FROM "User" WHERE LOWER(username) = LOWER($1)',
      [username]
    );

    const user = result.rows[0];

    if (!user) {
      const csrfToken = req.csrfToken ? req.csrfToken() : '';
      return res.status(401).render('auth/login', {
        title: 'Login',
        error: 'Usuário ou senha inválidos',
        csrfToken
      });
    }

    // Check password
    const passwordMatch = await bcrypt.compare(password, user.password);

    if (!passwordMatch) {
      const csrfToken = req.csrfToken ? req.csrfToken() : '';
      return res.status(401).render('auth/login', {
        title: 'Login',
        error: 'Usuário ou senha inválidos',
        csrfToken
      });
    }

    // Regenerate session ID to prevent session fixation attacks
    const userData = {
      id: user.id,
      username: user.username,
      role: user.role || 'user',
    };

    req.session.regenerate((regenErr) => {
      if (regenErr) {
        console.error('Session regenerate error:', regenErr);
        return res.status(500).render('error', {
          title: 'Erro',
          message: 'Erro ao criar sessão',
        });
      }
      req.session.user = userData;
      req.session.save((err) => {
        if (err) {
          console.error('Session save error:', err);
          return res.status(500).render('error', {
            title: 'Erro',
            message: 'Erro ao criar sessão',
          });
        }
        res.redirect('/workouts');
      });
    });
  } catch (error) {
    console.error('Login error:', error);
    next(error);
  }
};

/**
 * Look up which instructor/admin a registration invite token belongs to.
 * Returns null when the token is missing or doesn't match anyone.
 */
async function findInviter(token) {
  if (!token) return null;
  const result = await global.db.query(
    `SELECT id, username, "fullName" FROM "User" WHERE "inviteToken" = $1 AND role IN ('instructor', 'admin')`,
    [token]
  );
  return result.rows[0] || null;
}
exports.findInviter = findInviter;

/**
 * Display register page. Registration is invite-only: a valid token from an
 * instructor/admin's invite link (src/views/admin/users.ejs) is required.
 */
exports.getRegister = async (req, res, next) => {
  try {
    if (req.session.user) {
      return res.redirect('/workouts');
    }
    const csrfToken = req.csrfToken ? req.csrfToken() : '';
    const token = req.params.token || null;
    const inviter = await findInviter(token);

    res.render('auth/register', {
      title: 'Criar Conta',
      error: null,
      csrfToken,
      token: inviter ? token : null,
      inviterName: inviter ? (inviter.fullName || inviter.username) : null,
      invalidInvite: !inviter,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Handle register submission. Requires a valid invite token; the new user
 * is linked to the inviting instructor/admin via instructorId.
 */
exports.postRegister = async (req, res, next) => {
  try {
    const { username, fullName, password, confirmPassword, email, token } = req.body;
    const csrfToken = req.csrfToken ? req.csrfToken() : '';

    const renderError = (error) => res.status(400).render('auth/register', {
      title: 'Criar Conta',
      error,
      csrfToken,
      token: token || null,
      inviterName: null,
      invalidInvite: false,
    });

    const inviter = await findInviter(token);
    if (!inviter) {
      return res.status(400).render('auth/register', {
        title: 'Criar Conta',
        error: null,
        csrfToken,
        token: null,
        inviterName: null,
        invalidInvite: true,
      });
    }

    if (!username || !fullName || !password || !confirmPassword || !email) {
      return renderError('Todos os campos são obrigatórios');
    }

    if (!fullName.trim()) {
      return renderError('Informe seu nome completo');
    }

    // Validate username length and format
    if (username.length < 3 || username.length > 30) {
      return renderError('O nome de usuário deve ter entre 3 e 30 caracteres');
    }

    if (!/^[a-zA-Z0-9_.-]+$/.test(username)) {
      return renderError('O nome de usuário só pode conter letras, números, _, . e -');
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      return renderError('Informe um e-mail válido');
    }

    if (password !== confirmPassword) {
      return renderError('As senhas não coincidem');
    }

    if (password.length < 8) {
      return renderError('A senha deve ter pelo menos 8 caracteres');
    }

    const safeUsername = username.trim().toLowerCase();

    const existing = await global.db.query(
      'SELECT id FROM "User" WHERE LOWER(username) = $1',
      [safeUsername]
    );

    if (existing.rows.length > 0) {
      return renderError('Nome de usuário já está em uso');
    }

    const safeEmail = email.trim().toLowerCase();
    const emailExists = await global.db.query(
      'SELECT id FROM "User" WHERE LOWER(email) = $1',
      [safeEmail]
    );
    if (emailExists.rows.length > 0) {
      return renderError('Este e-mail já está em uso');
    }

    const hashedPassword = await bcrypt.hash(password, 12);
    const result = await global.db.query(
      'INSERT INTO "User" (username, "fullName", password, role, email, "instructorId") VALUES ($1, $2, $3, $4, $5, $6) RETURNING id, username, role',
      [safeUsername, fullName.trim(), hashedPassword, 'user', safeEmail, inviter.id]
    );

    const user = result.rows[0];

    // Regenerate session ID to prevent session fixation attacks
    const userData = { id: user.id, username: user.username, role: user.role };

    req.session.regenerate((regenErr) => {
      if (regenErr) {
        console.error('Session regenerate error:', regenErr);
        return res.status(500).render('error', {
          title: 'Erro',
          message: 'Erro ao criar sessão',
        });
      }
      req.session.user = userData;
      req.session.save((err) => {
        if (err) {
          console.error('Session save error:', err);
          return res.status(500).render('error', {
            title: 'Erro',
            message: 'Erro ao criar sessão',
          });
        }
        res.redirect('/workouts');
      });
    });
  } catch (error) {
    console.error('Register error:', error);
    next(error);
  }
};

/**
 * Handle logout
 */
exports.getLogout = (req, res, next) => {
  req.session.destroy((err) => {
    if (err) {
      console.error('Session destroy error:', err);
      return next(err);
    }
    res.redirect('/auth/login');
  });
};

exports.postLogout = (req, res, next) => {
  req.session.destroy((err) => {
    if (err) {
      console.error('Session destroy error:', err);
      return next(err);
    }
    res.clearCookie('sid');
    res.redirect('/auth/login');
  });
};

// ========================
// PASSWORD RECOVERY
// ========================

function createMailTransporter() {
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT || '587'),
    secure: process.env.SMTP_SECURE === 'true',
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
}

/**
 * GET /auth/forgot-password
 */
exports.getForgotPassword = (req, res) => {
  if (req.session.user) return res.redirect('/workouts');
  res.render('auth/forgot-password', {
    title: 'Recuperar Senha',
    csrfToken: req.csrfToken ? req.csrfToken() : '',
    success: null,
    error: null,
  });
};

/**
 * POST /auth/forgot-password
 */
exports.postForgotPassword = async (req, res, next) => {
  const csrfToken = req.csrfToken ? req.csrfToken() : '';
  try {
    const { email } = req.body;
    if (!email || !email.trim()) {
      return res.render('auth/forgot-password', {
        title: 'Recuperar Senha',
        csrfToken,
        success: null,
        error: 'Informe o e-mail cadastrado.',
      });
    }

    const safeEmail = email.trim().toLowerCase();
    const result = await global.db.query(
      `SELECT id, username, email FROM "User" WHERE LOWER(email) = $1`,
      [safeEmail]
    );

    // Always show success message to avoid email enumeration
    if (result.rows.length === 0) {
      return res.render('auth/forgot-password', {
        title: 'Recuperar Senha',
        csrfToken,
        success: 'Se esse e-mail estiver cadastrado, você receberá um link para redefinir sua senha.',
        error: null,
      });
    }

    const user = result.rows[0];
    const rawToken = crypto.randomBytes(32).toString('hex');
    const hashedToken = crypto.createHash('sha256').update(rawToken).digest('hex');
    const expiry = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    await global.db.query(
      `UPDATE "User" SET "resetPasswordToken" = $1, "resetPasswordExpiry" = $2 WHERE id = $3`,
      [hashedToken, expiry, user.id]
    );

    const appUrl = process.env.APP_URL || `http://localhost:${process.env.PORT || 3000}`;
    const resetLink = `${appUrl}/auth/reset-password/${rawToken}`;

    const transporter = createMailTransporter();
    await transporter.sendMail({
      from: `"Gorilla.Team" <${process.env.SMTP_USER}>`,
      to: user.email,
      subject: 'Redefinição de Senha — Gorilla.Team',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 520px; margin: auto; background: #1a1a2e; color: #e0e0e0; padding: 32px; border-radius: 12px;">
          <h2 style="color: #F24A00; margin-bottom: 8px;">GORILLA.TEAM</h2>
          <p>Olá, <strong>${user.username}</strong>!</p>
          <p>Recebemos uma solicitação para redefinir a sua senha. Clique no botão abaixo para criar uma nova senha:</p>
          <div style="text-align: center; margin: 32px 0;">
            <a href="${resetLink}" style="background: #ff6b35; color: #fff; padding: 14px 32px; border-radius: 8px; text-decoration: none; font-weight: bold; font-size: 16px;">Redefinir Senha</a>
          </div>
          <p style="font-size: 13px; color: #aaa;">Este link expira em 1 hora. Se você não solicitou a redefinição, ignore este e-mail.</p>
          <p style="font-size: 12px; color: #666;">Ou copie e cole este link no navegador:<br>${resetLink}</p>
        </div>
      `,
    });

    res.render('auth/forgot-password', {
      title: 'Recuperar Senha',
      csrfToken,
      success: 'Se esse e-mail estiver cadastrado, você receberá um link para redefinir sua senha.',
      error: null,
    });
  } catch (err) {
    console.error('Forgot password error:', err);
    next(err);
  }
};

/**
 * GET /auth/reset-password/:token
 */
exports.getResetPassword = async (req, res, next) => {
  try {
    const hashedToken = crypto.createHash('sha256').update(req.params.token).digest('hex');
    const result = await global.db.query(
      `SELECT id FROM "User" WHERE "resetPasswordToken" = $1 AND "resetPasswordExpiry" > NOW()`,
      [hashedToken]
    );
    if (result.rows.length === 0) {
      return res.render('auth/reset-password', {
        title: 'Redefinir Senha',
        csrfToken: req.csrfToken ? req.csrfToken() : '',
        token: null,
        error: 'Link inválido ou expirado. Solicite um novo link.',
        success: null,
      });
    }
    res.render('auth/reset-password', {
      title: 'Redefinir Senha',
      csrfToken: req.csrfToken ? req.csrfToken() : '',
      token: req.params.token,
      error: null,
      success: null,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /auth/reset-password/:token
 */
exports.postResetPassword = async (req, res, next) => {
  const csrfToken = req.csrfToken ? req.csrfToken() : '';
  try {
    const { password, confirmPassword } = req.body;
    const hashedToken = crypto.createHash('sha256').update(req.params.token).digest('hex');

    const result = await global.db.query(
      `SELECT id FROM "User" WHERE "resetPasswordToken" = $1 AND "resetPasswordExpiry" > NOW()`,
      [hashedToken]
    );

    if (result.rows.length === 0) {
      return res.render('auth/reset-password', {
        title: 'Redefinir Senha',
        csrfToken,
        token: null,
        error: 'Link inválido ou expirado. Solicite um novo link.',
        success: null,
      });
    }

    if (!password || password.length < 8) {
      return res.render('auth/reset-password', {
        title: 'Redefinir Senha',
        csrfToken,
        token: req.params.token,
        error: 'A senha deve ter pelo menos 8 caracteres.',
        success: null,
      });
    }

    if (password !== confirmPassword) {
      return res.render('auth/reset-password', {
        title: 'Redefinir Senha',
        csrfToken,
        token: req.params.token,
        error: 'As senhas não coincidem.',
        success: null,
      });
    }

    const hashed = await bcrypt.hash(password, 12);
    await global.db.query(
      `UPDATE "User" SET password = $1, "resetPasswordToken" = NULL, "resetPasswordExpiry" = NULL, "passwordChangedAt" = NOW() WHERE id = $2`,
      [hashed, result.rows[0].id]
    );

    // Invalidate all active sessions for this user to protect against account takeover
    await global.db.query(
      `DELETE FROM session WHERE sess::jsonb -> 'user' ->> 'id' = $1::text`,
      [String(result.rows[0].id)]
    );

    res.render('auth/reset-password', {
      title: 'Redefinir Senha',
      csrfToken,
      token: null,
      error: null,
      success: 'Senha redefinida com sucesso! <a href="/auth/login">Entrar agora</a>',
    });
  } catch (err) {
    next(err);
  }
};
