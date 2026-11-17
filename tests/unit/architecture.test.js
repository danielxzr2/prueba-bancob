/**
 * Architecture tests (fitness functions): they fail if the code breaks the rules in
 * CLAUDE.md, so the architecture does not depend on someone remembering it.
 */
const fs = require('node:fs');
const path = require('node:path');

const SRC = path.join(__dirname, '..', '..', 'src');

/** { file, requires[] } for every .js file in a src/ subfolder. */
function modulesIn(folder) {
  const dir = path.join(SRC, folder);
  return fs
    .readdirSync(dir)
    .filter((name) => name.endsWith('.js'))
    .map((name) => {
      const code = fs.readFileSync(path.join(dir, name), 'utf8');
      const requires = [...code.matchAll(/require\(['"]([^'"]+)['"]\)/g)].map((m) => m[1]);
      return { file: `${folder}/${name}`, code, requires };
    });
}

describe('RNF-13 Arquitectura por capas (rutas -> servicios -> repositorios)', () => {
  it.each(['services', 'repositories'])('%s/ no depende de Express ni de HTTP', (folder) => {
    for (const { file, requires } of modulesIn(folder)) {
      expect({ file, requires }).toEqual({
        file,
        requires: requires.filter((r) => !/^(express|express-session|multer)$/.test(r)),
      });
    }
  });

  it('las rutas no acceden a los repositorios (pasan por los servicios)', () => {
    for (const { file, requires } of modulesIn('routes')) {
      expect({ file, repositories: requires.filter((r) => r.includes('repositories/')) }).toEqual({
        file,
        repositories: [],
      });
    }
  });

  it('los repositorios no dependen de servicios ni de rutas', () => {
    for (const { file, requires } of modulesIn('repositories')) {
      expect({ file, upward: requires.filter((r) => /(services|routes)\//.test(r)) }).toEqual({
        file,
        upward: [],
      });
    }
  });
});

describe('RNF-10 Los logs no contienen datos personales', () => {
  it.each(['routes', 'services', 'repositories', 'middleware'])(
    '%s/ no escribe en la consola directamente (solo el logger inyectado)',
    (folder) => {
      for (const { file, code } of modulesIn(folder)) {
        expect({ file, console: /console\.\w+\(/.test(code) }).toEqual({ file, console: false });
      }
    },
  );
});
