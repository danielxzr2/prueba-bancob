/* global module */
/**
 * Client-side validation of the registration form (RF-02).
 *
 * Same rules as the server (RF-03, docs/requisitos.md). This layer is for the user's
 * convenience only: it can be bypassed, so the server validates everything again.
 *
 * Runs in the browser (window.Validation) and in Node for the unit tests (module.exports).
 */
(function (root) {
  'use strict';

  const MAX_CV_BYTES = 5 * 1024 * 1024;
  const MAX_EMAIL_LENGTH = 254;
  const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  const asText = (value) => String(value ?? '').trim();

  function checkText(value, { label, required, min, max }) {
    const text = asText(value);
    if (!text) return `${label} es ${required}.`;
    if (text.length < min || text.length > max) {
      return `${label} debe tener entre ${min} y ${max} caracteres.`;
    }
    return null;
  }

  function checkEmail(value) {
    const email = asText(value);
    if (!email) return 'El correo electrónico es obligatorio.';
    if (email.length > MAX_EMAIL_LENGTH) {
      return `El correo no puede superar ${MAX_EMAIL_LENGTH} caracteres.`;
    }
    if (!EMAIL_PATTERN.test(email))
      return 'Escribe un correo válido, por ejemplo nombre@dominio.com.';
    return null;
  }

  function checkSemester(value) {
    const text = asText(value);
    if (!text) return 'El semestre es obligatorio.';
    if (!/^\d+$/.test(text)) return 'El semestre debe ser un número entero.';
    const semester = Number(text);
    if (semester < 1 || semester > 12) return 'El semestre debe estar entre 1 y 12.';
    return null;
  }

  function checkCv(file) {
    if (!file) return 'Adjunta tu hoja de vida.';
    const looksLikePdf = file.type === 'application/pdf' || /\.pdf$/i.test(file.name || '');
    if (!looksLikePdf) return 'La hoja de vida debe ser un archivo PDF.';
    if (file.size === 0) return 'El archivo está vacío.';
    if (file.size > MAX_CV_BYTES) return 'La hoja de vida no puede superar 5 MB.';
    return null;
  }

  /**
   * Validates the form values and returns { field: message } for every invalid field.
   * An empty object means the form is valid.
   */
  function validateRegistration(form) {
    const checks = {
      fullName: checkText(form.fullName, {
        label: 'El nombre completo',
        required: 'obligatorio',
        min: 3,
        max: 100,
      }),
      email: checkEmail(form.email),
      career: checkText(form.career, {
        label: 'La carrera',
        required: 'obligatoria',
        min: 2,
        max: 100,
      }),
      semester: checkSemester(form.semester),
      cv: checkCv(form.cv),
      dataConsent: form.dataConsent
        ? null
        : 'Debes aceptar la autorización de tratamiento de datos personales.',
    };

    const errors = {};
    for (const [field, message] of Object.entries(checks)) {
      if (message) errors[field] = message;
    }
    return errors;
  }

  const api = { validateRegistration, MAX_CV_BYTES };
  if (typeof module === 'object' && module.exports) {
    module.exports = api;
  } else {
    root.Validation = api;
  }
})(typeof window === 'undefined' ? globalThis : window);
