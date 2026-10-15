require('dotenv').config();
const express = require('express');
const helmet = require('helmet');
const crypto = require('crypto');
const session = require('express-session');
const pgSession = require('connect-pg-simple')(session);
const csrf = require('csurf');
const morgan = require('morgan');
const { Pool } = require('pg');
const path = require('path');
const bcrypt = require('bcrypt');

const authRoutes = require('./src/routes/auth');
const setupRoutes = require('./src/routes/setup');
const workoutRoutes = require('./src/routes/workouts');
const dietRoutes = require('./src/routes/diet');
const shoppingRoutes = require('./src/routes/shopping');
const adminRoutes = require('./src/routes/admin');
const profileRoutes = require('./src/routes/profile');
const bodyRoutes = require('./src/routes/body');
const authMiddleware = require('./src/middleware/authMiddleware');
const adminMiddleware = require('./src/middleware/adminMiddleware');
const { mountStorageStatic } = require('./src/services/storage');
const apiRoutes = require('./src/routes/api');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

// Cache-busting query param for static CSS, based on the file's own mtime,
// so a deploy invalidates browsers' cached style.css without manual versioning.
try {
  app.locals.cssVersion = fs.statSync(path.join(__dirname, 'src', 'public', 'css', 'style.css')).mtimeMs;
} catch {
  app.locals.cssVersion = Date.now();
}
app.locals.formatSetsReps = require('./src/public/js/setsReps').format;

// Trust proxy — Render termina TLS no balanceador (1 hop)
app.set('trust proxy', 1);

// Gerar nonce por requisição (usado pelo Helmet CSP e pelas views)
app.use((req, res, next) => {
  res.locals.nonce = crypto.randomBytes(16).toString('base64');
  next();
});

// Security headers
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", (req, res) => `'nonce-${res.locals.nonce}'`],
      // TODO: remover 'unsafe-inline' abaixo quando os onclick/onsubmit inline das views forem migrados para JS externo
      scriptSrcAttr: ["'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      imgSrc: ["'self'", "data:"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      connectSrc: ["'self'"],
      frameSrc: ["'none'"],
      objectSrc: ["'none'"],
    },
  },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true,
  },
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
}));

// Database Pool
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: true } : false
});

// Make pool globally available for routes
global.db = pool;

// Auto-migrate: add email + password reset columns if missing
pool.query(`
  ALTER TABLE "User"
    ADD COLUMN IF NOT EXISTS email VARCHAR(255),
    ADD COLUMN IF NOT EXISTS "resetPasswordToken" VARCHAR(255),
    ADD COLUMN IF NOT EXISTS "resetPasswordExpiry" TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS "fullName" VARCHAR(255)
`).catch(err => console.error('Migration error:', err.message));

// Auto-migrate: add instructor support (role update + instructorId FK)
pool.query(`
  ALTER TABLE "User"
    ADD COLUMN IF NOT EXISTS "instructorId" INTEGER REFERENCES "User"(id) ON DELETE SET NULL
`).catch(err => console.error('Migration instructor error:', err.message));

// Auto-migrate: WorkoutSession.userId was missing ON DELETE CASCADE, which blocked
// deleting any user who had ever started/completed a workout (FK violation).
pool.query(`
  ALTER TABLE "WorkoutSession" DROP CONSTRAINT IF EXISTS "WorkoutSession_userId_fkey"
`).then(() => pool.query(`
  ALTER TABLE "WorkoutSession" ADD CONSTRAINT "WorkoutSession_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"(id) ON DELETE CASCADE
`)).catch(err => console.error('Migration WorkoutSession cascade error:', err.message));

// Auto-migrate: add invite token support (instructors/admins invite students via a shareable link)
pool.query(`
  ALTER TABLE "User"
    ADD COLUMN IF NOT EXISTS "inviteToken" VARCHAR(64)
`).then(() => pool.query(`
  CREATE UNIQUE INDEX IF NOT EXISTS "user_invite_token_idx" ON "User" ("inviteToken") WHERE "inviteToken" IS NOT NULL
`)).catch(err => console.error('Migration invite token error:', err.message));

// ========================
// MIDDLEWARE
// ========================

// Logger (reset-password redacted para evitar vazamento de tokens)
app.use(morgan('combined', {
  skip: (req) => req.path.startsWith('/auth/reset-password'),
}));
app.use('/auth/reset-password', morgan(':method /auth/reset-password/[REDACTED] :status :response-time ms'));

// Body parsing
app.use(express.urlencoded({ extended: false }));
app.use(express.json());

// Static files
app.use(express.static(path.join(__dirname, 'src', 'public')));
mountStorageStatic(app);

