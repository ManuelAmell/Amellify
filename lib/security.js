/** Cabeceras de seguridad y rate limit ligero (sin dependencias extra) */

const buckets = new Map();
const WINDOW_MS = 60_000;
const MAX_POST = 120;
const MAX_AUTH = 20;

function rateLimit(key, limit = MAX_POST) {
  const now = Date.now();
  let bucket = buckets.get(key);
  if (!bucket || now - bucket.start > WINDOW_MS) {
    bucket = { start: now, count: 0 };
    buckets.set(key, bucket);
  }
  bucket.count += 1;
  return bucket.count <= limit;
}

function securityHeaders(_req, res, next) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('X-DNS-Prefetch-Control', 'off');
  res.setHeader(
    'Permissions-Policy',
    'camera=(), microphone=(), geolocation=()'
  );
  next();
}

function apiRateLimit(req, res, next) {
  if (req.method !== 'POST' && req.method !== 'PUT' && req.method !== 'DELETE') {
    return next();
  }
  const key = `${req.ip || req.socket.remoteAddress}:${req.path}`;
  if (!rateLimit(key)) {
    return res.status(429).json({ error: 'Demasiadas solicitudes. Espera un momento.' });
  }
  next();
}

function authRateLimit(req, res, next) {
  const key = `auth:${req.ip || req.socket.remoteAddress}:${req.path}`;
  if (!rateLimit(key, MAX_AUTH)) {
    return res.status(429).json({ error: 'Demasiados intentos. Espera un momento.' });
  }
  next();
}

module.exports = { securityHeaders, apiRateLimit, authRateLimit };
