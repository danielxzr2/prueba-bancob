/**
 * Analyst login (RF-05).
 */
(function () {
  'use strict';

  const form = document.getElementById('login-form');
  const statusBox = document.getElementById('login-status');
  const submitButton = form.querySelector('button[type="submit"]');

  const goToPanel = () => window.location.assign('/panel.html');

  function showError(message) {
    statusBox.textContent = message;
    statusBox.className = message ? 'form-status error' : 'form-status';
  }

  // Already logged in: go straight to the panel.
  Api.request('GET', '/api/auth/me')
    .then((res) => {
      if (res.ok) goToPanel();
    })
    .catch(() => {});

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    showError('');

    const username = form.elements.username.value.trim();
    const password = form.elements.password.value;
    if (!username || !password) {
      showError('Escribe tu usuario y tu contraseña.');
      (username ? form.elements.password : form.elements.username).focus();
      return;
    }

    submitButton.disabled = true;
    try {
      const res = await Api.request('POST', '/api/auth/login', { json: { username, password } });
      if (res.ok) {
        goToPanel();
        return;
      }
      showError(Api.errorMessage(res));
      form.elements.password.value = '';
      form.elements.password.focus();
    } catch {
      showError('No hay conexión con el servidor. Intenta de nuevo.');
    } finally {
      submitButton.disabled = false;
    }
  });
})();
