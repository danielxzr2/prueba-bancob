/**
 * Security headers for every response (RNF-07, defense in depth against XSS).
 * The CSP only allows the site's own scripts and styles: no inline code, so even if
 * some HTML were injected into a page, an injected <script> would not run.
 */
const CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self'",
  "img-src 'self' data:",
  "form-action 'self'",
  "frame-ancestors 'none'", // the app cannot be embedded in an iframe (clickjacking)
  "base-uri 'none'",
  "object-src 'none'",
].join('; ');

function securityHeaders(req, res, next) {
  res.set({
    'Content-Security-Policy': CONTENT_SECURITY_POLICY,
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'no-referrer',
    'X-Frame-Options': 'DENY',
  });
  next();
}

module.exports = { securityHeaders };
