/** Suscripciones Web Push (VAPID) */

const crypto = require('crypto');

function ensurePushSchema(db) {
  db.run(`
    CREATE TABLE IF NOT EXISTS push_subscriptions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      endpoint TEXT NOT NULL,
      p256dh TEXT NOT NULL,
      auth TEXT NOT NULL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(user_id, endpoint)
    )
  `);
  db.run('CREATE INDEX IF NOT EXISTS idx_push_user ON push_subscriptions(user_id)');
}

function saveSubscription(db, userId, sub) {
  ensurePushSchema(db);
  const endpoint = sub.endpoint;
  const keys = sub.keys || {};
  db.run(
    `INSERT INTO push_subscriptions (user_id, endpoint, p256dh, auth)
     VALUES (?, ?, ?, ?)
     ON CONFLICT(user_id, endpoint) DO UPDATE SET p256dh = excluded.p256dh, auth = excluded.auth`,
    [userId, endpoint, keys.p256dh || '', keys.auth || '']
  );
}

function deleteSubscription(db, userId, endpoint) {
  ensurePushSchema(db);
  db.run('DELETE FROM push_subscriptions WHERE user_id = ? AND endpoint = ?', [userId, endpoint]);
}

function listSubscriptions(db, userId) {
  ensurePushSchema(db);
  const stmt = db.prepare(
    'SELECT id, endpoint, p256dh, auth FROM push_subscriptions WHERE user_id = ?'
  );
  stmt.bind([userId]);
  const rows = [];
  while (stmt.step()) rows.push(stmt.getAsObject());
  stmt.free();
  return rows;
}

function getVapidPublicKey() {
  return process.env.VAPID_PUBLIC_KEY || '';
}

function isPushConfigured() {
  return !!(process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY);
}

function generateVapidKeysIfMissing() {
  if (process.env.VAPID_PUBLIC_KEY) return null;
  const { publicKey, privateKey } = crypto.generateKeyPairSync('ec', {
    namedCurve: 'prime256v1',
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  });
  return { publicKey, privateKey, hint: 'Define VAPID_PUBLIC_KEY y VAPID_PRIVATE_KEY en .env' };
}

module.exports = {
  ensurePushSchema,
  saveSubscription,
  deleteSubscription,
  listSubscriptions,
  getVapidPublicKey,
  isPushConfigured,
  generateVapidKeysIfMissing,
};
