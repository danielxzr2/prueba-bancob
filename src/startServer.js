/**
 * Starts listening and resolves only when the port is really open.
 * Express 5 passes listen errors (e.g. EADDRINUSE) to the callback instead of throwing,
 * so they must be checked: otherwise the app would report success on a busy port.
 */
function startServer(app, port) {
  return new Promise((resolve, reject) => {
    const server = app.listen(port, (err) => (err ? reject(err) : resolve(server)));
  });
}

module.exports = { startServer };
