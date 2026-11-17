# Plataforma de Selección de Practicantes

[![CI](https://github.com/danielxzr2/prueba-bancob/actions/workflows/ci.yml/badge.svg)](https://github.com/danielxzr2/prueba-bancob/actions/workflows/ci.yml)

Herramienta web para que **practicantes** registren su información y hoja de vida, y para que
**analistas de selección** revisen cada postulación y la marquen como _viable_ o _no viable_.

Construida con un enfoque **contract-first** y **TDD**: los requisitos y el contrato de la API se
escriben antes del código, y cada requisito se verifica con pruebas automatizadas
(ver [matriz de trazabilidad](docs/requisitos.md#6-matriz-de-trazabilidad)).

## Estado

| Funcionalidad                                                               | Requisitos           | Estado    |
| --------------------------------------------------------------------------- | -------------------- | --------- |
| API de registro de postulaciones (validación, PDF, 5 MB)                    | RF-01, RF-03, RF-04  | Hecho     |
| Inicio y cierre de sesión de analistas                                      | RF-05                | Hecho     |
| API del panel: listar, filtrar, detalle, decisión, bitácora, descarga de CV | RF-06 a RF-11        | Hecho     |
| Frontend: formulario y panel                                                | RF-02, RF-06 a RF-09 | Pendiente |

## Requisitos previos

- **Node.js 22.9 o superior** (`node --version`)
- **npm 10 o superior** (incluido con Node.js)

No se necesita ninguna base de datos ni servicio externo: SQLite se crea automáticamente.

> `better-sqlite3` descarga un binario precompilado para Windows, macOS y Linux. Solo en plataformas
> poco comunes necesitaría compilarse (Python y un compilador de C++).

## Instalación y ejecución

```bash
git clone https://github.com/danielxzr2/prueba-bancob.git
cd prueba-bancob
npm install
npm run seed   # crea el analista de prueba (ver abajo)
npm run dev
```

El servidor queda disponible en **http://localhost:3000** y se reinicia solo al cambiar el código.
Para ejecutarlo sin recarga automática: `npm start`.

### Usuario analista

`npm run seed` crea el usuario **`analista`**. En el repositorio no hay ninguna contraseña escrita:

- Si defines `ANALYST_PASSWORD` en `.env`, se usa esa contraseña.
- Si no, el comando **genera una aleatoria y la muestra una sola vez** en la consola.

Puedes volver a ejecutar `npm run seed` en cualquier momento para cambiar la contraseña.

### Probar la API

Registrar una postulación (reemplaza la ruta por la de un PDF real):

```bash
curl -X POST http://localhost:3000/api/applicants \
  -F fullName="Ana María Pérez" \
  -F email=ana.perez@example.com \
  -F career="Ingeniería de Sistemas" \
  -F semester=7 \
  -F dataConsent=true \
  -F cv=@/ruta/a/hoja-de-vida.pdf
```

Respuesta esperada (`201 Created`):

```json
{ "id": 1, "status": "PENDIENTE", "createdAt": "2026-11-17T03:00:00.000Z" }
```

Si algún dato es inválido, la API responde `400` con el detalle de **todos** los campos con error.

Iniciar sesión como analista (guarda la cookie de sesión en `cookies.txt`):

```bash
curl -c cookies.txt -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username": "analista", "password": "<contraseña del seed>"}'

curl -b cookies.txt http://localhost:3000/api/auth/me      # {"username":"analista"}
```

Con la sesión iniciada, el panel del analista:

```bash
curl -b cookies.txt "http://localhost:3000/api/applicants?status=PENDIENTE"   # listar (filtro opcional)
curl -b cookies.txt http://localhost:3000/api/applicants/1                    # detalle

curl -b cookies.txt -X PUT http://localhost:3000/api/applicants/1/status \
  -H "Content-Type: application/json" -d '{"status": "VIABLE"}'              # VIABLE o NO_VIABLE

curl -b cookies.txt http://localhost:3000/api/applicants/1/status-history     # bitácora de decisiones
curl -b cookies.txt -OJ http://localhost:3000/api/applicants/1/cv             # descarga CV-<nombre>.pdf

curl -b cookies.txt -X POST http://localhost:3000/api/auth/logout
```

| Método | Ruta                                   | Descripción                    | Sesión |
| ------ | -------------------------------------- | ------------------------------ | ------ |
| POST   | `/api/applicants`                      | Registrar postulación          | No     |
| POST   | `/api/auth/login` · `/api/auth/logout` | Iniciar y cerrar sesión        | —      |
| GET    | `/api/auth/me`                         | Sesión actual                  | Sí     |
| GET    | `/api/applicants?status=`              | Listar practicantes            | Sí     |
| GET    | `/api/applicants/{id}`                 | Detalle                        | Sí     |
| PUT    | `/api/applicants/{id}/status`          | Marcar como viable o no viable | Sí     |
| GET    | `/api/applicants/{id}/status-history`  | Bitácora de decisiones         | Sí     |
| GET    | `/api/applicants/{id}/cv`              | Descargar hoja de vida         | Sí     |

La especificación completa de la API está en [`docs/openapi.yaml`](docs/openapi.yaml).

## Pruebas y calidad

```bash
npm test               # pruebas unitarias y de integración (Jest + Supertest)
npm run test:coverage  # pruebas + reporte de cobertura en coverage/lcov-report/index.html
npm run lint           # ESLint
npm run format:check   # verificar formato (Prettier); npm run format lo corrige
```

Las pruebas usan una base de datos en memoria y carpetas temporales: no tocan los datos locales.
GitHub Actions ejecuta lint, formato y pruebas en cada push a `main`.

## Configuración

Todo funciona sin configuración. Para cambiar algún valor, copia `.env.example` como `.env`:

| Variable           | Por defecto                | Descripción                                                                   |
| ------------------ | -------------------------- | ----------------------------------------------------------------------------- |
| `PORT`             | `3000`                     | Puerto del servidor                                                           |
| `DATABASE_PATH`    | `data/app.sqlite`          | Archivo de la base de datos SQLite                                            |
| `UPLOADS_DIR`      | `uploads`                  | Carpeta privada donde se guardan las hojas de vida                            |
| `SESSION_SECRET`   | aleatorio en cada arranque | Secreto de la cookie de sesión. Sin él, las sesiones se cierran al reiniciar. |
| `ANALYST_USERNAME` | `analista`                 | Usuario que crea `npm run seed`                                               |
| `ANALYST_PASSWORD` | aleatoria                  | Contraseña que asigna `npm run seed` (mínimo 8 caracteres)                    |

Para reiniciar los datos locales, detén el servidor y borra las carpetas `data/` y `uploads/`.

## Estructura del proyecto

```
docs/
  requisitos.md     Requisitos funcionales y no funcionales, criterios de aceptación y trazabilidad
  openapi.yaml      Contrato de la API (el servidor valida cada petición y respuesta contra él)
src/
  app.js            Construcción de la app y conexión de dependencias
  server.js         Punto de entrada
  routes/           Capa HTTP
  services/         Reglas de negocio y almacenamiento de archivos
  repositories/     Acceso a datos (consultas parametrizadas)
  db/               Esquema SQLite
  middleware/       Manejo de errores y protección de rutas (sesión)
scripts/
  seed.js           Crea o actualiza el analista de prueba
tests/
  unit/             Pruebas de servicios y utilidades
  integration/      Pruebas de la API de extremo a extremo con Supertest
CLAUDE.md           Reglas de trabajo para asistentes de IA en este repositorio
```

## Documentación

- [Requisitos y criterios de aceptación](docs/requisitos.md)
- [Contrato de la API (OpenAPI 3.0)](docs/openapi.yaml)
- [Reglas para asistentes de IA](CLAUDE.md)
