const request = require('supertest');
const { createTestApp } = require('../helpers/testApp');
const { createAnalystRepository } = require('../../src/repositories/analystRepository');
const { createAuthService } = require('../../src/services/authService');

const USERNAME = 'analista';
const PASSWORD = 'Contraseña-de-prueba-123';

describe('RF-05 Iniciar y cerrar sesión', () => {
  let ctx;

  beforeEach(async () => {
    ctx = createTestApp();
    const authService = createAuthService({
      analystRepository: createAnalystRepository(ctx.db),
      bcryptCost: ctx.config.bcryptCost,
    });
    await authService.createOrUpdateAnalyst(USERNAME, PASSWORD);
  });

  afterEach(() => ctx.cleanup());

  const login = (agent, username = USERNAME, password = PASSWORD) =>
    agent.post('/api/auth/login').send({ username, password });

  describe('CA-05.1 Credenciales válidas', () => {
    it('inicia sesión y responde con el analista', async () => {
      const res = await login(request(ctx.app));

      expect(res.status).toBe(200);
      expect(res.body).toEqual({ username: USERNAME });
    });

    it('emite la cookie de sesión con HttpOnly y SameSite=Strict', async () => {
      const res = await login(request(ctx.app));

      const cookie = res.headers['set-cookie'].find((c) => c.startsWith('sid='));
      expect(cookie).toBeDefined();
      expect(cookie).toMatch(/HttpOnly/i);
      expect(cookie).toMatch(/SameSite=Strict/i);
    });

    it('permite consultar la sesión actual con la cookie', async () => {
      const agent = request.agent(ctx.app);
      await login(agent);

      const res = await agent.get('/api/auth/me');

      expect(res.status).toBe(200);
      expect(res.body).toEqual({ username: USERNAME });
    });
  });

  describe('Protección contra fijación de sesión (session fixation)', () => {
    it('emite un id de sesión nuevo en cada inicio de sesión', async () => {
      const sid = (res) =>
        res.headers['set-cookie'].find((c) => c.startsWith('sid=')).split(';')[0];
      const agent = request.agent(ctx.app);

      const first = await login(agent);
      const second = await login(agent);

      expect(sid(second)).not.toBe(sid(first));
    });
  });

  describe('CA-05.2 Credenciales inválidas', () => {
    it('responde 401 con contraseña incorrecta', async () => {
      const res = await login(request(ctx.app), USERNAME, 'incorrecta');

      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('INVALID_CREDENTIALS');
      expect(res.headers['set-cookie']).toBeUndefined();
    });

    it('responde exactamente lo mismo si el usuario no existe (no revela usuarios)', async () => {
      const wrongPassword = await login(request(ctx.app), USERNAME, 'incorrecta');
      const unknownUser = await login(request(ctx.app), 'no-existe', 'incorrecta');

      expect(unknownUser.status).toBe(wrongPassword.status);
      expect(unknownUser.body).toEqual(wrongPassword.body);
    });
  });

  describe('CA-05.3 Cerrar sesión', () => {
    it('invalida la sesión: después del logout el panel deja de ser accesible', async () => {
      const agent = request.agent(ctx.app);
      await login(agent);

      const logout = await agent.post('/api/auth/logout');
      const me = await agent.get('/api/auth/me');

      expect(logout.status).toBe(204);
      expect(me.status).toBe(401);
    });

    it('invalida la sesión en el servidor: la cookie anterior deja de servir', async () => {
      // Borrar la cookie en el navegador no basta: si alguien la copió antes del
      // logout, el servidor debe rechazarla.
      const loginRes = await login(request(ctx.app));
      const sessionCookie = loginRes.headers['set-cookie'].find((c) => c.startsWith('sid='));
      const cookieValue = sessionCookie.split(';')[0];

      await request(ctx.app).post('/api/auth/logout').set('Cookie', cookieValue);
      const reused = await request(ctx.app).get('/api/auth/me').set('Cookie', cookieValue);

      expect(reused.status).toBe(401);
    });
  });

  describe('RNF-02 Rutas protegidas exigen sesión', () => {
    it.each([
      ['GET', '/api/auth/me'],
      ['POST', '/api/auth/logout'],
    ])('%s %s sin sesión responde 401', async (method, url) => {
      const res = await request(ctx.app)[method.toLowerCase()](url);

      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('UNAUTHORIZED');
    });

    it('rechaza una cookie de sesión inventada', async () => {
      const res = await request(ctx.app).get('/api/auth/me').set('Cookie', 'sid=inventada');

      expect(res.status).toBe(401);
    });
  });

  describe('RNF-01 Contraseñas con bcrypt', () => {
    it('guarda un hash bcrypt con costo >= 10, nunca la contraseña', () => {
      const { password_hash: hash } = ctx.db
        .prepare('SELECT password_hash FROM analysts WHERE username = ?')
        .get(USERNAME);

      expect(hash).not.toContain(PASSWORD);
      const [, algorithm, cost] = hash.split('$');
      expect(algorithm).toMatch(/^2[aby]$/);
      expect(Number(cost)).toBeGreaterThanOrEqual(10);
    });
  });
});
