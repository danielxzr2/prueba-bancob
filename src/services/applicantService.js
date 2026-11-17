const { validationError, duplicateEmail, notFound } = require('../errors');
const { isDuplicateEmailError } = require('../repositories/applicantRepository');

// Every PDF starts with these bytes. The extension and the declared MIME type are
// chosen by the client, so they prove nothing (RNF-04).
const PDF_SIGNATURE = Buffer.from('%PDF-');

function isPdf(buffer) {
  return Buffer.isBuffer(buffer) && buffer.subarray(0, PDF_SIGNATURE.length).equals(PDF_SIGNATURE);
}

// Statuses an analyst can assign. PENDIENTE is assigned only by the system (RF-08).
const DECISIONS = ['VIABLE', 'NO_VIABLE'];
const MAX_SLUG_LENGTH = 60;

const applicantNotFound = () => notFound('Practicante no encontrado.');

/**
 * Builds the download filename from the applicant's name (RF-09), e.g.
 * 'Ana María Pérez' -> 'CV-ana-maria-perez.pdf'. Only [a-z0-9-] survive, so quotes or
 * line breaks in a name can never inject into the Content-Disposition header.
 */
function cvDownloadName(fullName) {
  const slug = fullName
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // strip accents: á -> a, ñ -> n
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .slice(0, MAX_SLUG_LENGTH)
    .replace(/^-+|-+$/g, '');
  return `CV-${slug || 'practicante'}.pdf`;
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

function createApplicantService({
  applicantRepository,
  statusChangeRepository,
  fileStorage,
  now = () => new Date(),
}) {
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

    /** RF-06 / RF-11 */
    list({ status } = {}) {
      return applicantRepository.list({ status });
    },

    /** RF-07 */
    getById(id) {
      const applicant = applicantRepository.findById(id);
      if (!applicant) throw applicantNotFound();
      return applicant;
    },

    /**
     * RF-08 + RF-10: sets the analyst's decision and records it in the audit log.
     * Both happen in one transaction: there is never a decision without its record.
     * Setting the current status again changes nothing and records nothing.
     */
    changeStatus(id, status, analyst) {
      if (!DECISIONS.includes(status)) {
        throw validationError([
          { field: 'status', message: 'El valor no es uno de los permitidos.' },
        ]);
      }
      return applicantRepository.inTransaction(() => {
        const current = applicantRepository.findById(id);
        if (!current) throw applicantNotFound();
        if (current.status === status) return current;

        applicantRepository.updateStatus(id, status);
        statusChangeRepository.insert({
          applicantId: id,
          previousStatus: current.status,
          newStatus: status,
          changedBy: analyst.id,
        });
        return applicantRepository.findById(id);
      });
    },

    /** RF-10 */
    getStatusHistory(id) {
      if (!applicantRepository.findById(id)) throw applicantNotFound();
      return statusChangeRepository.listByApplicant(id);
    },

    /** RF-09: location of the stored CV and the name to download it with. */
    async getCv(id) {
      const cv = applicantRepository.findCv(id);
      if (!cv) throw applicantNotFound();
      const filePath = fileStorage.pathOf(cv.cvFileName);
      if (!(await fileStorage.exists(cv.cvFileName))) {
        throw notFound('La hoja de vida no está disponible.');
      }
      return { filePath, downloadName: cvDownloadName(cv.fullName) };
    },
  };
}

module.exports = {
  createApplicantService,
  normalizeRegistration,
  validateRegistration,
  isPdf,
  cvDownloadName,
};
