# ADR 0001: El contrato OpenAPI se escribe primero y el servidor lo aplica

**Estado:** aceptado

## Contexto

La documentación de una API suele escribirse al final y quedar desactualizada. El reto pide una API
sencilla, pero la documentación prescriptiva (que dicta el comportamiento en lugar de describirlo)
es uno de los objetivos del proyecto.

## Decisión

- `docs/openapi.yaml` se escribió antes que cualquier ruta y cada operación declara en
  `x-requisitos` los requisitos que implementa.
- `express-openapi-validator` valida **cada petición** contra el contrato y, fuera de producción,
  **cada respuesta**: si el código se desvía del contrato, las pruebas fallan.
- Las reglas estructurales (tipos, longitudes, formatos) las aplica el contrato; las de negocio
  (longitud tras recortar espacios, firma PDF, correo único) las aplica el servicio.
- `allErrors: true` para informar todos los campos inválidos a la vez (CA-03.1). AJV advierte de su
  costo con entradas no confiables; aquí está acotado: JSON de 10 KB, `maxLength` en todas las
  cadenas, `additionalProperties: false` y ninguna expresión regular en el contrato.
- `coerceTypes: true` porque multipart envía todo como texto (`'7'` → `7`).

## Alternativas consideradas

- **Validación manual en cada ruta** (o con una librería como Joi/Zod): duplicaría el contrato y
  podrían divergir.
- **Generar el contrato desde el código**: lo vuelve descriptivo, no prescriptivo.

## Consecuencias

- El contrato no puede quedar desactualizado: es parte de la ejecución.
- Cambiar la API exige cambiar primero el contrato.
- Las pruebas detectaron dos problemas gracias a esto: los tipos de multipart y el validador que se
  detenía en el primer error.
