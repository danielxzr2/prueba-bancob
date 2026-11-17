const { createAuthService } = require('../../src/services/authService');

/** In-memory repository and a hasher that records calls, so no real bcrypt is needed. */
function setup(existing = {}) {
  const analysts = new Map(Object.entries(existing));
  const analystRepository = {
    findByUsername: (username) => analysts.get(username),
    upsert: (username, passwordHash) => {
      analysts.set(username, { id: 1, username, passwordHash });
    },
  };
  const hasher = {
    hash: jest.fn(async (password) => `hashed:${password}`),
    compare: jest.fn(async (password, hash) => hash === `hashed:${password}`),
  };
  const service = createAuthService({ analystRepository, hasher, bcryptCost: 10 });
  return { service, analysts, hasher };
}

describe('RF-05 Servicio de autenticación', () => {
  it('CA-05.2 compara la contraseña aunque el usuario no exista (mismo tiempo de respuesta)', async () => {
    const { service, hasher } = setup();

    await expect(service.login('no-existe', 'x')).rejects.toMatchObject({
      status: 401,
      code: 'INVALID_CREDENTIALS',
    });
    expect(hasher.compare).toHaveBeenCalledTimes(1);
  });

  it('CA-05.1 devuelve el analista con credenciales válidas', async () => {
    const { service } = setup({
      ana: { id: 7, username: 'ana', passwordHash: 'hashed:secreta' },
    });

    await expect(service.login('ana', 'secreta')).resolves.toEqual({ id: 7, username: 'ana' });
  });

  it('createOrUpdateAnalyst guarda solo el hash de la contraseña', async () => {
    const { service, analysts, hasher } = setup();

    await service.createOrUpdateAnalyst('ana', 'secreta');

    expect(hasher.hash).toHaveBeenCalledWith('secreta', 10);
    expect(analysts.get('ana').passwordHash).toBe('hashed:secreta');
  });
});
