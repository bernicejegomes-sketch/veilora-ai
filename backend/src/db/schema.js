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

CREATE TABLE IF NOT EXISTS reports (
  report_id TEXT PRIMARY KEY,
  topic_id TEXT NOT NULL,
  complaint_text TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending'
);

CREATE TABLE IF NOT EXISTS queue (
  queue_id TEXT PRIMARY KEY,
  report_id TEXT NOT NULL,
  available_after INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'queued',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (report_id) REFERENCES reports(report_id) ON DELETE CASCADE
);
`;

export const REQUIRED_TABLES = [
  'members',
  'commitments',
  'used_nullifiers',
  'reports',
  'queue'
];
