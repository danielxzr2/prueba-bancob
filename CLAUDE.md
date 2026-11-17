# CLAUDE.md

Instrucciones para asistentes de IA que colaboran en este repositorio. El autor humano es responsable
de cada línea y debe poder explicarla; la IA propone, el autor decide y verifica.

## Proyecto
Plataforma de selección de practicantes (reto técnico). Node.js + Express, SQLite, frontend HTML/CSS/JS sin framework.

## Fuentes de verdad (documentación prescriptiva)
- `docs/requisitos.md` — requisitos funcionales y no funcionales con criterios de aceptación (RF-xx, RNF-xx, CA-xx.x).
- `docs/openapi.yaml` — contrato de la API. Se modifica **antes** que las rutas.
- `docs/adr/` — decisiones de arquitectura.

No implementes nada que no esté trazado a un requisito. Si algo falta o es ambiguo, propón el cambio al documento primero.

## Flujo de trabajo obligatorio (TDD)
1. Escribir la prueba del criterio de aceptación y verificar que **falla**.
2. Implementar lo mínimo para que pase.
3. Refactorizar con las pruebas en verde.
4. Actualizar la matriz de trazabilidad en `docs/requisitos.md`.

Los nombres de las pruebas incluyen el ID: `describe('RF-04 Correo único', ...)`, `it('CA-04.1 responde 409 si el correo existe', ...)`.

## Convenciones
- Código, identificadores y nombres de archivos en inglés; documentación, mensajes de commit y textos de la interfaz en español.
- Commits convencionales y pequeños: `test:`, `feat:`, `fix:`, `refactor:`, `docs:`, `chore:`. Referenciar el requisito: `feat(RF-04): rechazar correo duplicado`.
- Capas: `routes/` → `services/` → `repositories/`. Los servicios no importan Express.
- Errores con el formato uniforme de RNF-15.

## Reglas de seguridad (no negociables)
- Consultas SQL siempre parametrizadas.
- Nunca servir `uploads/` como estático; los CV se acceden solo por la ruta autenticada.
- Nunca registrar datos personales ni contraseñas en logs.
- No versionar `.env`, `uploads/` ni bases de datos `.sqlite`.
- No agregar dependencias sin justificarlas.

## Comandos
_(Se completan al crear el proyecto: `npm run dev`, `npm test`, `npm run lint`, `npm run seed`.)_
