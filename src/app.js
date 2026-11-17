const path = require('node:path');
const express = require('express');
const multer = require('multer');
const OpenApiValidator = require('express-openapi-validator');

const { notFound } = require('./errors');
const { errorHandler } = require('./middleware/errorHandler');

const OPENAPI_PATH = path.join(__dirname, '..', 'docs', 'openapi.yaml');

/**
 * Builds the Express application without starting the server, so tests can
 * exercise it with Supertest and an in-memory database.
 */
function createApp({ config, logger = console }) {
  const app = express();
  app.disable('x-powered-by');

  app.use(express.json({ limit: '10kb' }));

  // The contract is the source of truth (RNF-12): every /api request is validated
  // against docs/openapi.yaml before reaching the routes.
  app.use(
    OpenApiValidator.middleware({
      apiSpec: OPENAPI_PATH,
      validateApiSpec: true,
      // allErrors reports every invalid field at once (CA-03.1). AJV warns about its cost on
      // untrusted input; here it is bounded: 10 KB JSON, maxLength on every string,
      // additionalProperties: false and no regex patterns in the contract.
      validateRequests: { allErrors: true },
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

  // Routes are registered here as each requirement is implemented.

  app.use((req, res, next) => next(notFound()));
  app.use(errorHandler({ logger }));

  return app;
}

module.exports = { createApp };
