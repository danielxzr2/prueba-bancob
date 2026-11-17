const { unauthorized } = require('../errors');

/** Lets the request through only with a valid analyst session (RNF-02). */
function requireAuth(req, res, next) {
  if (req.session?.analyst) return next();
  return next(unauthorized());
}

module.exports = { requireAuth };
