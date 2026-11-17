const fs = require('node:fs');
const path = require('node:path');
const request = require('supertest');
const { createTestApp } = require('../helpers/testApp');
const { validApplicant, validPdf, sendRegistration } = require('../helpers/fixtures');

describe('Registro de postulaciones — POST /api/applicants', () => {
  let ctx;

  beforeEach(() => {
    ctx = createTestApp();
  });

  afterEach(() => ctx.cleanup());

  const countApplicants = () => ctx.db.prepare('SELECT COUNT(*) AS n FROM applicants').get().n;

  describe('RF-01 Registrar postulación', () => {
    it('CA-01.1 guarda la postulación con estado PENDIENTE y responde 201', async () => {
      const res = await sendRegistration(request(ctx.app));

      expect(res.status).toBe(201);
      expect(res.body).toEqual({
        id: expect.any(Number),
        status: 'PENDIENTE',
        createdAt: expect.any(String),
      });

      const row = ctx.db.prepare('SELECT * FROM applicants WHERE id = ?').get(res.body.id);
      expect(row).toMatchObject({
        full_name: 'Ana María Pérez',
        email: 'ana.perez@example.com',
        career: 'Ingeniería de Sistemas',
        semester: 7,
        status: 'PENDIENTE',
      });
    });

    it('CA-01.1 normaliza el correo a minúsculas y elimina espacios sobrantes', async () => {
      const res = await sendRegistration(
        request(ctx.app),
        validApplicant({ fullName: '  Ana María Pérez  ', email: 'Ana.Perez@Example.COM' }),
      );

      expect(res.status).toBe(201);
      const row = ctx.db.prepare('SELECT * FROM applicants WHERE id = ?').get(res.body.id);
      expect(row.full_name).toBe('Ana María Pérez');
      expect(row.email).toBe('ana.perez@example.com');
    });

    it('CA-01.2 almacena la hoja de vida con un nombre generado y la asocia al practicante', async () => {
      const res = await sendRegistration(
        request(ctx.app),
        validApplicant(),
        validPdf(),
        'mi cv.pdf',
      );

      expect(res.status).toBe(201);
      const { cv_file_name: cvFileName } = ctx.db
        .prepare('SELECT cv_file_name FROM applicants WHERE id = ?')
        .get(res.body.id);

      expect(cvFileName).toMatch(/^[0-9a-f-]{36}\.pdf$/); // UUID, not the original name (RNF-03)
      expect(ctx.uploadedFiles()).toEqual([cvFileName]);
      expect(fs.readFileSync(path.join(ctx.config.uploadsDir, cvFileName))).toEqual(validPdf());
    });

    it('CA-01.3 rechaza la postulación si no se acepta el tratamiento de datos', async () => {
      const res = await sendRegistration(
        request(ctx.app),
        validApplicant({ dataConsent: 'false' }),
      );

      expect(res.status).toBe(400);
      expect(res.body.error.details).toContainEqual({
        field: 'dataConsent',
        message: expect.stringMatching(/autorización/),
      });
      expect(countApplicants()).toBe(0);
      expect(ctx.uploadedFiles()).toEqual([]);
    });

    it('RNF-09 guarda la fecha y hora de la autorización de datos', async () => {
      const res = await sendRegistration(request(ctx.app));

      const row = ctx.db
        .prepare('SELECT data_consent_at FROM applicants WHERE id = ?')
        .get(res.body.id);
      expect(new Date(row.data_consent_at).toString()).not.toBe('Invalid Date');
    });
  });

  describe('RF-03 Validación en el servidor', () => {
    it.each([
      // The reason is asserted too, so a test cannot pass because of an unrelated error
      // (e.g. a type error hiding a range check).
      ['nombre vacío', { fullName: '' }, 'fullName', /corto|obligatorio/],
      ['nombre solo con espacios', { fullName: '     ' }, 'fullName', /obligatorio/],
      ['nombre muy largo', { fullName: 'a'.repeat(101) }, 'fullName', /largo/],
      ['correo inválido', { email: 'no-es-un-correo' }, 'email', /formato/],
      ['carrera faltante', { career: undefined }, 'career', /obligatorio/],
      ['semestre 0', { semester: '0' }, 'semester', /mínimo/],
      ['semestre 13', { semester: '13' }, 'semester', /máximo/],
      ['semestre no numérico', { semester: 'séptimo' }, 'semester', /tipo/],
      ['semestre decimal', { semester: '7.5' }, 'semester', /tipo/],
    ])('CA-03.1 rechaza %s sin guardar nada', async (_case, override, field, reason) => {
      const res = await sendRegistration(request(ctx.app), validApplicant(override));

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
      expect(res.body.error.details).toContainEqual({
        field,
        message: expect.stringMatching(reason),
      });
      expect(countApplicants()).toBe(0);
      expect(ctx.uploadedFiles()).toEqual([]);
    });

    it('CA-03.1 rechaza la postulación sin hoja de vida', async () => {
      const res = await sendRegistration(request(ctx.app), validApplicant(), null);

      expect(res.status).toBe(400);
      expect(res.body.error.details).toContainEqual(expect.objectContaining({ field: 'cv' }));
      expect(countApplicants()).toBe(0);
    });

    it('CA-03.1 informa todos los campos inválidos en una sola respuesta', async () => {
      const res = await sendRegistration(
        request(ctx.app),
        validApplicant({ fullName: '', email: 'x', semester: '99' }),
      );

      expect(res.status).toBe(400);
      const fields = res.body.error.details.map((d) => d.field);
      expect(fields).toEqual(expect.arrayContaining(['fullName', 'email', 'semester']));
    });
  });

  describe('RF-04 Correo único', () => {
    it('CA-04.1 responde 409 si el correo ya está registrado y no guarda el archivo', async () => {
      await sendRegistration(request(ctx.app));
      const filesBefore = ctx.uploadedFiles();

      const res = await sendRegistration(request(ctx.app));

      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('DUPLICATE_EMAIL');
      expect(countApplicants()).toBe(1);
      expect(ctx.uploadedFiles()).toEqual(filesBefore);
    });

    it('CA-04.1 compara el correo sin distinguir mayúsculas y minúsculas', async () => {
      await sendRegistration(request(ctx.app));

      const res = await sendRegistration(
        request(ctx.app),
        validApplicant({ email: '  ANA.Perez@EXAMPLE.com ' }),
      );

      expect(res.status).toBe(409);
      expect(countApplicants()).toBe(1);
    });
  });

  describe('RNF-04 El tipo de archivo se verifica por su contenido', () => {
    it.each([
      ['un ejecutable renombrado a .pdf', Buffer.from('MZ\x90\x00\x03\x00\x00\x00')],
      ['un archivo de texto renombrado a .pdf', Buffer.from('hola, esto no es un PDF')],
      ['un archivo vacío', Buffer.alloc(0)],
    ])('rechaza %s sin guardar nada', async (_case, content) => {
      const res = await sendRegistration(request(ctx.app), validApplicant(), content, 'cv.pdf');

      expect(res.status).toBe(400);
      expect(res.body.error.details).toContainEqual({
        field: 'cv',
        message: expect.stringMatching(/PDF/),
      });
      expect(countApplicants()).toBe(0);
      expect(ctx.uploadedFiles()).toEqual([]);
    });
  });

  describe('RNF-05 Tamaño máximo de la hoja de vida: 5 MB', () => {
    const pdfOfSize = (bytes) => {
      const buffer = Buffer.alloc(bytes, 0x20);
      validPdf().copy(buffer);
      return buffer;
    };

    it('acepta un archivo de exactamente 5 MB', async () => {
      const res = await sendRegistration(
        request(ctx.app),
        validApplicant(),
        pdfOfSize(5 * 1024 * 1024),
      );

      expect(res.status).toBe(201);
    });

    it('responde 413 a un archivo de 5 MB + 1 byte y no guarda nada', async () => {
      const res = await sendRegistration(
        request(ctx.app),
        validApplicant(),
        pdfOfSize(5 * 1024 * 1024 + 1),
      );

      expect(res.status).toBe(413);
      expect(res.body.error.code).toBe('FILE_TOO_LARGE');
      expect(countApplicants()).toBe(0);
      expect(ctx.uploadedFiles()).toEqual([]);
    });
  });
});
