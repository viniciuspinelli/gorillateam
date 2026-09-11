const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');

/**
 * Check if admin already exists
 */
router.get('/admin-existe', async (req, res) => {
  try {
    const result = await global.db.query('SELECT COUNT(*) FROM "User"');
    const count = parseInt(result.rows[0].count);
    
    res.json({ existe: count > 0 });
  } catch (err) {
    console.error('Erro ao verificar admin:', err);
    res.status(500).json({ erro: 'Erro ao verificar admin' });
  }
});

/**
 * Create first admin user
 */
router.post('/setup-admin', async (req, res) => {
  try {
    // 🔒 Verificar se admin já foi criado - prevenir readmissão
    const existingResult = await global.db.query('SELECT COUNT(*) FROM "User"');
    const userCount = parseInt(existingResult.rows[0].count);
    
    if (userCount > 0) {
      return res.status(403).json({
        sucesso: false,
        erro: 'Admin já foi criado. Efetue login para continuar.'
      });
    }
    
    const { username, password, confirmPassword } = req.body;

    // Validate inputs
    if (!username || !password || !confirmPassword) {
      return res.status(400).json({
        sucesso: false,
        erro: 'Usuário, senha e confirmação são obrigatórios'
      });
    }

    // Validate username format (same rules as authController)
    if (username.length < 3 || username.length > 30) {
      return res.status(400).json({ sucesso: false, erro: 'O nome de usuário deve ter entre 3 e 30 caracteres' });
    }
    if (!/^[a-zA-Z0-9_.-]+$/.test(username)) {
      return res.status(400).json({ sucesso: false, erro: 'O nome de usuário só pode conter letras, números, _, . e -' });
    }

    if (password !== confirmPassword) {
      return res.status(400).json({
        sucesso: false,
        erro: 'Senhas não coincidem'
      });
    }

    if (password.length < 8) {
      return res.status(400).json({
        sucesso: false,
        erro: 'Senha deve ter pelo menos 8 caracteres'
      });
    }

    // Check if user already exists
    const existingUser = await global.db.query(
      'SELECT id FROM "User" LIMIT 1'
    );

    if (existingUser.rows.length > 0) {
      return res.status(403).json({
        sucesso: false,
        erro: 'Admin já foi criado anteriormente'
      });
    }

    // Hash password — cost factor 12 (consistent with authController)
    const hashedPassword = await bcrypt.hash(password, 12);

    // Normalize username to lowercase (consistent with authController)
    const safeUsername = username.trim().toLowerCase();

    // Create user
    const result = await global.db.query(
      'INSERT INTO "User" (username, password) VALUES ($1, $2) RETURNING id, username',
      [safeUsername, hashedPassword]
    );

    if (process.env.NODE_ENV !== 'production') {
      console.log('Admin criado:', result.rows[0].username);
    }

    res.json({
      sucesso: true,
      mensagem: 'Admin criado com sucesso!',
      usuario: result.rows[0]
    });
  } catch (err) {
    console.error('Erro ao criar admin:', err);
    res.status(500).json({
      sucesso: false,
      erro: 'Erro ao criar admin'
    });
  }
});

module.exports = router;
