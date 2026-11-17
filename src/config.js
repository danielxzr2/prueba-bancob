const path = require('node:path');

const PROJECT_ROOT = path.resolve(__dirname, '..');

const MAX_CV_BYTES = 5 * 1024 * 1024; // RNF-05

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
    // Responses are validated against the contract everywhere except production (RNF-12).
    validateResponses: env.NODE_ENV !== 'production',
  };
}

module.exports = { loadConfig, PROJECT_ROOT };
