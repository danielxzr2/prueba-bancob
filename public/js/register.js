/**
 * Registration form (RF-01, RF-02).
 */
(function () {
  'use strict';

  const FIELDS = ['fullName', 'email', 'career', 'semester', 'cv', 'dataConsent'];

  const form = document.getElementById('registration-form');
  const statusBox = document.getElementById('form-status');
  const submitButton = form.querySelector('button[type="submit"]');

  function readForm() {
    return {
      fullName: form.elements.fullName.value,
      email: form.elements.email.value,
      career: form.elements.career.value,
      semester: form.elements.semester.value,
      cv: form.elements.cv.files[0] || null,
      dataConsent: form.elements.dataConsent.checked,
    };
  }

  /** Shows each error next to its field (CA-02.1) and focuses the first one. */
  function showFieldErrors(errors, { focus = true } = {}) {
    for (const field of FIELDS) {
      const input = form.elements[field];
      const message = errors[field] || '';
      document.getElementById(`${field}-error`).textContent = message;
      if (message) input.setAttribute('aria-invalid', 'true');
      else input.removeAttribute('aria-invalid');
    }
    const firstInvalid = FIELDS.find((field) => errors[field]);
    if (focus && firstInvalid) form.elements[firstInvalid].focus();
  }

  function showStatus(message, kind = '') {
    statusBox.textContent = message;
    statusBox.className = `form-status ${kind}`.trim();
  }

  /** Maps an API error to field messages, so server errors also appear next to the field. */
  function fieldErrorsFromResponse(res) {
    const error = res.data?.error;
    if (!error) return {};
    if (error.code === 'DUPLICATE_EMAIL') return { email: error.message };
    if (error.code === 'FILE_TOO_LARGE') return { cv: error.message };
    const errors = {};
    for (const detail of error.details || []) {
      if (FIELDS.includes(detail.field) && !errors[detail.field]) {
        errors[detail.field] = detail.message;
      }
    }
    return errors;
  }

  function toFormData(values) {
    const data = new FormData();
    data.append('fullName', values.fullName.trim());
    data.append('email', values.email.trim().toLowerCase());
    data.append('career', values.career.trim());
    data.append('semester', values.semester.trim());
    data.append('dataConsent', String(values.dataConsent));
    data.append('cv', values.cv);
    return data;
  }

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    showStatus('');

    const values = readForm();
    const errors = Validation.validateRegistration(values);
    showFieldErrors(errors);
    if (Object.keys(errors).length > 0) {
      showStatus('Revisa los campos marcados.', 'error');
      return;
    }

    submitButton.disabled = true;
    showStatus('Enviando…');
    try {
      const res = await Api.request('POST', '/api/applicants', { formData: toFormData(values) });
      if (res.status === 201) {
        form.reset();
        showFieldErrors({}, { focus: false });
        showStatus(
          '¡Listo! Recibimos tu postulación. El equipo de selección revisará tu información.',
          'success',
        );
        return;
      }
      const serverErrors = fieldErrorsFromResponse(res);
      if (Object.keys(serverErrors).length > 0) {
        showFieldErrors(serverErrors);
        showStatus('Revisa los campos marcados.', 'error');
      } else {
        showStatus(Api.errorMessage(res), 'error');
      }
    } catch {
      showStatus('No hay conexión con el servidor. Intenta de nuevo.', 'error');
    } finally {
      submitButton.disabled = false;
    }
  });

  // Once a field has been marked invalid, re-check it as the user corrects it.
  form.addEventListener('change', (event) => {
    const field = event.target.name;
    if (!FIELDS.includes(field) || !event.target.hasAttribute('aria-invalid')) return;
    const message = Validation.validateRegistration(readForm())[field] || '';
    document.getElementById(`${field}-error`).textContent = message;
    if (!message) event.target.removeAttribute('aria-invalid');
  });
})();
