const path = require('node:path');
const express = require('express');
const multer = require('multer');
const session = require('express-session');
const OpenApiValidator = require('express-openapi-validator');

const { notFound } = require('./errors');
const { errorHandler } = require('./middleware/errorHandler');
const { securityHeaders } = require('./middleware/securityHeaders');
const { createApplicantRepository } = require('./repositories/applicantRepository');
const { createStatusChangeRepository } = require('./repositories/statusChangeRepository');
const { createFileStorage } = require('./services/fileStorage');
const { createApplicantService } = require('./services/applicantService');
const { createApplicantsRouter } = require('./routes/applicants');
const { createAnalystRepository } = require('./repositories/analystRepository');
const { createAuthService } = require('./services/authService');
const { createAuthRouter, SESSION_COOKIE } = require('./routes/auth');

const OPENAPI_PATH = path.join(__dirname, '..', 'docs', 'openapi.yaml');
const PUBLIC_DIR = path.join(__dirname, '..', 'public');

/**
 * Builds the Express application without starting the server, so tests can
 * exercise it with Supertest and an in-memory database.
 */
function createApp({ db, config, logger = console }) {
  const app = express();
  app.disable('x-powered-by');
  app.use(securityHeaders);

  // Frontend (HTML, CSS, JS). The uploads folder lives elsewhere and is never served (RNF-03).
  app.use(express.static(PUBLIC_DIR));

  app.use(express.json({ limit: '10kb' }));

  // Analyst session (RF-05). The default in-memory store is enough for a single local
  // process; sessions end when the server restarts.
  app.use(
    '/api',
    session({
      name: SESSION_COOKIE,
      secret: config.sessionSecret,
      resave: false,
      saveUninitialized: false, // no cookie until login
      cookie: {
        httpOnly: true, // not readable from JavaScript (mitigates XSS session theft)
        sameSite: 'strict', // not sent from other sites (mitigates CSRF)
        // Runs locally over HTTP. Behind HTTPS this must be true.
        secure: false,
        maxAge: config.sessionMaxAgeMs,
      },
    }),
  );

  // The contract is the source of truth (RNF-12): every /api request is validated
  // against docs/openapi.yaml before reaching the routes.
  app.use(
    OpenApiValidator.middleware({
      apiSpec: OPENAPI_PATH,
      validateApiSpec: true,
      validateRequests: {
        // Reports every invalid field at once (CA-03.1). AJV warns about its cost on
        // untrusted input; here it is bounded: 10 KB JSON, maxLength on every string,
        // additionalProperties: false and no regex patterns in the contract.
        allErrors: true,
        // multipart/form-data sends every field as text: '7' -> 7, 'true' -> true.
        coerceTypes: true,
      },
      validateResponses: config.validateResponses,
      // Authorization is enforced explicitly per route with the session middleware.
      validateSecurity: false,
      ignorePaths: (requestPath) => !requestPath.startsWith('/api/'),
      // The CV stays in memory until it has been validated, so nothing reaches
      // the disk if the request is rejected (CA-03.1).
      fileUploader: {
        storage: multer.memoryStorage(),
        limits: { fileSize: config.maxCvBytes, files: 1 },
      },
    }),
  );

  // Composition root: dependencies are wired here and injected into each layer.
  const applicantService = createApplicantService({
    applicantRepository: createApplicantRepository(db),
    statusChangeRepository: createStatusChangeRepository(db),
    fileStorage: createFileStorage(config.uploadsDir),
  });

  const authService = createAuthService({
    analystRepository: createAnalystRepository(db),
    bcryptCost: config.bcryptCost,
  });

  app.use('/api/applicants', createApplicantsRouter({ applicantService }));
  app.use('/api/auth', createAuthRouter({ authService }));

  app.use((req, res, next) => next(notFound()));
  app.use(errorHandler({ logger }));

  return app;
}

module.exports = { createApp };
