/**
 * Aggregate insights read layer.
 *
 * Minimum bucket size (k-anonymity) required before an aggregate is exposed.
 * A (topic, server_day) bucket with fewer than K submissions, or a theme with
 * fewer than K supporting submissions, MUST be suppressed from every read path.
 * This prevents a single complaint from being inferred from a displayed insight.
 */
export const K_ANONYMITY_THRESHOLD = 3;

/**
 * Read topic/day aggregate buckets that satisfy the k-anonymity threshold.
 * Returns only aggregate counters derived from `insights`; never complaint text
 * and never any identifier.
 */
export function getTopicDayInsights(db, k = K_ANONYMITY_THRESHOLD) {
  return db
    .prepare(
      `SELECT topic_id, server_day, submission_count, warn_count
       FROM insights
       WHERE submission_count >= ?
       ORDER BY server_day DESC, topic_id ASC`
    )
    .all(k);
}

/**
 * Read theme aggregates that satisfy the k-anonymity threshold.
 * Themes are AI/derived labels attached to (topic, server_day) buckets only.
 */
export function getThemeInsights(db, k = K_ANONYMITY_THRESHOLD) {
  return db
    .prepare(
      `SELECT topic_id, server_day, theme_key, theme_label, support_count, summary
       FROM insight_themes
       WHERE support_count >= ?
       ORDER BY server_day DESC, topic_id ASC, support_count DESC`
    )
    .all(k);
}

/**
 * Increment the aggregate support count for each generalized AI theme produced
 * by a single accepted submission. Only sanitized theme keys/labels and an
 * optional short summary are stored; never raw complaint text or identifiers.
 *
 * The whole batch runs in a single transaction so concurrent accepted
 * submissions cannot corrupt support counts.
 *
 * @param {import('better-sqlite3').Database} db
 * @param {string} topicId
 * @param {string} serverDay
 * @param {{key:string,label:string}[]} themes
 * @param {string} [summary]
 */
export function upsertThemeSupport(db, topicId, serverDay, themes, summary = '') {
  if (!Array.isArray(themes) || themes.length === 0) return;

  const stmt = db.prepare(
    `INSERT INTO insight_themes (topic_id, server_day, theme_key, theme_label, support_count, summary)
     VALUES (@topicId, @serverDay, @themeKey, @themeLabel, 1, @summary)
     ON CONFLICT(topic_id, server_day, theme_key) DO UPDATE SET
       support_count = support_count + 1,
       theme_label = excluded.theme_label,
       summary = CASE
         WHEN excluded.summary IS NOT NULL AND excluded.summary <> '' THEN excluded.summary
         ELSE insight_themes.summary
       END`
  );

  const safeSummary = typeof summary === 'string' ? summary : '';

  const tx = db.transaction((items) => {
    for (const theme of items) {
      if (!theme || typeof theme.key !== 'string' || typeof theme.label !== 'string') continue;
      stmt.run({
        topicId,
        serverDay,
        themeKey: theme.key,
        themeLabel: theme.label,
        summary: safeSummary,
      });
    }
  });

  tx(themes);
}
