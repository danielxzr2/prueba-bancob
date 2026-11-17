const { validateRegistration, MAX_CV_BYTES } = require('../../public/js/validation');

/** Fake of the browser's File object: only what the validation reads. */
const pdfFile = (overrides = {}) => ({
  name: 'cv.pdf',
  type: 'application/pdf',
  size: 1024,
  ...overrides,
});

const validForm = (overrides = {}) => ({
  fullName: 'Ana María Pérez',
  email: 'ana.perez@example.com',
  career: 'Ingeniería de Sistemas',
  semester: '7',
  cv: pdfFile(),
  dataConsent: true,
  ...overrides,
});

describe('RF-02 Validación en el cliente', () => {
  it('acepta un formulario válido', () => {
    expect(validateRegistration(validForm())).toEqual({});
  });

  it('CA-02.1 rechaza el nombre vacío con un mensaje para ese campo', () => {
    expect(validateRegistration(validForm({ fullName: '' }))).toEqual({
      fullName: expect.stringMatching(/obligatorio/),
    });
  });

  // Same cases as the server (RF-03): both layers must agree on the rules.
  it.each([
    ['nombre solo con espacios', { fullName: '     ' }, 'fullName'],
    ['nombre muy corto', { fullName: 'Al' }, 'fullName'],
    ['nombre muy largo', { fullName: 'a'.repeat(101) }, 'fullName'],
    ['correo vacío', { email: '' }, 'email'],
    ['correo inválido', { email: 'no-es-un-correo' }, 'email'],
    ['correo muy largo', { email: `${'a'.repeat(250)}@x.co` }, 'email'],
    ['carrera vacía', { career: '  ' }, 'career'],
    ['semestre vacío', { semester: '' }, 'semester'],
    ['semestre 0', { semester: '0' }, 'semester'],
    ['semestre 13', { semester: '13' }, 'semester'],
    ['semestre decimal', { semester: '7.5' }, 'semester'],
    ['semestre no numérico', { semester: 'siete' }, 'semester'],
    ['sin hoja de vida', { cv: null }, 'cv'],
    [
      'hoja de vida que no es PDF',
      { cv: pdfFile({ name: 'cv.docx', type: 'application/msword' }) },
      'cv',
    ],
    ['hoja de vida de más de 5 MB', { cv: pdfFile({ size: 5 * 1024 * 1024 + 1 }) }, 'cv'],
    ['sin autorización de datos', { dataConsent: false }, 'dataConsent'],
  ])('rechaza %s', (_case, override, field) => {
    const errors = validateRegistration(validForm(override));

    expect(Object.keys(errors)).toEqual([field]);
    expect(errors[field]).toEqual(expect.any(String));
  });

  it('acepta una hoja de vida de exactamente 5 MB', () => {
    expect(validateRegistration(validForm({ cv: pdfFile({ size: MAX_CV_BYTES }) }))).toEqual({});
  });

  it('reporta todos los campos inválidos a la vez', () => {
    const errors = validateRegistration({
      fullName: '',
      email: '',
      career: '',
      semester: '',
      cv: null,
      dataConsent: false,
    });

    expect(Object.keys(errors).sort()).toEqual(
      ['career', 'cv', 'dataConsent', 'email', 'fullName', 'semester'].sort(),
    );
  });
});
