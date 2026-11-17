# ADR 0004: Hojas de vida: validar en memoria, guardar con UUID, sin acceso directo

**Estado:** aceptado

## Contexto

Las hojas de vida son datos personales y los archivos subidos por usuarios son una fuente clásica de
ataques: ejecutables disfrazados, nombres de archivo maliciosos, acceso directo por URL.

## Decisión

- El archivo se recibe **en memoria** (límite de 5 MB, RNF-05) y solo se escribe en disco después de
  pasar todas las validaciones: una postulación rechazada no deja archivos.
- El tipo se verifica por **contenido** (firma `%PDF-`), no por la extensión ni por el tipo MIME,
  que los elige el cliente (RNF-04).
- Se guarda con un nombre generado (`<uuid>.pdf`) y modo `wx` (nunca sobrescribe). El nombre
  original no toca el sistema de archivos.
- La carpeta `uploads/` **no se sirve** como estática; la única vía es
  `GET /api/applicants/{id}/cv`, que exige sesión (RNF-03).
- El nombre de descarga se normaliza a `[a-z0-9-]` (`CV-ana-maria-perez.pdf`) para que un nombre con
  comillas o saltos de línea no pueda inyectar cabeceras HTTP.
- Si la inserción en la base falla, el archivo ya guardado se elimina.

## Alternativas consideradas

- **Guardar el PDF en la base de datos (BLOB)**: el reto pide explícitamente una carpeta del
  servidor.
- **Servir `uploads/` como estático**: cualquiera con la URL accedería a datos personales.

## Consecuencias

- La firma `%PDF-` no garantiza que el PDF sea inofensivo; en producción se agregaría un antivirus
  y un límite de páginas.
