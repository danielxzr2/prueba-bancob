const { validationError, duplicateEmail } = require('../errors');
const { isDuplicateEmailError } = require('../repositories/applicantRepository');

// Every PDF starts with these bytes. The extension and the declared MIME type are
// chosen by the client, so they prove nothing (RNF-04).
const PDF_SIGNATURE = Buffer.from('%PDF-');

function isPdf(buffer) {
  return Buffer.isBuffer(buffer) && buffer.subarray(0, PDF_SIGNATURE.length).equals(PDF_SIGNATURE);
}

const LIMITS = {
  fullName: { min: 3, max: 100 },
  career: { min: 2, max: 100 },
};

/**
 * Normalizes the input: trims text and lowercases the email (CA-01.1).
 */
function normalizeRegistration(input) {
  return {
    fullName: String(input.fullName ?? '').trim(),
    email: String(input.email ?? '')
      .trim()
      .toLowerCase(),
    career: String(input.career ?? '').trim(),
    semester: input.semester,
    dataConsent: input.dataConsent === true,
  };
}

function checkLength(details, field, label, value) {
  const { min, max } = LIMITS[field];
  if (value.length === 0) {
    details.push({ field, message: `${label} es obligatorio.` });
  } else if (value.length < min || value.length > max) {
    details.push({ field, message: `${label} debe tener entre ${min} y ${max} caracteres.` });
  }
}

/**
 * Business rules the contract cannot express (RF-03): lengths measured after
 * trimming, mandatory consent and a mandatory CV whose content is really a PDF.
 * Returns the list of invalid fields; an empty list means the input is valid.
 */
function validateRegistration(data, cvFile) {
  const details = [];
  checkLength(details, 'fullName', 'El nombre completo', data.fullName);
  checkLength(details, 'career', 'La carrera', data.career);
  if (!data.dataConsent) {
    details.push({
      field: 'dataConsent',
      message: 'Debe aceptar la autorización de tratamiento de datos personales.',
    });
  }
  if (!cvFile) {
    details.push({ field: 'cv', message: 'La hoja de vida es obligatoria.' });
  } else if (!isPdf(cvFile.buffer)) {
    details.push({ field: 'cv', message: 'La hoja de vida debe ser un archivo PDF.' });
  }
  return details;
}

function createApplicantService({ applicantRepository, fileStorage, now = () => new Date() }) {
  return {
    /**
     * Registers an application (RF-01). Validates before touching the disk, and if
     * the insert fails, removes the stored file so no orphan files remain.
     */
    async register(input, cvFile) {
      const data = normalizeRegistration(input);
      const details = validateRegistration(data, cvFile);
      if (details.length > 0) throw validationError(details);

      // Checked before saving the file, so a duplicate never touches the disk (CA-04.1).
      if (applicantRepository.existsByEmail(data.email)) throw duplicateEmail();

      const cvFileName = await fileStorage.savePdf(cvFile.buffer);
      try {
        return applicantRepository.create({
          fullName: data.fullName,
          email: data.email,
          career: data.career,
          semester: data.semester,
          cvFileName,
          dataConsentAt: now().toISOString(),
        });
      } catch (err) {
        await fileStorage.remove(cvFileName);
        // Two simultaneous registrations can both pass existsByEmail; the database
        // UNIQUE constraint decides, and the loser gets the same 409.
        throw isDuplicateEmailError(err) ? duplicateEmail() : err;
      }
    },
  };
}

module.exports = { createApplicantService, normalizeRegistration, validateRegistration, isPdf };
