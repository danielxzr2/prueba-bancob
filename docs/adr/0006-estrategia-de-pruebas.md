# ADR 0006: TDD, mutaciones manuales y E2E en navegador real

**Estado:** aceptado

## Contexto

Las pruebas deben escribirse durante el desarrollo, no después (RNF-11), y tiene que ser posible
confiar en que prueban lo que dicen.

## Decisión

- **TDD visible en el historial**: cada funcionalidad tiene un commit `test(...)` en rojo antes del
  commit `feat(...)`. Los nombres de las pruebas incluyen el criterio de aceptación (`CA-04.1 ...`) y
  la [matriz de trazabilidad](../requisitos.md#6-matriz-de-trazabilidad) une requisitos y pruebas.
- **Pirámide**: pruebas unitarias de servicios y reglas puras; de integración de la API con
  Supertest sobre SQLite en memoria; y una prueba E2E en un navegador real.
- **Mutaciones manuales**: tras cada ciclo se rompe el código a propósito (quitar una validación,
  cambiar un límite, saltarse la transacción) y se comprueba que alguna prueba falla. Se eligió
  hacerlo manualmente en lugar de con una herramienta como Stryker por tiempo, pero de forma
  sistemática.
- **Pruebas de arquitectura**: fallan si un servicio importa Express o una ruta accede a un
  repositorio (RNF-13).
- **E2E** (`npm run test:e2e`): maneja Firefox headless con WebDriver BiDi usando el `WebSocket` de
  Node, sin dependencias nuevas. No corre en CI porque no hay navegador.

## Alternativas consideradas

- **Playwright/Cypress para E2E**: más robustos y conocidos, pero descargan navegadores y suman
  dependencias pesadas; para 16 controles bastó el protocolo estándar que Firefox ya incluye.
- **Cobertura como meta**: se mide (96 % de líneas), pero no se usa como objetivo: una prueba puede
  cubrir una línea sin verificarla. Las mutaciones miden eso mejor.

## Consecuencias

- Las mutaciones encontraron huecos reales que la cobertura no mostraba: pruebas que pasaban por la
  razón equivocada, un logout que no invalidaba la sesión en el servidor y una bitácora que podía
  registrar al analista equivocado.
