const { normalizeError, errorHandler, toFieldName } = require('../../src/middleware/errorHandler');
const { AppError } = require('../../src/errors');

function fakeResponse() {
  const res = {};
  res.status = jest.fn(() => res);
  res.json = jest.fn(() => res);
  return res;
}

describe('RNF-15 Formato uniforme de errores', () => {
  it('conserva un AppError tal cual', () => {
    const err = new AppError(409, 'DUPLICATE_EMAIL', 'Duplicado');
    expect(normalizeError(err)).toBe(err);
  });

  it('convierte un error desconocido en un 500 genérico sin detalles internos', () => {
    const logger = { error: jest.fn() };
    const res = fakeResponse();

    errorHandler({ logger })(
      new Error('SQLITE_CORRUPT: ruta secreta /var/db'),
      { method: 'GET', path: '/api/x' },
      res,
    );

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      error: { code: 'INTERNAL_ERROR', message: 'Ocurrió un error inesperado.' },
    });
    expect(JSON.stringify(res.json.mock.calls[0][0])).not.toMatch(/SQLITE|secreta|stack/);
    expect(logger.error).toHaveBeenCalled();
  });

  it('traduce errores del validador de contrato a VALIDATION_ERROR con detalle por campo', () => {
    const err = {
      status: 400,
      errors: [
        { path: '/body/fullName', errorCode: 'required.openapi.validation', message: 'x' },
        { path: '.body.semester', errorCode: 'maximum.openapi.validation', message: 'x' },
      ],
    };

    expect(normalizeError(err).toJSON()).toEqual({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'La solicitud tiene campos inválidos.',
        details: [
          { field: 'fullName', message: 'Este campo es obligatorio.' },
          { field: 'semester', message: 'El valor es mayor al máximo permitido.' },
        ],
      },
    });
  });

  it('traduce el límite de tamaño de archivo a 413 FILE_TOO_LARGE (RNF-05)', () => {
    const appError = normalizeError({ code: 'LIMIT_FILE_SIZE' });
    expect(appError.status).toBe(413);
    expect(appError.code).toBe('FILE_TOO_LARGE');
  });

  it.each([
    ['/body/fullName', 'fullName'],
    ['.body.email', 'email'],
    ['/query/status', 'status'],
    ['/params/id', 'id'],
  ])('extrae el nombre del campo de %s', (path, expected) => {
    expect(toFieldName(path)).toBe(expected);
  });
});
