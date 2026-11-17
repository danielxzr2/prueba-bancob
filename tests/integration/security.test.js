const request = require('supertest');
const { createTestApp } = require('../helpers/testApp');
const { validApplicant, sendRegistration } = require('../helpers/fixtures');
const { seedAnalyst, loggedInAgent } = require('../helpers/auth');

describe('RNF-06 Consultas parametrizadas (inyección SQL)', () => {
  let ctx;

  beforeEach(async () => {
    ctx = createTestApp();
    await seedAnalyst(ctx);
  });

  afterEach(() => ctx.cleanup());

  it('guarda literalmente un nombre con inyección SQL y la tabla sigue intacta', async () => {
    const payload = "Robert'); DROP TABLE applicants;--";

    const res = await sendRegistration(request(ctx.app), validApplicant({ fullName: payload }));
    const list = await (await loggedInAgent(ctx)).get('/api/applicants');

    expect(res.status).toBe(201);
    expect(list.body.map((applicant) => applicant.fullName)).toEqual([payload]);
  });

  it('un correo con comillas no rompe la comprobación de duplicados', async () => {
    const email = "o'brien@example.com";

    const first = await sendRegistration(request(ctx.app), validApplicant({ email }));
    const second = await sendRegistration(request(ctx.app), validApplicant({ email }));

    expect(first.status).toBe(201);
    expect(second.status).toBe(409);
  });

  it('el inicio de sesión no es vulnerable a la inyección clásica', async () => {
    const res = await request(ctx.app)
      .post('/api/auth/login')
      .send({ username: "' OR '1'='1", password: "' OR '1'='1" });

    expect(res.status).toBe(401);
  });
});
