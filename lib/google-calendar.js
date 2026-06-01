/** Integración Google Calendar — OAuth opcional; MVP vía feed ICS */

const crypto = require('crypto');

function ensureIntegrationsSchema(db) {
  db.run(`
    CREATE TABLE IF NOT EXISTS integrations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      provider TEXT NOT NULL,
      access_token TEXT,
      refresh_token TEXT,
      expires_at TEXT,
      meta TEXT DEFAULT '{}',
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(user_id, provider)
    )
  `);
}

function isGoogleConfigured() {
  return !!(
    process.env.GOOGLE_CLIENT_ID &&
    process.env.GOOGLE_CLIENT_SECRET &&
    process.env.GOOGLE_REDIRECT_URI
  );
}

function getGoogleAuthUrl(state) {
  if (!isGoogleConfigured()) return null;
  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID,
    redirect_uri: process.env.GOOGLE_REDIRECT_URI,
    response_type: 'code',
    scope: 'https://www.googleapis.com/auth/calendar.events',
    access_type: 'offline',
    prompt: 'consent',
    state,
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
}

function saveGoogleTokens(db, userId, tokens) {
  ensureIntegrationsSchema(db);
  const enc = JSON.stringify(tokens);
  db.run(
    `INSERT INTO integrations (user_id, provider, access_token, refresh_token, expires_at, meta)
     VALUES (?, 'google', ?, ?, ?, ?)
     ON CONFLICT(user_id, provider) DO UPDATE SET
       access_token = excluded.access_token,
       refresh_token = excluded.refresh_token,
       expires_at = excluded.expires_at,
       updated_at = CURRENT_TIMESTAMP`,
    [
      userId,
      tokens.access_token || '',
      tokens.refresh_token || '',
      tokens.expires_at || null,
      enc,
    ]
  );
}

function getGoogleIntegration(db, userId) {
  ensureIntegrationsSchema(db);
  const stmt = db.prepare(
    "SELECT * FROM integrations WHERE user_id = ? AND provider = 'google'"
  );
  stmt.bind([userId]);
  if (!stmt.step()) {
    stmt.free();
    return null;
  }
  const row = stmt.getAsObject();
  stmt.free();
  return row;
}

function deleteGoogleIntegration(db, userId) {
  ensureIntegrationsSchema(db);
  db.run("DELETE FROM integrations WHERE user_id = ? AND provider = 'google'", [userId]);
}

function createOAuthState(userId) {
  const secret =
    process.env.AMELLIFY_JWT_SECRET || 'amellify-dev';
  const payload = `${userId}:${Date.now()}`;
  const sig = crypto.createHmac('sha256', secret).update(payload).digest('hex').slice(0, 16);
  return Buffer.from(`${payload}:${sig}`).toString('base64url');
}

function verifyOAuthState(state) {
  try {
    const raw = Buffer.from(state, 'base64url').toString('utf8');
    const [userId, ts, sig] = raw.split(':');
    const secret = process.env.AMELLIFY_JWT_SECRET || 'amellify-dev';
    const expected = crypto
      .createHmac('sha256', secret)
      .update(`${userId}:${ts}`)
      .digest('hex')
      .slice(0, 16);
    if (sig !== expected) return null;
    if (Date.now() - Number(ts) > 600000) return null;
    return Number(userId);
  } catch {
    return null;
  }
}

async function exchangeCodeForTokens(code) {
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: process.env.GOOGLE_CLIENT_ID,
      client_secret: process.env.GOOGLE_CLIENT_SECRET,
      redirect_uri: process.env.GOOGLE_REDIRECT_URI,
      grant_type: 'authorization_code',
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error_description || data.error || 'OAuth falló');
  return data;
}

module.exports = {
  isGoogleConfigured,
  getGoogleAuthUrl,
  saveGoogleTokens,
  getGoogleIntegration,
  deleteGoogleIntegration,
  createOAuthState,
  verifyOAuthState,
  exchangeCodeForTokens,
};