// Serve Chart.js's UMD build ourselves (used by the weight-evolution graph) so
// the strict script-src 'self' CSP doesn't need a CDN exception.
app.get('/vendor/chart.min.js', (req, res) => {
  res.sendFile(path.join(__dirname, 'node_modules', 'chart.js', 'dist', 'chart.umd.min.js'));
});

// Falha imediata se SESSION_SECRET não estiver definida em produção
if (process.env.NODE_ENV === 'production' && !process.env.SESSION_SECRET) {
  console.error('FATAL: SESSION_SECRET não definida em produção');
  process.exit(1);
}

// Falha imediata se JWT_SECRET não estiver definida em produção (usada pela API mobile)
if (process.env.NODE_ENV === 'production' && !process.env.JWT_SECRET) {
  console.error('FATAL: JWT_SECRET não definida em produção');
  process.exit(1);
}

// Session configuration
app.use(
  session({
    store: new pgSession({
      conString: process.env.DATABASE_URL,
      tableName: 'session',
      createTableIfMissing: true,
      pruneSessionInterval: 60 * 15,
    }),
    name: 'sid',
    secret: process.env.SESSION_SECRET || 'dev-secret-only',
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: process.env.NODE_ENV === 'production',
      httpOnly: true,
      sameSite: 'strict',
      maxAge: 8 * 60 * 60 * 1000, // 8 horas
    },
  })
);

// CSRF protection setup
const csrfProtection = csrf({ cookie: false });

app.use((req, res, next) => {
  // /api usa autenticação por token (JWT), sem cookies de sessão: CSRF não se aplica
  if (req.path.startsWith('/setup') || req.path.startsWith('/api')) {
    return next();
  }
  csrfProtection(req, res, next);
});

// EJS view engine with layouts support
const expressEjsLayouts = require('express-ejs-layouts');
app.use(expressEjsLayouts);
app.set('layout', 'layouts/main');
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'src', 'views'));

// Global response data middleware (after CSRF so token is available)
app.use((req, res, next) => {
  res.locals.user = req.session.user || null;
  res.locals.csrfToken = (req.path.startsWith('/setup') || req.path.startsWith('/api')) ? '' : req.csrfToken();
  next();
});

// ========================
// ROUTES
// ========================

// Health check endpoint (sem auth, sem CSRF)
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok' });
});

// Setup route (NO CSRF protection - skip via error handling)
app.post('/setup/setup-admin', async (req, res) => {
  try {
    const existingResult = await global.db.query('SELECT COUNT(*) FROM "User"');
    const userCount = parseInt(existingResult.rows[0].count);

    if (userCount > 0) {
      return res.status(403).json({ sucesso: false, erro: 'Admin já foi criado. Efetue login para continuar.' });
    }

    const { username, password, confirmPassword } = req.body;

    if (!username || !password || !confirmPassword) {
      return res.status(400).json({ sucesso: false, erro: 'Usuário, senha e confirmação são obrigatórios' });
    }

    if (username.length < 3 || username.length > 30) {
      return res.status(400).json({ sucesso: false, erro: 'O nome de usuário deve ter entre 3 e 30 caracteres' });
    }
    if (!/^[a-zA-Z0-9_.-]+$/.test(username)) {
      return res.status(400).json({ sucesso: false, erro: 'O nome de usuário só pode conter letras, números, _, . e -' });
    }

    if (password !== confirmPassword) {
      return res.status(400).json({ sucesso: false, erro: 'Senhas não coincidem' });
    }

    if (password.length < 8) {
      return res.status(400).json({ sucesso: false, erro: 'Senha deve ter pelo menos 8 caracteres' });
    }

    const existingUser = await global.db.query('SELECT id FROM "User" LIMIT 1');
    if (existingUser.rows.length > 0) {
      return res.status(403).json({ sucesso: false, erro: 'Admin já foi criado anteriormente' });
    }

    const hashedPassword = await bcrypt.hash(password, 12);
    const safeUsername = username.trim().toLowerCase();

    const result = await global.db.query(
      'INSERT INTO "User" (username, password) VALUES ($1, $2) RETURNING id, username',
      [safeUsername, hashedPassword]
    );

    res.json({ sucesso: true, mensagem: 'Admin criado com sucesso!', usuario: result.rows[0] });
  } catch (err) {
    console.error('Erro ao criar admin:', err);
    res.status(500).json({ sucesso: false, erro: 'Erro ao criar admin' });
  }
});

app.get('/setup/admin-existe', async (req, res) => {
  try {
    const result = await global.db.query('SELECT COUNT(*) FROM "User"');
    const count = parseInt(result.rows[0].count);
    res.json({ existe: count > 0 });
  } catch (err) {
    console.error('Erro ao verificar admin:', err);
    res.status(500).json({ erro: 'Erro ao verificar admin' });
  }
});

