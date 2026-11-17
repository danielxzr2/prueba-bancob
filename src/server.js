const fs = require('node:fs');
const path = require('node:path');
const { loadConfig, PROJECT_ROOT } = require('./config');
const { openDatabase } = require('./db/database');
const { createApp } = require('./app');

// Optional local configuration (RNF-08). Loaded here and not in config.js, so tests never
// read a developer's .env. Done in code because `node --watch --env-file-if-exists` crashes
// in Node 22 when the file does not exist.
const envFile = path.join(PROJECT_ROOT, '.env');
if (fs.existsSync(envFile)) process.loadEnvFile(envFile);

const config = loadConfig();
fs.mkdirSync(config.uploadsDir, { recursive: true });

const db = openDatabase(config.databasePath);
const app = createApp({ db, config });

const server = app.listen(config.port, () => {
  console.log(`Servidor escuchando en http://localhost:${config.port}`);
});

function shutdown() {
  server.close(() => {
    db.close();
    process.exit(0);
  });
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
