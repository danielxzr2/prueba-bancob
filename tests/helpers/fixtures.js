/** Minimal file that starts with the PDF signature (%PDF-). */
const validPdf = () =>
  Buffer.from('%PDF-1.4\n1 0 obj << /Type /Catalog >> endobj\ntrailer << /Root 1 0 R >>\n%%EOF\n');

const validApplicant = (overrides = {}) => ({
  fullName: 'Ana María Pérez',
  email: 'ana.perez@example.com',
  career: 'Ingeniería de Sistemas',
  semester: '7',
  dataConsent: 'true',
  ...overrides,
});

/**
 * Builds a multipart registration request the way the browser form sends it:
 * every field as text plus the CV file.
 */
function sendRegistration(agent, fields = validApplicant(), cv = validPdf(), cvName = 'cv.pdf') {
  const req = agent.post('/api/applicants');
  for (const [name, value] of Object.entries(fields)) {
    if (value !== undefined) req.field(name, value);
  }
  if (cv) req.attach('cv', cv, { filename: cvName, contentType: 'application/pdf' });
  return req;
}

module.exports = { validPdf, validApplicant, sendRegistration };