app.use('/setup', setupRoutes);

// Serve setup page - proteção contra readmissão
app.get('/setup', async (req, res, next) => {
  try {
    // Verificar se admin já existe
    const result = await global.db.query('SELECT COUNT(*) FROM "User"');
    const userCount = parseInt(result.rows[0].count);
    
    // Se usuário já existe, redirecionar para login
    if (userCount > 0) {
      return res.redirect('/auth/login');
    }
    
    res.sendFile(path.join(__dirname, 'src', 'public', 'setup.html'));
  } catch (err) {
    console.error('Error checking setup:', err);
    next(err);
  }
});

// Public routes (CSRF already applied)
app.use('/auth', authRoutes);

// JSON API (autenticação via JWT) — usada pelo app mobile, roda em paralelo ao site EJS
app.use('/api', apiRoutes);

// Redirect root to workouts (or landing page if not authenticated)
app.get('/', async (req, res) => {
  try {
    // Check if any users exist (first-run setup)
    const result = await global.db.query('SELECT COUNT(*) FROM "User"');
    const userCount = parseInt(result.rows[0].count);

    if (userCount === 0) {
      // No users yet, go to setup
      return res.redirect('/setup');
    }

    // Logged-in users go to their dashboard
    if (req.session.user) {
      return res.redirect('/workouts');
    }

    // Show landing page for visitors
    res.render('landing', {
      layout: 'layouts/landing',
      title: 'Mais que atletas, uma família',
    });
  } catch (err) {
    console.error('Erro ao verificar usuários:', err);
    res.redirect('/auth/login');
  }
});

// Protected routes (require authentication)
app.use('/workouts', authMiddleware, workoutRoutes);
app.use('/diet', authMiddleware, dietRoutes);
app.use('/shopping', authMiddleware, shoppingRoutes);
app.use('/admin', authMiddleware, adminMiddleware, adminRoutes);
app.use('/profile', authMiddleware, profileRoutes);
app.use('/body', authMiddleware, bodyRoutes);
app.get('/design-test', authMiddleware, (req, res) => {
  res.render('design-test', { layout: false });
});

// ========================
// ERROR HANDLING
// ========================

// 404 handler
app.use((req, res) => {
  res.status(404).render('error', {
    title: 'Erro 404',
    message: 'Página não encontrada',
    error: { status: 404 },
  });
});

// Global error handler
app.use((err, req, res, next) => {
  // Allow CSRF errors for setup routes (they don't require CSRF token)
  if (err.code === 'EBADCSRFTOKEN' && req.path.startsWith('/setup')) {
    return next();
  }

  // A bad CSRF token on the auth forms usually means the login/register POST
  // was submitted twice (e.g. a double tap on mobile): session.regenerate()
  // on the first request invalidates the token embedded in the page before
  // the second request is validated. Rather than showing a raw 403 page,
  // recover gracefully: if the user actually ended up logged in (the other
  // request won the race), send them home; otherwise bounce back to a fresh
  // copy of the form so they can just retry.
  if (err.code === 'EBADCSRFTOKEN' && req.path.startsWith('/auth/')) {
    if (req.session && req.session.user) {
      return res.redirect('/workouts');
    }
    return res.redirect(req.path);
  }

  if (err.name === 'MulterError' || /Formato de imagem não suportado/.test(err.message || '')) {
    const status = err.code === 'LIMIT_FILE_SIZE' ? 413 : 400;
    const message = err.code === 'LIMIT_FILE_SIZE'
      ? 'Imagem excede o tamanho máximo permitido.'
      : (err.message || 'Erro no upload da imagem.');

    if (req.accepts('json') && !req.accepts('html')) {
      return res.status(status).json({
        success: false,
        message,
      });
    }

    return res.status(status).render('error', {
      title: 'Erro de Upload',
      message,
      error: {},
    });
  }

  const status = err.status || err.statusCode || 500;
  const isProduction = process.env.NODE_ENV === 'production';

  // In production, hide internal details from 5xx errors to prevent
  // information leakage (table names, column names, stack traces).
  const message = isProduction && status >= 500
    ? 'Erro interno do servidor'
    : (err.message || 'Erro interno do servidor');

  console.error(`[${new Date().toISOString()}] Error:`, err);

  // For API requests, return JSON
  if (req.accepts('json') && !req.accepts('html')) {
    return res.status(status).json({
      success: false,
      message,
    });
  }

  // For HTML requests, render error page
  res.status(status).render('error', {
    title: 'Erro',
    message,
    error: isProduction ? {} : err,
  });
});

// ========================
// START SERVER
// ========================

