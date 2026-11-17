const fs = require('node:fs');
const { loadConfig, loadLocalEnvFile } = require('./config');
const { openDatabase } = require('./db/database');
const { createApp } = require('./app');

loadLocalEnvFile();
const config = loadConfig();
if (config.sessionSecretIsEphemeral) {
  console.warn('SESSION_SECRET no está definido: las sesiones se cerrarán al reiniciar.');
}
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
