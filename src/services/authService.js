const bcrypt = require('bcryptjs');
const { invalidCredentials } = require('../errors');

/**
 * Analyst authentication (RF-05). Passwords are only stored as bcrypt hashes (RNF-01).
 * The hasher is injectable so unit tests do not need real bcrypt.
 */
function createAuthService({ analystRepository, bcryptCost, hasher = bcrypt }) {
  // When the user does not exist we still compare against this hash, so the response
  // takes the same time and does not reveal which usernames exist (CA-05.2).
  const dummyHash = hasher.hash('timing-equalizer', bcryptCost);

  return {
    async login(username, password) {
      const analyst = analystRepository.findByUsername(username);
      const hash = analyst ? analyst.passwordHash : await dummyHash;
      const passwordMatches = await hasher.compare(password, hash);

      if (!analyst || !passwordMatches) throw invalidCredentials();
      return { id: analyst.id, username: analyst.username };
    },

    /** Creates the analyst or replaces their password (used by `npm run seed`). */
    async createOrUpdateAnalyst(username, password) {
      const passwordHash = await hasher.hash(password, bcryptCost);
      analystRepository.upsert(username, passwordHash);
    },
  };
}

module.exports = { createAuthService };
