import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';
import os from 'os';
import * as icsFeed from '../lib/ics-feed.js';
import * as dbLayer from '../lib/db.js';

let tmpDb;

describe('ics-feed', () => {
  before(async () => {
    tmpDb = path.join(os.tmpdir(), `amellify-ics-${Date.now()}.db`);
    await dbLayer.initDatabase({ dbPath: tmpDb });
  });

  after(() => {
    try {
      fs.unlinkSync(tmpDb);
    } catch {
      /* */
    }
  });

  it('crea y resuelve token de feed', () => {
    const db = dbLayer.getDatabase();
    db.run(
      "INSERT INTO users (email, password_hash, name, role) VALUES ('feed@test.local', 'x', 'Feed', 'user')"
    );
    const uidStmt = db.prepare('SELECT id FROM users WHERE email = ?');
    uidStmt.bind(['feed@test.local']);
    uidStmt.step();
    const userId = uidStmt.getAsObject().id;
    uidStmt.free();

    const { token } = icsFeed.getOrCreateFeedToken(db, userId);
    assert.ok(token);
    const resolved = icsFeed.resolveUserIdByToken(db, token);
    assert.equal(resolved, userId);

    icsFeed.revokeFeedToken(db, userId);
    assert.equal(icsFeed.resolveUserIdByToken(db, token), null);
  });
});
