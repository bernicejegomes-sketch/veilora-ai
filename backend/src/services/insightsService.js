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
      `SELECT topic_id, server_day, theme_key, theme_label, support_count
       FROM insight_themes
       WHERE support_count >= ?
       ORDER BY server_day DESC, topic_id ASC, support_count DESC`
    )
    .all(k);
}
