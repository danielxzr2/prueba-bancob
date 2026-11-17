const request = require('supertest');
const { createAnalystRepository } = require('../../src/repositories/analystRepository');
const { createAuthService } = require('../../src/services/authService');

const ANALYST = { username: 'analista', password: 'Contraseña-de-prueba-123' };

/** Creates an analyst in the test database. */
async function seedAnalyst(ctx, { username, password } = ANALYST) {
  const authService = createAuthService({
    analystRepository: createAnalystRepository(ctx.db),
    bcryptCost: ctx.config.bcryptCost,
  });
  await authService.createOrUpdateAnalyst(username, password);
}

/** Returns a Supertest agent with an active analyst session (it keeps the cookie). */
async function loggedInAgent(ctx, { username, password } = ANALYST) {
  const agent = request.agent(ctx.app);
  const res = await agent.post('/api/auth/login').send({ username, password });
  if (res.status !== 200) throw new Error(`Login de prueba falló: ${res.status}`);
  return agent;
}

module.exports = { ANALYST, seedAnalyst, loggedInAgent };
