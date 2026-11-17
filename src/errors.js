/**
 * Application error with the uniform format from RNF-15:
 * { error: { code, message, details? } }
 * `code` must be one of the values in the `Error` schema of docs/openapi.yaml.
 */
class AppError extends Error {
  constructor(status, code, message, details) {
    super(message);
    this.name = 'AppError';
    this.status = status;
    this.code = code;
    this.details = details;
  }

  toJSON() {
    const error = { code: this.code, message: this.message };
    if (this.details && this.details.length > 0) {
      error.details = this.details;
    }
    return { error };
  }
}

const validationError = (details, message = 'La solicitud tiene campos inválidos.') =>
  new AppError(400, 'VALIDATION_ERROR', message, details);

const notFound = (message = 'Recurso no encontrado.') => new AppError(404, 'NOT_FOUND', message);

const unauthorized = (message = 'Debe iniciar sesión como analista.') =>
  new AppError(401, 'UNAUTHORIZED', message);

const internalError = () => new AppError(500, 'INTERNAL_ERROR', 'Ocurrió un error inesperado.');

module.exports = { AppError, validationError, notFound, unauthorized, internalError };
