# Registro de decisiones de arquitectura (ADR)

Cada ADR documenta una decisión relevante: el contexto, lo que se decidió, las alternativas
consideradas y sus consecuencias. Se escriben en el momento de la decisión y no se editan después:
si una decisión cambia, se agrega un ADR nuevo que la reemplaza.

| ADR                                                    | Decisión                                                                |
| ------------------------------------------------------ | ----------------------------------------------------------------------- |
| [0001](0001-contrato-openapi-como-fuente-de-verdad.md) | El contrato OpenAPI se escribe primero y el servidor lo aplica          |
| [0002](0002-sesion-con-cookie-en-lugar-de-jwt.md)      | Sesión con cookie HttpOnly en lugar de JWT                              |
| [0003](0003-sqlite-con-better-sqlite3.md)              | SQLite con better-sqlite3, sin ORM                                      |
| [0004](0004-almacenamiento-de-hojas-de-vida.md)        | Hojas de vida: validar en memoria, guardar con UUID, sin acceso directo |
| [0005](0005-frontend-sin-framework-y-defensa-xss.md)   | Frontend sin framework con defensa contra XSS en tres capas             |
| [0006](0006-estrategia-de-pruebas.md)                  | TDD, mutaciones manuales y E2E en navegador real                        |
