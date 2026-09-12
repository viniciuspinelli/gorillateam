// API Auth Controller - Emite/valida tokens JWT para o app mobile (site continua usando sessão)
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { findInviter } = require('../authController');

const TOKEN_EXPIRY = '30d';

function signToken(user) {
  return jwt.sign(
    { id: user.id, username: user.username, role: user.role || 'user' },
    process.env.JWT_SECRET || 'dev-jwt-secret-only',
    { expiresIn: TOKEN_EXPIRY }
  );
}

exports.login = async (req, res, next) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ success: false, message: 'Usuário e senha são obrigatórios' });
    }

    const result = await global.db.query(
      'SELECT id, username, password, role FROM "User" WHERE LOWER(username) = LOWER($1)',
      [username]
    );
    const user = result.rows[0];

    if (!user || !(await bcrypt.compare(password, user.password))) {
      return res.status(401).json({ success: false, message: 'Usuário ou senha inválidos' });
    }

    const token = signToken(user);
    res.json({
      success: true,
      token,
      user: { id: user.id, username: user.username, role: user.role || 'user' },
    });
  } catch (err) {
    next(err);
  }
};

exports.register = async (req, res, next) => {
  try {
    const { username, fullName, password, confirmPassword, email, token: inviteToken } = req.body;

    // Registration is invite-only (mirrors the web flow): a valid token from an
    // instructor/admin's invite link is required, and the new user is linked to
    // that inviter via instructorId.
    const inviter = await findInviter(inviteToken);
    if (!inviter) {
      return res.status(400).json({ success: false, message: 'Link de convite inválido ou ausente. Peça um novo link ao seu instrutor.' });
    }

    if (!username || !fullName || !password || !confirmPassword || !email) {
      return res.status(400).json({ success: false, message: 'Todos os campos são obrigatórios' });
    }
    if (!fullName.trim()) {
      return res.status(400).json({ success: false, message: 'Informe seu nome completo' });
    }
    if (username.length < 3 || username.length > 30) {
      return res.status(400).json({ success: false, message: 'O nome de usuário deve ter entre 3 e 30 caracteres' });
    }
    if (!/^[a-zA-Z0-9_.-]+$/.test(username)) {
      return res.status(400).json({ success: false, message: 'O nome de usuário só pode conter letras, números, _, . e -' });
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      return res.status(400).json({ success: false, message: 'Informe um e-mail válido' });
    }
    if (password !== confirmPassword) {
      return res.status(400).json({ success: false, message: 'As senhas não coincidem' });
    }
    if (password.length < 8) {
      return res.status(400).json({ success: false, message: 'A senha deve ter pelo menos 8 caracteres' });
    }

    const safeUsername = username.trim().toLowerCase();
    const safeEmail = email.trim().toLowerCase();

    const existing = await global.db.query('SELECT id FROM "User" WHERE LOWER(username) = $1', [safeUsername]);
    if (existing.rows.length > 0) {
      return res.status(409).json({ success: false, message: 'Nome de usuário já está em uso' });
    }
    const emailExists = await global.db.query('SELECT id FROM "User" WHERE LOWER(email) = $1', [safeEmail]);
    if (emailExists.rows.length > 0) {
      return res.status(409).json({ success: false, message: 'Este e-mail já está em uso' });
    }

    const hashedPassword = await bcrypt.hash(password, 12);
    const result = await global.db.query(
      'INSERT INTO "User" (username, "fullName", password, role, email, "instructorId") VALUES ($1, $2, $3, $4, $5, $6) RETURNING id, username, role',
      [safeUsername, fullName.trim(), hashedPassword, 'user', safeEmail, inviter.id]
    );
    const user = result.rows[0];
    const token = signToken(user);

    res.status(201).json({
      success: true,
      token,
      user: { id: user.id, username: user.username, role: user.role },
    });
  } catch (err) {
    next(err);
  }
};

exports.me = async (req, res, next) => {
  try {
    const result = await global.db.query(
      'SELECT id, username, "fullName", email, role FROM "User" WHERE id = $1',
      [req.user.id]
    );
    const user = result.rows[0];
    if (!user) return res.status(404).json({ success: false, message: 'Usuário não encontrado' });
    res.json({ success: true, user });
  } catch (err) {
    next(err);
  }
};
