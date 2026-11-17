const fs = require('node:fs');
const path = require('node:path');
const { randomBytes } = require('node:crypto');

const PROJECT_ROOT = path.resolve(__dirname, '..');

const MAX_CV_BYTES = 5 * 1024 * 1024; // RNF-05
const SESSION_MAX_AGE_MS = 2 * 60 * 60 * 1000; // 2 hours
const BCRYPT_COST = 12; // RNF-01 requires >= 10

/**
 * Loads the optional local .env file into process.env (RNF-08). Only entry points
 * (server, seed) call it, so tests never read a developer's .env. It is done in code
 * because `node --watch --env-file-if-exists` crashes in Node 22 when the file is missing.
 */
function loadLocalEnvFile() {
  const envFile = path.join(PROJECT_ROOT, '.env');
  if (fs.existsSync(envFile)) process.loadEnvFile(envFile);
}

/**
 * Builds the application configuration from environment variables.
 * Every value has a safe local default so `npm install && npm run dev` works (RNF-16).
 */
function loadConfig(env = process.env) {
  return {
    port: Number(env.PORT) || 3000,
    databasePath: path.resolve(PROJECT_ROOT, env.DATABASE_PATH || 'data/app.sqlite'),
    uploadsDir: path.resolve(PROJECT_ROOT, env.UPLOADS_DIR || 'uploads'),
    maxCvBytes: MAX_CV_BYTES,
    // Without SESSION_SECRET a random one is generated: secure by default, at the cost
    // of sessions not surviving a restart. No secret is ever hardcoded (RNF-08).
    sessionSecret: env.SESSION_SECRET || randomBytes(32).toString('hex'),
    sessionSecretIsEphemeral: !env.SESSION_SECRET,
    sessionMaxAgeMs: SESSION_MAX_AGE_MS,
    bcryptCost: BCRYPT_COST,
    // Responses are validated against the contract everywhere except production (RNF-12).
    validateResponses: env.NODE_ENV !== 'production',
  };
}

module.exports = { loadConfig, loadLocalEnvFile, PROJECT_ROOT };
