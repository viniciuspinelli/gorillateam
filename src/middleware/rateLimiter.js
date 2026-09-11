const rateLimit = require('express-rate-limit');

/**
 * Rate limiter para tentativas de login e registro.
 * 10 tentativas por IP em 15 minutos.
 * Não conta requisições bem-sucedidas.
 */
exports.loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: 'Muitas tentativas. Tente novamente em 15 minutos.',
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true,
});

/**
 * Rate limiter para recuperação de senha.
 * 5 requisições por IP em 1 hora.
 */
exports.forgotPasswordLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  message: 'Muitas solicitações de recuperação. Tente novamente em 1 hora.',
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * Rate limiter para busca de alimentos (USDA/OpenFoodFacts).
 * Protege cotas das APIs externas e previne abuso por IP.
 * 20 buscas por minuto por IP — cobrindo uso legítimo normal.
 */
exports.foodSearchLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: parseInt(process.env.FOOD_SEARCH_RATE_LIMIT || '20'),
  message: 'Muitas buscas de alimentos. Tente novamente em 1 minuto.',
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: false,
});
