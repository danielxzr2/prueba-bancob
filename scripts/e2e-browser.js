/**
 * End-to-end test in a real browser (headless Firefox).
 *
 *   npm run test:e2e                 # runs the checks
 *   npm run test:e2e -- --screenshots  # also updates the screenshots in docs/img/
 *
 * It starts the app in-process with a temporary database and uploads folder, creates an
 * analyst, and drives Firefox through WebDriver BiDi (built into Firefox) using Node's
 * WebSocket: no extra dependencies. Requires Firefox; set FIREFOX_BIN if it is not on
 * the PATH. Not part of CI, which has no browser; `npm test` covers the API and logic.
 */
const fs = require('node:fs');
const os = require('node:os');
const net = require('node:net');
const path = require('node:path');
const { spawn } = require('node:child_process');

const { loadConfig, PROJECT_ROOT } = require('../src/config');
const { openDatabase } = require('../src/db/database');
const { createApp } = require('../src/app');
const { createAnalystRepository } = require('../src/repositories/analystRepository');
const { createAuthService } = require('../src/services/authService');

const FIREFOX_BIN = process.env.FIREFOX_BIN || 'firefox';
const SCREENSHOTS = process.argv.includes('--screenshots');
const SCREENSHOT_DIR = path.join(PROJECT_ROOT, 'docs', 'img');
const ANALYST = { username: 'analista', password: 'E2E-contraseña-segura' };
const TIMEOUT_MS = 10_000;

// ---- Infrastructure --------------------------------------------------------

const freePort = () =>
  new Promise((resolve, reject) => {
    const server = net.createServer().listen(0, '127.0.0.1', () => {
      const { port } = server.address();
      server.close(() => resolve(port));
    });
    server.on('error', reject);
  });

async function startApp(tempDir) {
  const config = {
    ...loadConfig({}),
    databasePath: path.join(tempDir, 'app.sqlite'),
    uploadsDir: path.join(tempDir, 'uploads'),
  };
  fs.mkdirSync(config.uploadsDir);
  const db = openDatabase(config.databasePath);
  const authService = createAuthService({
    analystRepository: createAnalystRepository(db),
    bcryptCost: config.bcryptCost,
  });
  await authService.createOrUpdateAnalyst(ANALYST.username, ANALYST.password);

  const app = createApp({ db, config });
  const port = await freePort();
  const server = await new Promise((resolve) => {
    const s = app.listen(port, '127.0.0.1', () => resolve(s));
  });
  return {
    baseUrl: `http://127.0.0.1:${port}`,
    stop: () => new Promise((resolve) => server.close(() => resolve(db.close()))),
  };
}

async function startFirefox(tempDir) {
  const port = await freePort();
  const profile = path.join(tempDir, 'firefox-profile');
  fs.mkdirSync(profile);
  const child = spawn(FIREFOX_BIN, [
    '--headless',
    '--no-remote',
    '--profile',
    profile,
    '--remote-debugging-port',
    String(port),
  ]);

  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Firefox no inició a tiempo.')), 30_000);
    const onData = (chunk) => {
      if (String(chunk).includes('WebDriver BiDi listening')) {
        clearTimeout(timer);
        resolve();
      }
    };
    child.stdout.on('data', onData);
    child.stderr.on('data', onData);
    child.on('error', (err) => {
      clearTimeout(timer);
      reject(
        err.code === 'ENOENT'
          ? new Error(`No se encontró Firefox ("${FIREFOX_BIN}"). Instálalo o define FIREFOX_BIN.`)
          : err,
      );
    });
  });

  return {
    url: `ws://127.0.0.1:${port}/session`,
    stop: () =>
      new Promise((resolve) => {
        if (child.exitCode !== null) return resolve();
        child.once('exit', resolve);
        child.kill();
      }),
  };
}

