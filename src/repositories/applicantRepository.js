/**
 * Data access for applicants. Every query is parameterized (RNF-06).
 */
function createApplicantRepository(db) {
  const insertStmt = db.prepare(`
    INSERT INTO applicants (full_name, email, career, semester, cv_file_name, data_consent_at)
    VALUES (@fullName, @email, @career, @semester, @cvFileName, @dataConsentAt)
    RETURNING id, status, created_at AS createdAt
  `);
  // The email column is COLLATE NOCASE, so this comparison ignores case (RF-04).
  const existsByEmailStmt = db.prepare('SELECT 1 FROM applicants WHERE email = ?');

  return {
    /** Inserts an applicant and returns { id, status, createdAt }. */
    create(applicant) {
      return insertStmt.get(applicant);
    },

    existsByEmail(email) {
      return existsByEmailStmt.get(email) !== undefined;
    },
  };
}

/** True when an error is the UNIQUE constraint on applicants.email (concurrent duplicates). */
function isDuplicateEmailError(err) {
  return (
    err?.code === 'SQLITE_CONSTRAINT_UNIQUE' && String(err.message).includes('applicants.email')
  );
}

module.exports = { createApplicantRepository, isDuplicateEmailError };
