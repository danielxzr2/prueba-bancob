const request = require('supertest');
const { createTestApp } = require('../helpers/testApp');

describe('Frontend', () => {
  let ctx;

  beforeEach(() => {
    ctx = createTestApp();
  });

  afterEach(() => ctx.cleanup());

  it.each([
    ['/', 'formulario de registro'],
    ['/login.html', 'inicio de sesión'],
    ['/panel.html', 'panel del analista'],
  ])('sirve %s (%s)', async (url) => {
    const res = await request(ctx.app).get(url);

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/^text\/html/);
  });

  describe('RNF-07 Defensa contra XSS en el navegador', () => {
    it.each(['/', '/api/no-existe'])(
      'GET %s envía una Content-Security-Policy que solo permite scripts propios',
      async (url) => {
        const res = await request(ctx.app).get(url);
        const csp = res.headers['content-security-policy'];

        expect(csp).toMatch(/default-src 'self'/);
        expect(csp).toMatch(/script-src 'self'/);
        expect(csp).not.toMatch(/unsafe-inline|unsafe-eval/);
        expect(csp).toMatch(/frame-ancestors 'none'/);
      },
    );

    it('envía X-Content-Type-Options: nosniff y no filtra el Referer', async () => {
      const res = await request(ctx.app).get('/');

      expect(res.headers['x-content-type-options']).toBe('nosniff');
      expect(res.headers['referrer-policy']).toBe('no-referrer');
    });
  });
});
