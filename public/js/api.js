/**
 * Thin wrapper over fetch for the API (docs/openapi.yaml).
 * Always resolves to { status, ok, data }; it only rejects on network failure.
 * Errors follow the uniform format { error: { code, message, details } } (RNF-15).
 */
(function (root) {
  'use strict';

  async function request(method, url, { json, formData } = {}) {
    const options = {
      method,
      credentials: 'same-origin', // send the session cookie
      headers: { Accept: 'application/json' },
    };
    if (json !== undefined) {
      options.headers['Content-Type'] = 'application/json';
      options.body = JSON.stringify(json);
    }
    if (formData) options.body = formData; // the browser sets the multipart boundary

    const response = await fetch(url, options);
    const isJson = (response.headers.get('Content-Type') || '').includes('application/json');
    const data = isJson ? await response.json() : null;
    return { status: response.status, ok: response.ok, data };
  }

  /** Message to show for a failed response. */
  const errorMessage = (res, fallback = 'Ocurrió un error. Intenta de nuevo.') =>
    res.data?.error?.message || fallback;

  root.Api = { request, errorMessage };
})(window);
