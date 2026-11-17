const request = require('supertest');
const { createTestApp } = require('../helpers/testApp');

describe('RNF-12 La API se valida contra el contrato OpenAPI', () => {
  let ctx;

  beforeEach(() => {
    ctx = createTestApp();
  });

  afterEach(() => ctx.cleanup());

  it('rechaza con 400 y detalle por campo una petición que no cumple el contrato', async () => {
    const res = await request(ctx.app).post('/api/auth/login').send({});

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(res.body.error.details.map((d) => d.field).sort()).toEqual(['password', 'username']);
  });

  it('rechaza campos no definidos en el contrato', async () => {
    const res = await request(ctx.app)
      .post('/api/auth/login')
      .send({ username: 'ana', password: 'x', isAdmin: true });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('responde 400 con formato uniforme ante JSON malformado', async () => {
    const res = await request(ctx.app)
      .post('/api/auth/login')
      .set('Content-Type', 'application/json')
      .send('{"username":');

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('responde 404 con formato uniforme para rutas fuera del contrato', async () => {
    const res = await request(ctx.app).get('/api/no-existe');

    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: { code: 'NOT_FOUND', message: 'Recurso no encontrado.' } });
  });

  it('no expone la cabecera X-Powered-By', async () => {
    const res = await request(ctx.app).get('/api/no-existe');
    expect(res.headers['x-powered-by']).toBeUndefined();
  });
});