async function initializeDatabase() {
  const client = await pool.connect();
  try {
    console.log('🔄 Inicializando banco de dados...');
    
    // Create tables if they don't exist
    await client.query(`
      CREATE TABLE IF NOT EXISTS "User" (
        id SERIAL PRIMARY KEY,
        username VARCHAR(255) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        role VARCHAR(20) DEFAULT 'user',
        "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS "WorkoutPlan" (
        id SERIAL PRIMARY KEY,
        "userId" INTEGER REFERENCES "User"(id) ON DELETE CASCADE,
        name VARCHAR(255) NOT NULL,
        description TEXT,
        "dayOfWeek" VARCHAR(50),
        "order" INTEGER DEFAULT 0,
        "isActive" BOOLEAN DEFAULT true,
        "isTemplate" BOOLEAN DEFAULT false,
        "expiresAt" TIMESTAMP,
        "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Migration: add userId column to existing WorkoutPlan table
    await client.query(`
      ALTER TABLE "WorkoutPlan" ADD COLUMN IF NOT EXISTS
        "userId" INTEGER REFERENCES "User"(id) ON DELETE CASCADE;
    `);

    // Migration: add isTemplate column to WorkoutPlan (MealPlan migration runs after MealPlan exists)
    await client.query(`ALTER TABLE IF EXISTS "WorkoutPlan" ADD COLUMN IF NOT EXISTS "isTemplate" BOOLEAN DEFAULT false;`);

    // Migration: add expiresAt column, so an assigned workout can carry a validity
    // date after which the student is expected to ask their instructor for a new plan.
    await client.query(`ALTER TABLE IF EXISTS "WorkoutPlan" ADD COLUMN IF NOT EXISTS "expiresAt" TIMESTAMP;`);

    // Migration: add role column to User
    await client.query(`ALTER TABLE "User" ADD COLUMN IF NOT EXISTS role VARCHAR(20) DEFAULT 'user';`);
    // NOTE: Privilege elevation via hardcoded username was removed (security fix).
    // The first admin is created through /setup on first run.

    // Migration: track when the password last changed, so mobile JWTs issued
    // before a reset/change can be rejected even though they haven't expired yet.
    await client.query(`ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "passwordChangedAt" TIMESTAMP DEFAULT NOW();`);

    await client.query(`
      CREATE TABLE IF NOT EXISTS "Exercise" (
        id SERIAL PRIMARY KEY,
        "workoutPlanId" INTEGER NOT NULL REFERENCES "WorkoutPlan"(id) ON DELETE CASCADE,
        name VARCHAR(255) NOT NULL,
        sets INTEGER NOT NULL,
        reps VARCHAR(50) NOT NULL,
        weight VARCHAR(50),
        "restSeconds" INTEGER,
        notes TEXT,
        "order" INTEGER DEFAULT 0
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS "WorkoutExerciseImage" (
        id SERIAL PRIMARY KEY,
        "exerciseId" INTEGER NOT NULL REFERENCES "Exercise"(id) ON DELETE CASCADE,
        "createdBy" INTEGER REFERENCES "User"(id) ON DELETE SET NULL,
        "storageProvider" VARCHAR(50) NOT NULL DEFAULT 'local',
        "storageKey" TEXT NOT NULL,
        "publicUrl" TEXT NOT NULL,
        "fileName" VARCHAR(255),
        "mimeType" VARCHAR(100) NOT NULL,
        "sizeBytes" INTEGER,
        "sortOrder" INTEGER DEFAULT 0,
        "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await client.query(
      'CREATE INDEX IF NOT EXISTS "WorkoutExerciseImage_exerciseId_idx" ON "WorkoutExerciseImage" ("exerciseId");'
    );

    await client.query(`
      CREATE TABLE IF NOT EXISTS "WorkoutSession" (
        id SERIAL PRIMARY KEY,
        "userId" INTEGER NOT NULL REFERENCES "User"(id),
        "workoutPlanId" INTEGER NOT NULL REFERENCES "WorkoutPlan"(id),
        "startedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        "completedAt" TIMESTAMP,
        "isCompleted" BOOLEAN DEFAULT false,
        "durationMin" INTEGER,
        notes TEXT
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS "SessionExercise" (
        id SERIAL PRIMARY KEY,
        "workoutSessionId" INTEGER NOT NULL REFERENCES "WorkoutSession"(id) ON DELETE CASCADE,
        "exerciseId" INTEGER NOT NULL REFERENCES "Exercise"(id),
        "isCompleted" BOOLEAN DEFAULT false,
        "completedAt" TIMESTAMP,
        "actualSets" INTEGER,
        "actualReps" VARCHAR(50),
        "actualWeight" VARCHAR(50),
        notes TEXT
      );
    `);

    // Muscle-group sessions within a workout program (e.g. "Hipertrofia 1" contains
    // "Peito e Tríceps", "Costas e Bíceps", "Pernas"). Exercises belong to a group;
    // assigning the parent WorkoutPlan to a student deep-copies every group inside it.
    await client.query(`
      CREATE TABLE IF NOT EXISTS "WorkoutGroup" (
        id SERIAL PRIMARY KEY,
        "workoutPlanId" INTEGER NOT NULL REFERENCES "WorkoutPlan"(id) ON DELETE CASCADE,
        name VARCHAR(255) NOT NULL,
        "order" INTEGER DEFAULT 0,
        "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await client.query(`ALTER TABLE "Exercise" ADD COLUMN IF NOT EXISTS "workoutGroupId" INTEGER REFERENCES "WorkoutGroup"(id) ON DELETE CASCADE;`);
    await client.query(`ALTER TABLE "WorkoutSession" ADD COLUMN IF NOT EXISTS "workoutGroupId" INTEGER REFERENCES "WorkoutGroup"(id) ON DELETE SET NULL;`);
    // reps guarda uma lista por série quando o exercício mistura repetições (ex: "20 / 8 / 8")
    await client.query(`ALTER TABLE "Exercise" ALTER COLUMN reps TYPE VARCHAR(200);`);

    // Backfill: every pre-existing WorkoutPlan gets one default group holding its
    // existing exercises/sessions, so nothing created before this feature breaks.
    await client.query(`
      INSERT INTO "WorkoutGroup" ("workoutPlanId", name, "order")
      SELECT wp.id, COALESCE(NULLIF(wp."dayOfWeek", ''), 'Treino Único'), 0
      FROM "WorkoutPlan" wp
      WHERE NOT EXISTS (SELECT 1 FROM "WorkoutGroup" wg WHERE wg."workoutPlanId" = wp.id);
    `);
    await client.query(`
      UPDATE "Exercise" e
      SET "workoutGroupId" = wg.id
      FROM "WorkoutGroup" wg
      WHERE e."workoutGroupId" IS NULL AND wg."workoutPlanId" = e."workoutPlanId" AND wg."order" = 0;
    `);
    await client.query(`
      UPDATE "WorkoutSession" ws
      SET "workoutGroupId" = wg.id
      FROM "WorkoutGroup" wg
      WHERE ws."workoutGroupId" IS NULL AND wg."workoutPlanId" = ws."workoutPlanId" AND wg."order" = 0;
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS "MealPlan" (
        id SERIAL PRIMARY KEY,
        "userId" INTEGER REFERENCES "User"(id) ON DELETE CASCADE,
        name VARCHAR(255) NOT NULL,
        "isActive" BOOLEAN DEFAULT false,
        "isTemplate" BOOLEAN DEFAULT false,
        "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Migration: ensure existing MealPlan tables have isTemplate column
    await client.query(`ALTER TABLE IF EXISTS "MealPlan" ADD COLUMN IF NOT EXISTS "isTemplate" BOOLEAN DEFAULT false;`);

    // Migration: add userId column to existing MealPlan table
    await client.query(`
      ALTER TABLE "MealPlan" ADD COLUMN IF NOT EXISTS
        "userId" INTEGER REFERENCES "User"(id) ON DELETE CASCADE;
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS "Meal" (
        id SERIAL PRIMARY KEY,
        "mealPlanId" INTEGER NOT NULL REFERENCES "MealPlan"(id) ON DELETE CASCADE,
        name VARCHAR(255) NOT NULL,
        time VARCHAR(50),
        "order" INTEGER DEFAULT 0
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS "MealFood" (
        id SERIAL PRIMARY KEY,
        "mealId" INTEGER NOT NULL REFERENCES "Meal"(id) ON DELETE CASCADE,
        name VARCHAR(255) NOT NULL,
        quantity VARCHAR(255) NOT NULL,
        calories INTEGER,
        protein DECIMAL(10, 2),
        carbs DECIMAL(10, 2),
        fat DECIMAL(10, 2),
        notes TEXT,
        "order" INTEGER DEFAULT 0
      );
    `);

    // Substitute options for a MealFood (e.g. the main food is "Frango grelhado
    // 120g"; options let the student swap it for "Patinho 115g" or "Tilápia 150g").
    // Purely informational — only the parent MealFood counts toward meal totals.
    await client.query(`
      CREATE TABLE IF NOT EXISTS "MealFoodOption" (
        id SERIAL PRIMARY KEY,
        "mealFoodId" INTEGER NOT NULL REFERENCES "MealFood"(id) ON DELETE CASCADE,
        name VARCHAR(255) NOT NULL,
        quantity VARCHAR(255),
        calories INTEGER,
        protein DECIMAL(10, 2),
        carbs DECIMAL(10, 2),
        fat DECIMAL(10, 2),
        "order" INTEGER DEFAULT 0,
        "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS "ShoppingList" (
        id SERIAL PRIMARY KEY,
        "userId" INTEGER REFERENCES "User"(id) ON DELETE CASCADE,
        name VARCHAR(255) DEFAULT 'Lista de Compras',
        "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Migration: add userId column to existing ShoppingList table
    await client.query(`
      ALTER TABLE "ShoppingList" ADD COLUMN IF NOT EXISTS
        "userId" INTEGER REFERENCES "User"(id) ON DELETE CASCADE;
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS "ShoppingItem" (
        id SERIAL PRIMARY KEY,
        "shoppingListId" INTEGER NOT NULL REFERENCES "ShoppingList"(id) ON DELETE CASCADE,
        name VARCHAR(255) NOT NULL,
        quantity VARCHAR(255),
        category VARCHAR(100),
        "isChecked" BOOLEAN DEFAULT false,
        notes TEXT,
        "order" INTEGER DEFAULT 0
      );
    `);

    // Expo push tokens for the mobile app — one row per device, so a user can be
    // signed in on multiple phones and still receive pushes on all of them.
    await client.query(`
      CREATE TABLE IF NOT EXISTS "PushToken" (
        id SERIAL PRIMARY KEY,
        "userId" INTEGER NOT NULL REFERENCES "User"(id) ON DELETE CASCADE,
        token VARCHAR(255) NOT NULL UNIQUE,
        platform VARCHAR(20),
        "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Instructor's reply to a student's workout feedback
    await client.query(`
      ALTER TABLE "WorkoutSession"
        ADD COLUMN IF NOT EXISTS "instructorReply" TEXT,
        ADD COLUMN IF NOT EXISTS "instructorReplyAt" TIMESTAMP
    `);

    // Body weight log ("Minha Evolução") — one entry per user per day; logging
    // again on the same day updates it instead of creating a duplicate point.
    await client.query(`
      CREATE TABLE IF NOT EXISTS "BodyWeightLog" (
        id SERIAL PRIMARY KEY,
        "userId" INTEGER NOT NULL REFERENCES "User"(id) ON DELETE CASCADE,
        weight DECIMAL(5, 2) NOT NULL,
        "recordedAt" DATE NOT NULL DEFAULT CURRENT_DATE,
        "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE ("userId", "recordedAt")
      );
    `);

    // Progress photos the student uploads periodically (as requested by their
    // instructor) — mirrors WorkoutExerciseImage's storage-provider pattern.
    await client.query(`
      CREATE TABLE IF NOT EXISTS "ProgressPhoto" (
        id SERIAL PRIMARY KEY,
        "userId" INTEGER NOT NULL REFERENCES "User"(id) ON DELETE CASCADE,
        "storageProvider" VARCHAR(50) NOT NULL DEFAULT 'local',
        "storageKey" TEXT NOT NULL,
        "publicUrl" TEXT NOT NULL,
        "fileName" VARCHAR(255),
        "mimeType" VARCHAR(100) NOT NULL,
        "sizeBytes" INTEGER,
        "takenAt" DATE NOT NULL DEFAULT CURRENT_DATE,
        "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await client.query(
      'CREATE INDEX IF NOT EXISTS "ProgressPhoto_userId_idx" ON "ProgressPhoto" ("userId");'
    );

    console.log('✅ Tabelas criadas/verificadas com sucesso!');
  } catch (err) {
    console.error('❌ Erro ao criar tabelas:', err.message);
    // Continue anyway - tables might already exist
  } finally {
    client.release();
  }
}

// ========================
// DIET SEED
// ========================

const DIET_SEED = {
  name: 'Dieta Ganho de Massa - Vinicius',
  meals: [
    {
      name: 'Refeição 1',
      time: null,
      order: 1,
      foods: [
        { name: 'Ovo inteiro', quantity: '2 unidades', calories: 143, protein: 12.6, carbs: 0.7, fat: 9.9 },
        { name: 'Pão de forma integral', quantity: '50g (2 fatias)', calories: 127, protein: 4.6, carbs: 23.0, fat: 1.8 },
        { name: 'Banana', quantity: '100g', calories: 89, protein: 1.1, carbs: 23.0, fat: 0.3 },
        { name: 'Mamão', quantity: '100g', calories: 43, protein: 0.5, carbs: 10.8, fat: 0.3 },
        { name: 'Aveia', quantity: '40g', calories: 155, protein: 5.6, carbs: 27.0, fat: 2.8 },
      ],
    },
    {
      name: 'Refeição 2',
      time: null,
      order: 2,
      foods: [
        { name: 'Arroz branco', quantity: '250g', calories: 325, protein: 6.0, carbs: 71.5, fat: 0.5 },
        { name: 'Feijão', quantity: '80g', calories: 77, protein: 4.8, carbs: 13.7, fat: 0.5 },
        { name: 'Cenoura', quantity: '100g', calories: 41, protein: 0.9, carbs: 9.6, fat: 0.2 },
        { name: 'Frango/Patinho/Filé suíno/Tilápia', quantity: '120g / 115g / 150g / 170g', calories: 185, protein: 35.0, carbs: 0, fat: 4.0 },
        { name: 'Salada', quantity: 'à vontade', calories: 0, protein: 0, carbs: 0, fat: 0 },
      ],
    },
    {
      name: 'Refeição 3',
      time: null,
      order: 3,
      foods: [
        { name: 'Tapioca', quantity: '70g', calories: 243, protein: 0.3, carbs: 60.0, fat: 0.1 },
        { name: 'Frango desfiado ou Patinho', quantity: '40g / 35g', calories: 65, protein: 12.3, carbs: 0, fat: 1.5 },
        { name: 'Queijo muçarela', quantity: '1 fatia', calories: 72, protein: 5.0, carbs: 0.6, fat: 5.5 },
        { name: 'Tomate', quantity: 'à vontade', calories: 0, protein: 0, carbs: 0, fat: 0 },
        { name: 'Alface', quantity: 'à vontade', calories: 0, protein: 0, carbs: 0, fat: 0 },
      ],
    },
    {
      name: 'Refeição 4',
      time: null,
      order: 4,
      foods: [
        { name: 'Arroz branco', quantity: '200g', calories: 260, protein: 4.8, carbs: 57.2, fat: 0.4 },
        { name: 'Cenoura', quantity: '100g', calories: 41, protein: 0.9, carbs: 9.6, fat: 0.2 },
        { name: 'Frango/Patinho/Filé suíno/Tilápia', quantity: '120g / 115g / 150g / 170g', calories: 185, protein: 35.0, carbs: 0, fat: 4.0 },
      ],
    },
    {
      name: 'Refeição 5',
      time: null,
      order: 5,
      foods: [],
    },
    {
      name: 'Refeição 6',
      time: null,
      order: 6,
      foods: [],
    },
  ],
};

async function seedDiet() {
  const client = await pool.connect();
  try {
    console.log('🥗 Verificando seed de dieta...');

    // Check if plan already exists
    const existing = await client.query(
      'SELECT id FROM "MealPlan" WHERE name = $1',
      [DIET_SEED.name]
    );

    if (existing.rows.length > 0) {
      console.log(`  ✔ Plano de dieta já existe: "${DIET_SEED.name}"`);
      return;
    }

    // Create the meal plan (active)
    const planResult = await client.query(
      `INSERT INTO "MealPlan" (name, "isActive") VALUES ($1, true) RETURNING id`,
      [DIET_SEED.name]
    );
    const planId = planResult.rows[0].id;
    console.log(`  ✅ Plano de dieta criado: "${DIET_SEED.name}"`);

    for (const meal of DIET_SEED.meals) {
      const mealResult = await client.query(
        `INSERT INTO "Meal" ("mealPlanId", name, time, "order") VALUES ($1, $2, $3, $4) RETURNING id`,
        [planId, meal.name, meal.time, meal.order]
      );
      const mealId = mealResult.rows[0].id;

      let foodOrder = 0;
      for (const food of meal.foods) {
        foodOrder += 1;
        await client.query(
          `INSERT INTO "MealFood" ("mealId", name, quantity, calories, protein, carbs, fat, "order")
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
          [mealId, food.name, food.quantity, food.calories, food.protein, food.carbs, food.fat, foodOrder]
        );
        console.log(`    ➕ ${meal.name} → "${food.name}" (${food.quantity})`);
      }
    }

    console.log('✅ Seed de dieta concluído!');
  } catch (err) {
    console.error('⚠️ Erro no seed de dieta:', err.message);
  } finally {
    client.release();
  }
}

// ========================
// WORKOUT SEED
// ========================

const REST_SECONDS = 45;

const WORKOUT_SEED = [
  {
    name: 'Peito e Biceps',
    description: 'Treino de peito e bíceps | 45s descanso',
    order: 1,
    exercises: [
      { name: 'Supino inclinado c/ halter + Crucifixo inclinado', sets: 4, reps: '10', notes: null },
      { name: 'Supino Reto', sets: 4, reps: '12 / 10 / 10 / 8', notes: 'Progressão de carga' },
      { name: 'Peck Deck', sets: 4, reps: '15 / 10 / 10 / 10', notes: null },
      { name: 'Pullover', sets: 3, reps: '15', notes: null },
      { name: 'Crossover', sets: 4, reps: '10', notes: null },
      { name: 'Circuito: Rosca simultânea + Rosca martelo + Rosca no banco', sets: 3, reps: '10', notes: null },
      { name: 'Abdominal + 20min aeróbico', sets: 1, reps: '-', notes: 'Finalização do treino' },
    ],
  },
  {
    name: 'Costas e Triceps',
    description: 'Treino de costas e tríceps | 45s descanso',
    order: 2,
    exercises: [
      { name: 'Flexão na barra fixa ou Graviton', sets: 4, reps: 'RM', notes: null },
      { name: 'Remada curvada c/ barra pegada pronada', sets: 4, reps: '10', notes: null },
      { name: 'Puxador articulado', sets: 4, reps: '10', notes: null },
      { name: 'Remada unilateral', sets: 4, reps: '10', notes: null },
      { name: 'Puxador frente pegada supinada (largura dos ombros)', sets: 4, reps: '10', notes: null },
      { name: 'Circuito: Testa c/ barra + Coice c/ halter + Francês', sets: 3, reps: '10', notes: null },
      { name: 'Abdominal + 20min aeróbico', sets: 1, reps: '-', notes: 'Finalização do treino' },
    ],
  },
  {
    name: 'Ombro e Perna',
    description: 'Treino de ombro e perna | 45s descanso',
    order: 3,
    exercises: [
      { name: 'Desenvolvimento c/ halter', sets: 4, reps: '15 / 12 / 10 / drop', notes: 'Progressão de carga' },
      { name: 'Elevação frontal c/ halteres pegada supinada', sets: 4, reps: '10', notes: null },
      { name: 'Elevação lateral c/ halteres', sets: 4, reps: 'RM + 10 parciais', notes: null },
      { name: 'Remada alta no cross c/ corda', sets: 4, reps: '10', notes: null },
      { name: 'Cadeira extensora', sets: 3, reps: '20', notes: null },
      { name: 'Agachamento Smith', sets: 4, reps: '12', notes: null },
      { name: 'Leg 45 + Agachamento livre', sets: 4, reps: '10', notes: null },
      { name: 'Cadeira flexora', sets: 4, reps: '12', notes: null },
      { name: 'Stiff', sets: 4, reps: '10', notes: null },
      { name: 'Cadeira adutora + Abdutora', sets: 4, reps: '15', notes: null },
    ],
  },
];

async function seedWorkouts() {
  const client = await pool.connect();
  try {
    console.log('🌱 Verificando seed de treinos...');

    for (const workout of WORKOUT_SEED) {
      // Find or create plan
      const existing = await client.query(
        'SELECT id FROM "WorkoutPlan" WHERE name = $1',
        [workout.name]
      );

      let planId;
      if (existing.rows.length > 0) {
        planId = existing.rows[0].id;
      } else {
        const ins = await client.query(
          `INSERT INTO "WorkoutPlan" (name, description, "isActive", "order")
           VALUES ($1, $2, true, $3) RETURNING id`,
          [workout.name, workout.description, workout.order]
        );
        planId = ins.rows[0].id;
        console.log(`  ✅ Plano criado: "${workout.name}"`);
      }

      // Get current max order for exercises in this plan
      const maxOrd = await client.query(
        'SELECT COALESCE(MAX("order"), 0) AS mo FROM "Exercise" WHERE "workoutPlanId" = $1',
        [planId]
      );
      let ord = parseInt(maxOrd.rows[0].mo, 10);

      for (const ex of workout.exercises) {
        const exExists = await client.query(
          'SELECT id FROM "Exercise" WHERE "workoutPlanId" = $1 AND name = $2',
          [planId, ex.name]
        );
        if (exExists.rows.length > 0) continue;

        ord += 1;
        await client.query(
          `INSERT INTO "Exercise" ("workoutPlanId", name, sets, reps, "restSeconds", notes, "order")
           VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [planId, ex.name, ex.sets, ex.reps, REST_SECONDS, ex.notes, ord]
        );
        console.log(`    ➕ "${ex.name}" (${ex.sets}x${ex.reps}, ${REST_SECONDS}s)`);
      }
    }

    console.log('✅ Seed de treinos concluído!');
  } catch (err) {
    console.error('⚠️ Erro no seed de treinos:', err.message);
    // Non-fatal: app continues
  } finally {
    client.release();
  }
}

// Start server
async function start() {
  try {
    await initializeDatabase();
    
    app.listen(PORT, () => {
      console.log(`🚀 Gorilla.Team app running on http://localhost:${PORT}`);
      console.log(`📊 Environment: ${process.env.NODE_ENV || 'development'}`);
    });
  } catch (error) {
    console.error('❌ Erro ao iniciar aplicação:', error);
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('\n⛔ Shutting down...');
  pool.end(() => {
    console.log('database connection closed');
    process.exit(0);
  });
});

start();

module.exports = app;
