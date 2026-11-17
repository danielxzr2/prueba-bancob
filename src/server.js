const fs = require('node:fs');
const { loadConfig, loadLocalEnvFile } = require('./config');
const { openDatabase } = require('./db/database');
const { createApp } = require('./app');
const { startServer } = require('./startServer');

loadLocalEnvFile();
const config = loadConfig();
if (config.sessionSecretIsEphemeral) {
  console.warn('SESSION_SECRET no está definido: las sesiones se cerrarán al reiniciar.');
}
fs.mkdirSync(config.uploadsDir, { recursive: true });

const db = openDatabase(config.databasePath);
const app = createApp({ db, config });

startServer(app, config.port)
  .then((server) => {
    console.log(`Servidor escuchando en http://localhost:${config.port}`);

    const shutdown = () => {
      server.close(() => {
        db.close();
        process.exit(0);
      });
    };
    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);
  })
  .catch((err) => {
    console.error(
      err.code === 'EADDRINUSE'
        ? `El puerto ${config.port} ya está en uso. Detén el otro proceso o define otro PORT en .env.`
        : `No fue posible iniciar el servidor: ${err.message}`,
    );
    db.close();
    process.exitCode = 1;
  });
