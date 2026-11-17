const express = require('express');
const { requireAuth } = require('../middleware/requireAuth');

const SESSION_COOKIE = 'sid';

// express-session uses callbacks; these helpers let the routes use async/await.
const regenerateSession = (req) =>
  new Promise((resolve, reject) =>
    req.session.regenerate((err) => (err ? reject(err) : resolve())),
  );
const destroySession = (req) =>
  new Promise((resolve, reject) => req.session.destroy((err) => (err ? reject(err) : resolve())));

/** RF-05: analyst login, logout and current session. */
function createAuthRouter({ authService }) {
  const router = express.Router();

  router.post('/login', async (req, res) => {
    const analyst = await authService.login(req.body.username, req.body.password);
    // A new session id on login prevents session fixation.
    await regenerateSession(req);
    req.session.analyst = analyst;
    res.json({ username: analyst.username });
  });

  router.post('/logout', requireAuth, async (req, res) => {
    await destroySession(req);
    res.clearCookie(SESSION_COOKIE, { path: '/' });
    res.status(204).end();
  });

  router.get('/me', requireAuth, (req, res) => {
    res.json({ username: req.session.analyst.username });
  });

  return router;
}

module.exports = { createAuthRouter, SESSION_COOKIE };
