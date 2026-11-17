/**
 * Minimal helper to build DOM elements safely (RNF-07).
 *
 *   Dom.h('p', { className: 'note' }, 'Hola ', name)
 *
 * String children always become text nodes, never HTML: a name like
 * "<img src=x onerror=alert(1)>" is shown literally. ESLint forbids innerHTML in this
 * folder, so this is the only way the frontend creates markup.
 */
(function (root) {
  'use strict';

  function h(tag, props = {}, ...children) {
    const element = document.createElement(tag);

    for (const [key, value] of Object.entries(props)) {
      if (value === undefined || value === null || value === false) continue;
      if (key === 'className') {
        element.className = value;
      } else if (key.startsWith('on') && typeof value === 'function') {
        element.addEventListener(key.slice(2).toLowerCase(), value);
      } else {
        element.setAttribute(key, value === true ? '' : String(value));
      }
    }

    for (const child of children.flat()) {
      if (child === undefined || child === null || child === false) continue;
      element.append(child instanceof Node ? child : document.createTextNode(String(child)));
    }
    return element;
  }

  root.Dom = { h };
})(window);
