const { AppError, validationError, notFound, unauthorized, internalError } = require('../errors');

// Spanish messages for the contract validator's errors (keyed by the ajv keyword).
const VALIDATOR_MESSAGES = {
  required: 'Este campo es obligatorio.',
  type: 'El tipo de dato no es válido.',
  format: 'El formato no es válido.',
  minLength: 'El valor es demasiado corto.',
  maxLength: 'El valor es demasiado largo.',
  minimum: 'El valor es menor al mínimo permitido.',
  maximum: 'El valor es mayor al máximo permitido.',
  enum: 'El valor no es uno de los permitidos.',
  additionalProperties: 'Campo no permitido.',
};

/**
 * Turns a validator path ('/body/fullName', '.body.fullName', '/query/status')
 * into the field name expected by the client ('fullName', 'status').
 */
function toFieldName(path = '') {
  const field = path.replace(/^[./]?(body|query|params|path|headers|cookies)[./]?/, '');
  return field.replace(/\//g, '.') || path;
}

function fromValidatorError(err) {
  if (err.status === 401) return unauthorized();
  if (err.status === 404 || err.status === 405) return notFound();
  if (err.status === 413) return fileTooLarge();
  if (err.status >= 400 && err.status < 500) {
    const details = (err.errors || []).map((e) => {
      const keyword = (e.errorCode || '').split('.')[0];
      return { field: toFieldName(e.path), message: VALIDATOR_MESSAGES[keyword] || e.message };
    });
    return validationError(details);
  }
  return null;
}

function fileTooLarge() {
  return new AppError(413, 'FILE_TOO_LARGE', 'La hoja de vida no puede superar 5 MB.');
}

/**
 * Normalizes any error into an AppError so every response follows RNF-15.
 * Unknown errors become a generic 500: internal details never reach the client.
 */
function normalizeError(err) {
  if (err instanceof AppError) return err;
  if (err.code === 'LIMIT_FILE_SIZE') return fileTooLarge();
  if (err.type === 'entity.parse.failed') {
    return validationError([], 'El cuerpo de la solicitud no es JSON válido.');
  }
  if (typeof err.status === 'number') {
    const mapped = fromValidatorError(err);
    if (mapped) return mapped;
  }
  return internalError();
}

function errorHandler({ logger }) {
  // Express identifies error handlers by their four parameters, so _next must stay.
  return (err, req, res, _next) => {
    const appError = normalizeError(err);
    if (appError.status >= 500) {
      // Log the technical cause only; never the request body (RNF-10).
      logger.error(`[${req.method} ${req.path}]`, err);
    }
    res.status(appError.status).json(appError.toJSON());
  };
}

module.exports = { errorHandler, normalizeError, toFieldName };
