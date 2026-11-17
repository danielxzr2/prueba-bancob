const net = require('node:net');
const express = require('express');
const { startServer } = require('../../src/startServer');

describe('Arranque del servidor (RNF-16)', () => {
  it('rechaza con EADDRINUSE si el puerto está ocupado, en lugar de anunciar que escucha', async () => {
    const blocker = net.createServer();
    await new Promise((resolve) => blocker.listen(0, resolve));
    const { port } = blocker.address();

    try {
      await expect(startServer(express(), port)).rejects.toMatchObject({ code: 'EADDRINUSE' });
    } finally {
      blocker.close();
    }
  });

  it('resuelve con el servidor escuchando si el puerto está libre', async () => {
    const server = await startServer(express(), 0);

    expect(server.listening).toBe(true);
    await new Promise((resolve) => server.close(resolve));
  });
});
