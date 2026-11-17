const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { loadConfig } = require('../../src/config');
const { openDatabase } = require('../../src/db/database');
const { createApp } = require('../../src/app');

/**
 * Creates an isolated app per test: in-memory database, temporary uploads
 * folder and a fake logger. Call `cleanup()` in afterEach.
 */
function createTestApp(overrides = {}) {
  const uploadsDir = fs.mkdtempSync(path.join(os.tmpdir(), 'prueba-bancob-uploads-'));
  // bcrypt cost 10 keeps tests fast while still meeting RNF-01 (>= 10).
  const config = { ...loadConfig({ NODE_ENV: 'test' }), uploadsDir, bcryptCost: 10, ...overrides };
  const db = openDatabase(':memory:');
  const logger = { error: jest.fn(), warn: jest.fn(), info: jest.fn() };
  const app = createApp({ db, config, logger });

  return {
    app,
    db,
    config,
    logger,
    uploadedFiles: () => fs.readdirSync(uploadsDir),
    cleanup: () => {
      db.close();
      fs.rmSync(uploadsDir, { recursive: true, force: true });
    },
  };
}

module.exports = { createTestApp };
