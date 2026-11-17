# ADR 0002: Sesión con cookie HttpOnly en lugar de JWT

**Estado:** aceptado

## Contexto

Los analistas deben autenticarse para usar el panel (RF-05, RNF-02). La aplicación se ejecuta en un
solo proceso, en local, y el frontend se sirve desde el mismo origen que la API.

## Decisión

- `express-session` con una cookie `sid` `HttpOnly` (no legible desde JavaScript) y
  `SameSite=Strict` (no se envía desde otros sitios, lo que mitiga CSRF), con duración de 2 horas.
- El id de sesión se regenera al iniciar sesión (contra fijación de sesión) y se destruye en el
  servidor al cerrarla.
- Contraseñas con bcrypt (costo 12). Si el usuario no existe se compara contra un hash ficticio para
  que el tiempo de respuesta no revele qué usuarios existen.
- Almacén de sesiones en memoria (el de `express-session` por defecto).
- `SESSION_SECRET` opcional: sin él se genera uno aleatorio en cada arranque.

## Alternativas consideradas

- **JWT en `localStorage`**: legible por cualquier script de la página (si hubiera XSS, el token se
  roba) y no se puede revocar antes de que expire; el logout real exigiría una lista de bloqueo.
- **JWT en cookie**: resuelve el robo por XSS, pero sigue sin revocación simple y no aporta nada en
  un solo servidor.

## Consecuencias

- El logout invalida la sesión de verdad (hay una prueba que reutiliza la cookie anterior).
- Las sesiones se pierden al reiniciar el servidor; aceptable para uso local.
- **Para producción** habría que: usar un almacén persistente (por ejemplo Redis), `secure: true`
  detrás de HTTPS, `SESSION_SECRET` obligatorio y límite de intentos de inicio de sesión.
