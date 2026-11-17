-- Database schema. Constraints duplicate key business rules as defense in depth:
-- even if a layer above fails, the database rejects invalid data.

CREATE TABLE IF NOT EXISTS analysts (
  id            INTEGER PRIMARY KEY,
  username      TEXT    NOT NULL UNIQUE,
  password_hash TEXT    NOT NULL,                                   -- bcrypt (RNF-01)
  created_at    TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE IF NOT EXISTS applicants (
  id              INTEGER PRIMARY KEY,
  full_name       TEXT    NOT NULL,
  email           TEXT    NOT NULL UNIQUE COLLATE NOCASE,           -- RF-04
  career          TEXT    NOT NULL,
  semester        INTEGER NOT NULL CHECK (semester BETWEEN 1 AND 12),
  cv_file_name    TEXT    NOT NULL UNIQUE,                          -- generated UUID (RNF-03)
  status          TEXT    NOT NULL DEFAULT 'PENDIENTE'
                          CHECK (status IN ('PENDIENTE', 'VIABLE', 'NO_VIABLE')),
  data_consent_at TEXT    NOT NULL,                                 -- RNF-09
  created_at      TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at      TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE INDEX IF NOT EXISTS idx_applicants_status ON applicants (status);

-- Audit log of decisions (RF-10). Append-only.
CREATE TABLE IF NOT EXISTS status_changes (
  id              INTEGER PRIMARY KEY,
  applicant_id    INTEGER NOT NULL REFERENCES applicants (id),
  previous_status TEXT    NOT NULL CHECK (previous_status IN ('PENDIENTE', 'VIABLE', 'NO_VIABLE')),
  new_status      TEXT    NOT NULL CHECK (new_status IN ('VIABLE', 'NO_VIABLE')),
  changed_by      INTEGER NOT NULL REFERENCES analysts (id),
  changed_at      TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE INDEX IF NOT EXISTS idx_status_changes_applicant ON status_changes (applicant_id);
