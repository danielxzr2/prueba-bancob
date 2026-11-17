# ADR 0003: SQLite con better-sqlite3, sin ORM

**Estado:** aceptado

## Contexto

El reto pide una base de datos local ("SQLite o similar") y que el proyecto se ejecute sin servicios
externos (RNF-16).

## Decisión

- SQLite mediante `better-sqlite3`, con SQL escrito a mano y siempre parametrizado (RNF-06).
- El esquema (`src/db/schema.sql`) repite reglas de negocio como restricciones: `CHECK` del semestre
  y los estados, `UNIQUE COLLATE NOCASE` del correo, claves foráneas.
- La decisión del analista y su registro de auditoría se escriben en una sola transacción.

## Alternativas consideradas

- **`node:sqlite`** (incluido en Node): en Node 22 todavía es experimental.
- **Un ORM** (Prisma, Sequelize): más dependencias y abstracción para tres tablas; oculta el SQL
  que se quiere poder explicar.

## Consecuencias

- Las pruebas usan una base en memoria por prueba: rápidas y aisladas.
- `better-sqlite3` es un módulo nativo; tiene binarios precompilados para Windows, macOS y Linux.
- La restricción `UNIQUE` resuelve la carrera entre dos registros simultáneos con el mismo correo.
