/**
 * Audit log of decisions (RF-10). Append-only: there is no update or delete.
 * Every query is parameterized (RNF-06).
 */
function createStatusChangeRepository(db) {
  const insertStmt = db.prepare(`
    INSERT INTO status_changes (applicant_id, previous_status, new_status, changed_by)
    VALUES (@applicantId, @previousStatus, @newStatus, @changedBy)
  `);
  const listByApplicantStmt = db.prepare(`
    SELECT sc.id,
           sc.previous_status AS previousStatus,
           sc.new_status      AS newStatus,
           a.username         AS changedBy,
           sc.changed_at      AS changedAt
    FROM status_changes sc
    JOIN analysts a ON a.id = sc.changed_by
    WHERE sc.applicant_id = ?
    ORDER BY sc.changed_at DESC, sc.id DESC
  `);

  return {
    insert(change) {
      insertStmt.run(change);
    },

    listByApplicant(applicantId) {
      return listByApplicantStmt.all(applicantId);
    },
  };
}

module.exports = { createStatusChangeRepository };
