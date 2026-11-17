const { openDatabase } = require('../../src/db/database');
const { createApplicantRepository } = require('../../src/repositories/applicantRepository');
const { createApplicantService, cvDownloadName } = require('../../src/services/applicantService');

describe('RF-08/RF-10 La decisión y su registro de auditoría son atómicos', () => {
  let db;

  beforeEach(() => {
    db = openDatabase(':memory:');
    db.prepare("INSERT INTO analysts (id, username, password_hash) VALUES (1, 'ana', 'x')").run();
    db.prepare(
      `INSERT INTO applicants (id, full_name, email, career, semester, cv_file_name, data_consent_at)
       VALUES (1, 'Ana', 'ana@example.com', 'Sistemas', 7, 'cv.pdf', '2026-01-01T00:00:00.000Z')`,
    ).run();
  });

  afterEach(() => db.close());

  it('si falla el registro en la bitácora, el estado no cambia', () => {
    const service = createApplicantService({
      applicantRepository: createApplicantRepository(db),
      statusChangeRepository: {
        insert: () => {
          throw new Error('disco lleno');
        },
      },
      fileStorage: {},
    });

    expect(() => service.changeStatus(1, 'VIABLE', { id: 1 })).toThrow('disco lleno');
    expect(db.prepare('SELECT status FROM applicants WHERE id = 1').get().status).toBe('PENDIENTE');
  });
});

describe('CA-08.2 El servicio valida la decisión aunque el contrato ya lo haga', () => {
  it.each(['PENDIENTE', 'APROBADO'])('rechaza "%s" (defensa en profundidad)', (status) => {
    const service = createApplicantService({ applicantRepository: {}, fileStorage: {} });

    expect(() => service.changeStatus(1, status, { id: 1 })).toThrow(
      expect.objectContaining({ status: 400, code: 'VALIDATION_ERROR' }),
    );
  });
});

describe('RF-09 Nombre del archivo de descarga', () => {
  it.each([
    ['Ana María Pérez', 'CV-ana-maria-perez.pdf'],
    ['José Ñúñez', 'CV-jose-nunez.pdf'],
    ['  Juan   Carlos  ', 'CV-juan-carlos.pdf'],
    // The name goes inside the Content-Disposition header: quotes and line breaks
    // must never reach it (header injection).
    ['Ana "x"\r\nSet-Cookie: a=b', 'CV-ana-x-set-cookie-a-b.pdf'],
    ['???', 'CV-practicante.pdf'],
  ])('"%s" -> %s', (fullName, expected) => {
    expect(cvDownloadName(fullName)).toBe(expected);
  });

  it('limita la longitud del nombre', () => {
    expect(cvDownloadName('a'.repeat(200)).length).toBeLessThanOrEqual('CV-.pdf'.length + 60);
  });
});
