const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createApplicantService } = require('../../src/services/applicantService');
const { createFileStorage } = require('../../src/services/fileStorage');
const { validPdf } = require('../helpers/fixtures');

describe('RF-04 Correo único — concurrencia', () => {
  let uploadsDir;

  beforeEach(() => {
    uploadsDir = fs.mkdtempSync(path.join(os.tmpdir(), 'prueba-bancob-unit-'));
  });

  afterEach(() => fs.rmSync(uploadsDir, { recursive: true, force: true }));

  it('CA-04.1 si otro registro gana la carrera, responde 409 y elimina el archivo ya guardado', async () => {
    // Simulates two simultaneous registrations: the existence check passes, but
    // the database UNIQUE constraint rejects the insert.
    const uniqueViolation = Object.assign(new Error('UNIQUE constraint failed: applicants.email'), {
      code: 'SQLITE_CONSTRAINT_UNIQUE',
    });
    const service = createApplicantService({
      applicantRepository: {
        existsByEmail: () => false,
        create: () => {
          throw uniqueViolation;
        },
      },
      fileStorage: createFileStorage(uploadsDir),
    });

    const input = {
      fullName: 'Ana María Pérez',
      email: 'ana@example.com',
      career: 'Ingeniería',
      semester: 7,
      dataConsent: true,
    };

    await expect(service.register(input, { buffer: validPdf() })).rejects.toMatchObject({
      status: 409,
      code: 'DUPLICATE_EMAIL',
    });
    expect(fs.readdirSync(uploadsDir)).toEqual([]);
  });
});
