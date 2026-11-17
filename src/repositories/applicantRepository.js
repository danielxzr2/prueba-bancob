/**
 * Data access for applicants. Every query is parameterized (RNF-06).
 */

const NOW = "strftime('%Y-%m-%dT%H:%M:%fZ', 'now')";

// The list shows only what the panel needs: no email (data minimization).
const SUMMARY_COLUMNS = `
  id, full_name AS fullName, career, semester, status, created_at AS createdAt`;
const DETAIL_COLUMNS = `${SUMMARY_COLUMNS},
  email, data_consent_at AS dataConsentAt, updated_at AS updatedAt`;
// Ties in created_at (same millisecond) are broken by id, so the order is deterministic.
const NEWEST_FIRST = 'ORDER BY created_at DESC, id DESC';

function createApplicantRepository(db) {
  const insertStmt = db.prepare(`
    INSERT INTO applicants (full_name, email, career, semester, cv_file_name, data_consent_at)
    VALUES (@fullName, @email, @career, @semester, @cvFileName, @dataConsentAt)
    RETURNING id, status, created_at AS createdAt
  `);
  // The email column is COLLATE NOCASE, so this comparison ignores case (RF-04).
  const existsByEmailStmt = db.prepare('SELECT 1 FROM applicants WHERE email = ?');
  const listAllStmt = db.prepare(`SELECT ${SUMMARY_COLUMNS} FROM applicants ${NEWEST_FIRST}`);
  const listByStatusStmt = db.prepare(
    `SELECT ${SUMMARY_COLUMNS} FROM applicants WHERE status = ? ${NEWEST_FIRST}`,
  );
  const findByIdStmt = db.prepare(`SELECT ${DETAIL_COLUMNS} FROM applicants WHERE id = ?`);
  const findCvStmt = db.prepare(
    'SELECT full_name AS fullName, cv_file_name AS cvFileName FROM applicants WHERE id = ?',
  );
  const updateStatusStmt = db.prepare(
    `UPDATE applicants SET status = ?, updated_at = ${NOW} WHERE id = ?`,
  );

  return {
    /** Inserts an applicant and returns { id, status, createdAt }. */
    create(applicant) {
      return insertStmt.get(applicant);
    },

    existsByEmail(email) {
      return existsByEmailStmt.get(email) !== undefined;
    },

    /** Lists applicants, newest first, optionally filtered by status (RF-06, RF-11). */
    list({ status } = {}) {
      return status ? listByStatusStmt.all(status) : listAllStmt.all();
    },

    findById(id) {
      return findByIdStmt.get(id);
    },

    findCv(id) {
      return findCvStmt.get(id);
    },

    updateStatus(id, status) {
      updateStatusStmt.run(status, id);
    },

    /**
     * Runs `fn` in a transaction: if it throws, every change is rolled back.
     * `fn` must be synchronous (better-sqlite3 transactions are synchronous).
     */
    inTransaction(fn) {
      return db.transaction(fn)();
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