/** Minimal WebDriver BiDi client. */
async function connectBidi(url) {
  const ws = new WebSocket(url);
  await new Promise((resolve, reject) => {
    ws.onopen = resolve;
    ws.onerror = () => reject(new Error('No fue posible conectar con Firefox.'));
  });
  let nextId = 1;
  const pending = new Map();
  ws.onmessage = (event) => {
    const msg = JSON.parse(event.data);
    const waiter = msg.id && pending.get(msg.id);
    if (!waiter) return;
    pending.delete(msg.id);
    if (msg.type === 'error') waiter.reject(new Error(`${msg.error}: ${msg.message}`));
    else waiter.resolve(msg.result);
  };
  const send = (method, params = {}) =>
    new Promise((resolve, reject) => {
      const id = nextId++;
      pending.set(id, { resolve, reject });
      ws.send(JSON.stringify({ id, method, params }));
    });
  return { send, close: () => ws.close() };
}

/** Browser helpers bound to one tab. */
function createPage(bidi, context, baseUrl) {
  const evaluate = async (body) => {
    const res = await bidi.send('script.evaluate', {
      expression: `(async () => { ${body} })()`,
      target: { context },
      awaitPromise: true,
    });
    if (res.type === 'exception') throw new Error(`JS: ${res.exceptionDetails.text}`);
    return res.result.value;
  };

  return {
    evaluate,
    goto: (url) =>
      bidi.send('browsingContext.navigate', { context, url: baseUrl + url, wait: 'complete' }),
    /** Waits until `expression` is truthy in the page and returns its value. */
    async waitFor(expression, description) {
      const deadline = Date.now() + TIMEOUT_MS;
      while (Date.now() < deadline) {
        const value = await evaluate(`try { return ${expression}; } catch { return null; }`);
        if (value) return value;
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
      throw new Error(`Tiempo agotado esperando: ${description}`);
    },
    async screenshot(name) {
      if (!SCREENSHOTS) return;
      const { data } = await bidi.send('browsingContext.captureScreenshot', {
        context,
        origin: 'document', // the whole page, not only the visible part
      });
      fs.writeFileSync(path.join(SCREENSHOT_DIR, `${name}.png`), Buffer.from(data, 'base64'));
    },
  };
}

// ---- Checks ----------------------------------------------------------------

const results = [];
function check(description, passed, detail = '') {
  results.push(passed);
  console.log(`${passed ? '  ✓' : '  ✗'} ${description}${passed || !detail ? '' : ` (${detail})`}`);
}

/** Fills and submits the registration form, as a user would. */
const submitRegistration = (page, { fullName, email, career, semester }) =>
  page.evaluate(`
    const form = document.getElementById('registration-form');
    form.fullName.value = ${JSON.stringify(fullName)};
    form.email.value = ${JSON.stringify(email)};
    form.career.value = ${JSON.stringify(career)};
    form.semester.value = ${JSON.stringify(String(semester))};
    form.dataConsent.checked = true;
    const pdf = new File(['%PDF-1.4\\n%%EOF\\n'], 'hoja de vida.pdf', { type: 'application/pdf' });
    const files = new DataTransfer();
    files.items.add(pdf);
    form.cv.files = files.files;
    form.querySelector('button[type=submit]').click();`);

const formStatus = `document.getElementById('form-status').textContent`;
const clickButton = (page, scope, text) =>
  page.evaluate(`[...document.querySelectorAll(${JSON.stringify(`${scope} button`)})]
    .find((b) => b.textContent.trim() === ${JSON.stringify(text)}).click();`);

async function run(page) {
  console.log('Formulario de postulación');
  await page.goto('/');
  await page.evaluate(`document.querySelector('#registration-form button[type=submit]').click();`);
  await page.waitFor(`document.getElementById('fullName-error').textContent`, 'errores');
  const invalid = await page.evaluate(
    `return ['fullName','email','career','semester','cv','dataConsent']
      .every((f) => document.getElementById(f + '-error').textContent &&
                    document.getElementById(f).getAttribute('aria-invalid') === 'true');`,
  );
  check('CA-02.1 formulario vacío: un error junto a cada campo', invalid);
  check(
    'RNF-17 el foco va al primer campo inválido',
    (await page.evaluate(`return document.activeElement.id;`)) === 'fullName',
  );
  await page.screenshot('01-validacion-formulario');

  const applicants = [
    {
      fullName: 'María Fernanda Rodríguez',
      email: 'maria.rodriguez@example.com',
      career: 'Ingeniería de Sistemas',
      semester: 8,
    },
    {
      fullName: 'Carlos Andrés Gómez',
      email: 'carlos.gomez@example.com',
      career: 'Economía',
      semester: 6,
    },
    {
      fullName: 'Ana María Pérez',
      email: 'ana.perez@example.com',
      career: 'Administración de Empresas',
      semester: 7,
    },
  ];
  for (const applicant of applicants) {
    await page.goto('/');
    await submitRegistration(page, applicant);
    await page.waitFor(`${formStatus}.includes('Recibimos')`, 'confirmación de registro');
  }
  check('RF-01 tres postulaciones registradas desde el navegador', true);
  await page.screenshot('02-registro-exitoso');

  await page.goto('/');
  await submitRegistration(page, { ...applicants[0], fullName: 'Otra Persona' });
  const duplicate = await page.waitFor(
    `document.getElementById('email-error').textContent`,
    'error de correo duplicado',
  );
  check('RF-04 el correo duplicado (409) se muestra junto al campo', /Ya existe/.test(duplicate));

  console.log('Inicio de sesión');
  await page.goto('/panel.html');
  await page.waitFor(`location.pathname === '/login.html'`, 'redirección al login');
  check('RNF-02 el panel sin sesión redirige al login', true);
  const login = (password) =>
    page.evaluate(`const form = document.getElementById('login-form');
      form.username.value = ${JSON.stringify(ANALYST.username)};
      form.password.value = ${JSON.stringify(password)};
      form.querySelector('button').click();`);
  await login('incorrecta');
  const loginError = await page.waitFor(
    `document.getElementById('login-status').textContent`,
    'error de login',
  );
  check('CA-05.2 contraseña incorrecta muestra un error', /incorrectos/.test(loginError));
  await login(ANALYST.password);
  await page.waitFor(`location.pathname === '/panel.html'`, 'llegada al panel');
  check('CA-05.1 el login correcto lleva al panel', true);

  console.log('Panel del analista');
  const rows = await page.waitFor(
    `document.querySelectorAll('#applicants-body tr').length`,
    'filas del listado',
  );
  check('RF-06 el panel lista las tres postulaciones', rows === 3, `${rows} filas`);

  await clickButton(page, '#applicants-body', 'Carlos Andrés Gómez');
  await page.waitFor(`document.getElementById('detail-title')`, 'detalle');
  check(
    'RF-07 el detalle muestra el correo',
    (await page.evaluate(`return document.getElementById('detail').textContent;`)).includes(
      'carlos.gomez@example.com',
    ),
  );
  check(
    'RNF-17 el foco pasa al título del detalle',
    (await page.evaluate(`return document.activeElement.id;`)) === 'detail-title',
  );

  await clickButton(page, '#detail', 'Marcar como no viable');
  await page.waitFor(`document.querySelectorAll('#detail .history li').length === 1`, 'decisión 1');
  await clickButton(page, '#detail', 'Marcar como viable');
  await page.waitFor(`document.querySelectorAll('#detail .history li').length === 2`, 'decisión 2');
  // BiDi serializes arrays as remote values, so lists come back as JSON.
  const history = JSON.parse(
    await page.evaluate(
      `return JSON.stringify([...document.querySelectorAll('#detail .history li')].map((li) => li.textContent));`,
    ),
  );
  check(
    'RF-08/RF-10 dos decisiones registradas en la bitácora con el analista',
    history.every((entry) => entry.includes('por analista')),
  );
  await clickButton(page, '#applicants-body', 'María Fernanda Rodríguez');
  await page.waitFor(
    `document.getElementById('detail-title').textContent.includes('María')`,
    'detalle',
  );
  await clickButton(page, '#detail', 'Marcar como viable');
  await page.waitFor(`document.querySelectorAll('#detail .history li').length === 1`, 'decisión');
  await clickButton(page, '#applicants-body', 'Carlos Andrés Gómez');
  await page.waitFor(`document.querySelectorAll('#detail .history li').length === 2`, 'detalle');
  await page.screenshot('03-panel-detalle');

  const download = JSON.parse(
    await page.evaluate(`const href = document.querySelector('#detail a[download]').getAttribute('href');
      const res = await fetch(href);
      return JSON.stringify([res.status, res.headers.get('content-disposition'), (await res.text()).slice(0, 5)]);`),
  );
  check(
    'RF-09 el enlace descarga el PDF con nombre legible',
    download[0] === 200 &&
      download[1].includes('CV-carlos-andres-gomez.pdf') &&
      download[2] === '%PDF-',
    download.join(' · '),
  );

  await page.evaluate(`const filter = document.getElementById('status-filter');
    filter.value = 'PENDIENTE'; filter.dispatchEvent(new Event('change'));`);
  const pendingRows = await page.waitFor(
    `document.querySelectorAll('#applicants-body tr').length === 1 && 1`,
    'filtro aplicado',
  );
  check('RF-11 el filtro "Pendiente" muestra solo pendientes', pendingRows === 1);

  console.log('Seguridad en el navegador');
  const xssName = '<img src=x onerror="window.__xss=1">Prueba XSS';
  await page.goto('/');
  await submitRegistration(page, {
    fullName: xssName,
    email: 'xss@example.com',
    career: 'Seguridad',
    semester: 5,
  });
  await page.waitFor(`${formStatus}.includes('Recibimos')`, 'registro del nombre malicioso');
  await page.goto('/panel.html');
  const shown = await page.waitFor(
    `[...document.querySelectorAll('#applicants-body button')].map((b) => b.textContent).find((t) => t.includes('XSS'))`,
    'nombre malicioso en la lista',
  );
  check('RNF-07 un nombre con HTML se muestra como texto literal', shown === xssName, shown);
  check(
    'RNF-07 el código inyectado no se ejecuta',
    await page.evaluate(`return window.__xss === undefined &&
      document.querySelectorAll('#applicants-body img').length === 0;`),
  );
  await page.screenshot('04-xss-mostrado-como-texto');

  console.log('Cierre de sesión');
  await page.evaluate(`document.getElementById('logout-button').click();`);
  await page.waitFor(`location.pathname === '/login.html'`, 'vuelta al login');
  check('CA-05.3 cerrar sesión vuelve al login', true);
}

// ---- Main ------------------------------------------------------------------

async function main() {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'prueba-bancob-e2e-'));
  const cleanups = [];
  try {
    const app = await startApp(tempDir);
    cleanups.push(app.stop);
    const firefox = await startFirefox(tempDir);
    cleanups.push(firefox.stop);
    const bidi = await connectBidi(firefox.url);
    cleanups.push(async () => {
      await bidi.send('session.end').catch(() => {});
      bidi.close();
    });

    await bidi.send('session.new', { capabilities: {} });
    const { contexts } = await bidi.send('browsingContext.getTree', {});
    const context = contexts[0].context;
    await bidi.send('browsingContext.setViewport', {
      context,
      viewport: { width: 1280, height: 900 },
    });
    if (SCREENSHOTS) fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });

    await run(createPage(bidi, context, app.baseUrl));
  } catch (err) {
    results.push(false);
    console.error(`\nError: ${err.message}`);
  } finally {
    for (const cleanup of cleanups.reverse()) await cleanup().catch(() => {});
    fs.rmSync(tempDir, { recursive: true, force: true });
  }

  const passed = results.filter(Boolean).length;
  console.log(`\n${passed}/${results.length} controles en el navegador`);
  if (SCREENSHOTS && passed === results.length) console.log(`Capturas en ${SCREENSHOT_DIR}`);
  process.exitCode = passed === results.length ? 0 : 1;
}

main();
