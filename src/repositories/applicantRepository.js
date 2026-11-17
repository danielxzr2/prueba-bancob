/**
 * Data access for applicants. Every query is parameterized (RNF-06).
 */
function createApplicantRepository(db) {
  const insertStmt = db.prepare(`
    INSERT INTO applicants (full_name, email, career, semester, cv_file_name, data_consent_at)
    VALUES (@fullName, @email, @career, @semester, @cvFileName, @dataConsentAt)
    RETURNING id, status, created_at AS createdAt
  `);

  return {
    /** Inserts an applicant and returns { id, status, createdAt }. */
    create(applicant) {
      return insertStmt.get(applicant);
    },
  };
}

module.exports = { createApplicantRepository };
