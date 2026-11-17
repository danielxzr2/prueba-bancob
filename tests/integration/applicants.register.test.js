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
      expect(res.body.error.details).toContainEqual(
        expect.objectContaining({ field: 'dataConsent' }),
      );
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
      ['nombre vacío', { fullName: '' }, 'fullName'],
      ['nombre solo con espacios', { fullName: '     ' }, 'fullName'],
      ['nombre muy largo', { fullName: 'a'.repeat(101) }, 'fullName'],
      ['correo inválido', { email: 'no-es-un-correo' }, 'email'],
      ['carrera faltante', { career: undefined }, 'career'],
      ['semestre 0', { semester: '0' }, 'semester'],
      ['semestre 13', { semester: '13' }, 'semester'],
      ['semestre no numérico', { semester: 'séptimo' }, 'semester'],
      ['semestre decimal', { semester: '7.5' }, 'semester'],
    ])('CA-03.1 rechaza %s sin guardar nada', async (_case, override, field) => {
      const res = await sendRegistration(request(ctx.app), validApplicant(override));

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
      expect(res.body.error.details).toContainEqual(expect.objectContaining({ field }));
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
});
