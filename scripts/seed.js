/**
 * Creates (or updates the password of) the test analyst.
 *
 *   npm run seed
 *
 * Reads ANALYST_USERNAME and ANALYST_PASSWORD from the environment or .env. Without
 * ANALYST_PASSWORD it generates a random one and prints it once: no password is
 * hardcoded in the repository (RNF-08). Running it again replaces the password.
 */
const { randomBytes } = require('node:crypto');
const { loadConfig, loadLocalEnvFile } = require('../src/config');
const { openDatabase } = require('../src/db/database');
const { createAnalystRepository } = require('../src/repositories/analystRepository');
const { createAuthService } = require('../src/services/authService');

const MIN_PASSWORD_LENGTH = 8;

async function main() {
  loadLocalEnvFile();
  const config = loadConfig();

  const username = process.env.ANALYST_USERNAME || 'analista';
  const passwordFromEnv = process.env.ANALYST_PASSWORD;
  const password = passwordFromEnv || randomBytes(12).toString('base64url');

  if (password.length < MIN_PASSWORD_LENGTH) {
    console.error(`ANALYST_PASSWORD debe tener al menos ${MIN_PASSWORD_LENGTH} caracteres.`);
    process.exitCode = 1;
    return;
  }

  const db = openDatabase(config.databasePath);
  try {
    const authService = createAuthService({
      analystRepository: createAnalystRepository(db),
      bcryptCost: config.bcryptCost,
    });
    await authService.createOrUpdateAnalyst(username, password);
  } finally {
    db.close();
  }

  console.log(`Analista listo. Usuario: ${username}`);
  if (passwordFromEnv) {
    console.log('Contraseña: la definida en ANALYST_PASSWORD.');
  } else {
    console.log(`Contraseña generada (no se volverá a mostrar): ${password}`);
  }
}

main();
