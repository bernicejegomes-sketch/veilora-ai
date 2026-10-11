export const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS members (
  roll_no TEXT PRIMARY KEY,
  dob TEXT NOT NULL,
  name TEXT NOT NULL,
  otp_hash TEXT,
  otp_expiry INTEGER,
  otp_used INTEGER NOT NULL DEFAULT 0,
  claimed INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS commitments (
  commitment TEXT PRIMARY KEY,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS used_nullifiers (
  nullifier TEXT PRIMARY KEY
);

-- Aggregate-only analytics: NO per-submission rows, NO complaint text, NO identifiers.
-- One row per (topic, server_day) bucket. This is the only retained complaint-derived data.
CREATE TABLE IF NOT EXISTS insights (
  topic_id         TEXT NOT NULL,
  server_day       TEXT NOT NULL,
  submission_count INTEGER NOT NULL DEFAULT 0,
  warn_count       INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (topic_id, server_day)
);

-- Future AI-generated themes/summaries, stored only as aggregate buckets.
-- Never linked to a submission, nullifier, or identity. Displayed subject to k-anonymity (k=3).
CREATE TABLE IF NOT EXISTS insight_themes (
  topic_id      TEXT NOT NULL,
  server_day    TEXT NOT NULL,
  theme_key     TEXT NOT NULL,
  theme_label   TEXT NOT NULL,
  support_count INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (topic_id, server_day, theme_key)
);
`;

export const REQUIRED_TABLES = [
  'members',
  'commitments',
  'used_nullifiers',
  'insights',
  'insight_themes'
];
