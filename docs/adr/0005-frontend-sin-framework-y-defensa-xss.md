# ADR 0005: Frontend sin framework con defensa contra XSS en tres capas

**Estado:** aceptado

## Contexto

El frontend tiene tres páginas sencillas. Los datos que muestra el panel los escribe cualquier
persona en el formulario público, así que un nombre puede contener HTML o JavaScript (RNF-07).

## Decisión

- HTML, CSS y JavaScript sin framework ni paso de compilación, servidos por el mismo Express.
- Las reglas de validación del navegador (`public/js/validation.js`) son las mismas del servidor y
  se prueban con los mismos casos.
- Defensa contra XSS en tres capas:
  1. **Código:** los datos se pintan solo con `textContent` mediante `Dom.h`; nunca como HTML.
  2. **Lint:** ESLint prohíbe `innerHTML`, `outerHTML`, `insertAdjacentHTML` y `document.write` en
     `public/`. El CI falla si alguien los usa: la regla no depende de la memoria del equipo.
  3. **Navegador:** una Content-Security-Policy sin `unsafe-inline` solo permite scripts propios;
     aunque se colara HTML, un script inyectado no se ejecutaría.

## Alternativas consideradas

- **React/Vue**: escapan por defecto, pero agregan dependencias y compilación para tres
  formularios, y su protección se puede saltar con `dangerouslySetInnerHTML` / `v-html`.
- **Sanitizar el HTML** (DOMPurify): innecesario si nunca se interpreta HTML.

## Consecuencias

- Verificado en Firefox: un nombre `<img src=x onerror=...>` se muestra literal y no se ejecuta.
- Sin estilos ni scripts en línea (la CSP los bloquearía); todo está en archivos.
