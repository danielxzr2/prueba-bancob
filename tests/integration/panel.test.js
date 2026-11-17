const request = require('supertest');
const { createTestApp } = require('../helpers/testApp');
const { validApplicant, validPdf, sendRegistration } = require('../helpers/fixtures');
const { seedAnalyst, loggedInAgent } = require('../helpers/auth');

describe('Panel de analista — API', () => {
  let ctx;
  let agent;

  beforeEach(async () => {
    ctx = createTestApp();
    await seedAnalyst(ctx);
    agent = await loggedInAgent(ctx);
  });

  afterEach(() => ctx.cleanup());

  /** Registers an applicant through the public API and returns its id. */
  async function register(overrides = {}, cv = validPdf()) {
    const res = await sendRegistration(request(ctx.app), validApplicant(overrides), cv);
    expect(res.status).toBe(201);
    return res.body.id;
  }

  const setStatus = (id, status) => agent.put(`/api/applicants/${id}/status`).send({ status });

  describe('RNF-02 Todas las rutas del panel exigen sesión', () => {
    it.each([
      ['GET', '/api/applicants'],
      ['GET', '/api/applicants/1'],
      ['PUT', '/api/applicants/1/status'],
      ['GET', '/api/applicants/1/status-history'],
      ['GET', '/api/applicants/1/cv'],
    ])('%s %s sin sesión responde 401', async (method, url) => {
      await register();
      const req = request(ctx.app)[method.toLowerCase()](url);
      const res = method === 'PUT' ? await req.send({ status: 'VIABLE' }) : await req;

      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('UNAUTHORIZED');
    });
  });

  describe('RF-06 Listar practicantes', () => {
    it('CA-06.1 lista todos los practicantes, del más reciente al más antiguo', async () => {
      const first = await register({ email: 'a@example.com', fullName: 'Primera Persona' });
      const second = await register({ email: 'b@example.com', fullName: 'Segunda Persona' });
      const third = await register({ email: 'c@example.com', fullName: 'Tercera Persona' });

      const res = await agent.get('/api/applicants');

      expect(res.status).toBe(200);
      expect(res.body.map((a) => a.id)).toEqual([third, second, first]);
    });

    it('CA-06.1 incluye nombre, carrera, semestre, estado y fecha de registro', async () => {
      await register();

      const res = await agent.get('/api/applicants');

      expect(res.body[0]).toEqual({
        id: expect.any(Number),
        fullName: 'Ana María Pérez',
        career: 'Ingeniería de Sistemas',
        semester: 7,
        status: 'PENDIENTE',
        createdAt: expect.any(String),
      });
    });

    it('responde una lista vacía si no hay practicantes', async () => {
      const res = await agent.get('/api/applicants');

      expect(res.status).toBe(200);
      expect(res.body).toEqual([]);
    });
  });

  describe('RF-11 Filtrar por estado', () => {
    it('CA-11.1 con ?status=PENDIENTE muestra solo los pendientes', async () => {
      const pending = await register({ email: 'a@example.com' });
      const viable = await register({ email: 'b@example.com' });
      await setStatus(viable, 'VIABLE');

      const res = await agent.get('/api/applicants?status=PENDIENTE');

      expect(res.body.map((a) => a.id)).toEqual([pending]);
    });

    it('rechaza un estado que no existe', async () => {
      const res = await agent.get('/api/applicants?status=APROBADO');

      expect(res.status).toBe(400);
    });
  });

  describe('RF-07 Ver detalle de un practicante', () => {
    it('CA-07.1 muestra todos sus datos', async () => {
      const id = await register();

      const res = await agent.get(`/api/applicants/${id}`);

      expect(res.status).toBe(200);
      expect(res.body).toEqual({
        id,
        fullName: 'Ana María Pérez',
        email: 'ana.perez@example.com',
        career: 'Ingeniería de Sistemas',
        semester: 7,
        status: 'PENDIENTE',
        dataConsentAt: expect.any(String),
        createdAt: expect.any(String),
        updatedAt: expect.any(String),
      });
    });

    it('CA-07.2 responde 404 si el practicante no existe', async () => {
      const res = await agent.get('/api/applicants/999');

      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('NOT_FOUND');
    });

    it('responde 400 si el identificador no es un número', async () => {
      const res = await agent.get('/api/applicants/abc');

      expect(res.status).toBe(400);
    });
  });

  describe('RF-08 Marcar como viable o no viable', () => {
    it.each(['VIABLE', 'NO_VIABLE'])('CA-08.1 marca como %s', async (status) => {
      const id = await register();

      const res = await setStatus(id, status);

      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({ id, status });
      expect((await agent.get(`/api/applicants/${id}`)).body.status).toBe(status);
    });

    it.each(['PENDIENTE', 'APROBADO', ''])(
      'CA-08.2 rechaza el estado "%s" sin cambiar nada',
      async (status) => {
        const id = await register();

        const res = await setStatus(id, status);

        expect(res.status).toBe(400);
        expect((await agent.get(`/api/applicants/${id}`)).body.status).toBe('PENDIENTE');
      },
    );

    it('CA-08.3 permite corregir una decisión ya tomada', async () => {
      const id = await register();
      await setStatus(id, 'VIABLE');

      const res = await setStatus(id, 'NO_VIABLE');

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('NO_VIABLE');
    });

    it('responde 404 si el practicante no existe', async () => {
      const res = await setStatus(999, 'VIABLE');

      expect(res.status).toBe(404);
    });
  });

  describe('RF-10 Bitácora de auditoría de decisiones', () => {
    const history = (id) => agent.get(`/api/applicants/${id}/status-history`);

    it('CA-10.1 registra estado anterior, nuevo, analista y fecha de cada cambio', async () => {
      const id = await register();
      await setStatus(id, 'VIABLE');

      const res = await history(id);

      expect(res.status).toBe(200);
      expect(res.body).toEqual([
        {
          id: expect.any(Number),
          previousStatus: 'PENDIENTE',
          newStatus: 'VIABLE',
          changedBy: 'analista',
          changedAt: expect.any(String),
        },
      ]);
    });

    it('CA-10.2 muestra el historial completo, del cambio más reciente al más antiguo', async () => {
      const id = await register();
      await setStatus(id, 'VIABLE');
      await setStatus(id, 'NO_VIABLE');

      const res = await history(id);

      expect(res.body.map((c) => [c.previousStatus, c.newStatus])).toEqual([
        ['VIABLE', 'NO_VIABLE'],
        ['PENDIENTE', 'VIABLE'],
      ]);
    });

    it('no registra nada si se marca el mismo estado que ya tiene (idempotente)', async () => {
      const id = await register();
      await setStatus(id, 'VIABLE');

      const res = await setStatus(id, 'VIABLE');

      expect(res.status).toBe(200);
      expect((await history(id)).body).toHaveLength(1);
    });

    it('responde una lista vacía si aún no hay decisiones', async () => {
      const id = await register();

      expect((await history(id)).body).toEqual([]);
    });

    it('responde 404 si el practicante no existe', async () => {
      expect((await history(999)).status).toBe(404);
    });
  });

  describe('RF-09 Descargar hoja de vida', () => {
    it('CA-09.1 descarga el PDF original con un nombre legible', async () => {
      const id = await register();

      const res = await agent
        .get(`/api/applicants/${id}/cv`)
        .buffer(true)
        .parse((response, callback) => {
          const chunks = [];
          response.on('data', (chunk) => chunks.push(chunk));
          response.on('end', () => callback(null, Buffer.concat(chunks)));
        });

      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toMatch(/^application\/pdf/);
      expect(res.headers['content-disposition']).toMatch(
        /^attachment; filename="CV-ana-maria-perez\.pdf"/,
      );
      expect(res.body).toEqual(validPdf());
    });

    it('responde 404 si el practicante no existe', async () => {
      const res = await agent.get('/api/applicants/999/cv');

      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('NOT_FOUND');
    });
  });

  describe('RNF-03 Las hojas de vida no son accesibles directamente', () => {
    it.each(['/uploads/{file}', '/{file}', '/api/uploads/{file}'])(
      'GET %s responde 404 aunque el archivo exista',
      async (pattern) => {
        await register();
        const [file] = ctx.uploadedFiles();

        const res = await agent.get(pattern.replace('{file}', file));

        expect(res.status).toBe(404);
      },
    );
  });
});
