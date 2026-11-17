/**
 * Data access for analysts. Every query is parameterized (RNF-06).
 */
function createAnalystRepository(db) {
  const findStmt = db.prepare(
    'SELECT id, username, password_hash AS passwordHash FROM analysts WHERE username = ?',
  );
  const upsertStmt = db.prepare(`
    INSERT INTO analysts (username, password_hash) VALUES (?, ?)
    ON CONFLICT (username) DO UPDATE SET password_hash = excluded.password_hash
  `);

  return {
    findByUsername(username) {
      return findStmt.get(username);
    },

    upsert(username, passwordHash) {
      upsertStmt.run(username, passwordHash);
    },
  };
}

module.exports = { createAnalystRepository };
